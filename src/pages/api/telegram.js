// pages/api/telegram.js
import TelegramBot from 'node-telegram-bot-api';
import { google } from 'googleapis';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: process.env.NODE_ENV !== 'production' 
});

// Configuración de Google Sheets
const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NODE_ENV === 'production' 
    ? 'https://speed-bot-tasas.vercel.app/api/auth/callback/google'
    : 'http://localhost:3000/api/auth/callback/google'
);

auth.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// Cache de tasas
let tasasCache = {};
let lastUpdate = 0;

const CURRENCY_FORMATS = {
  VENEZUELA: { code: 'VES', symbol: 'Bs.' },
  ARGENTINA: { code: 'ARS', symbol: '$' },
  CHILE: { code: 'CLP', symbol: '$' },
  COLOMBIA: { code: 'COP', symbol: '$' },
  PERU: { code: 'PEN', symbol: 'S/' },
  ECUADOR: { code: 'USD', symbol: '$' },
  MEXICO: { code: 'MXN', symbol: '$' },
  PANAMA: { code: 'PAB', symbol: 'B/.' },
  BRASIL: { code: 'BRL', symbol: 'R$' },
  ESPAÑA: { code: 'EUR', symbol: '€' },
  'REP. DOMINICANA': { code: 'DOP', symbol: '$' }
};

async function actualizarTasas() {
  if (Date.now() - lastUpdate < 300000 && Object.keys(tasasCache).length > 0) return;
  
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: process.env.SPREADSHEET_RANGE,
    });

    const rawData = response.data.values || [];
    tasasCache = procesarDatos(rawData);
    lastUpdate = Date.now();
  } catch (error) {
    console.error('Error actualizando tasas:', error);
  }
}

function procesarDatos(data) {
  const processed = {};
  let currentCountry = '';
  
  data.forEach(row => {
    if (row[0]?.startsWith('DESDE')) {
      currentCountry = row[0].replace('DESDE', '').trim().toUpperCase();
      processed[currentCountry] = {};
    } else if (currentCountry && row[0]) {
      const country = row[0].trim().toUpperCase();
      const value = parseFloat(row[1].replace(',', '.'));
      processed[currentCountry][country] = value;
    }
  });
  
  return processed;
}

function formatearMonto(monto, pais) {
  const format = CURRENCY_FORMATS[pais] || { code: 'USD', symbol: '$' };
  return `${format.symbol} ${monto.toLocaleString('es-ES', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 6 
  })}`;
}

// Manejo de comandos
bot.onText(/^(\w+)[-\s](\w+)\s+([\d.,]+)$/i, async (msg, match) => {
  await actualizarTasas();
  
  const chatId = msg.chat.id;
  const [_, origenRaw, destinoRaw, montoRaw] = match;
  const origen = origenRaw.toUpperCase();
  const destino = destinoRaw.toUpperCase();
  const monto = parseFloat(montoRaw.replace(',', '.'));

  try {
    if (!tasasCache[origen]) {
      return bot.sendMessage(chatId, `❌ No existen tasas para ${origen}`);
    }

    const tasa = tasasCache[origen][destino];
    if (!tasa) {
      return bot.sendMessage(chatId, `❌ Tasa no encontrada para ${origen} → ${destino}`);
    }

    const resultado = monto * tasa;
    const respuesta = `
💱 *Conversión de Divisas*
      
🗺️ Origen: ${origen} (${CURRENCY_FORMATS[origen]?.code || '?'})
🎯 Destino: ${destino} (${CURRENCY_FORMATS[destino]?.code || '?'})
      
💰 *Monto:* ${formatearMonto(monto, origen)}
📊 *Tasa:* 1 ${CURRENCY_FORMATS[origen]?.code || origen} = ${tasa.toFixed(6)}
      
💡 *Resultado:* ${formatearMonto(resultado, destino)}
    `;

    bot.sendMessage(chatId, respuesta, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error en conversión:', error);
    bot.sendMessage(chatId, '❌ Error procesando la solicitud');
  }
});

// Comandos adicionales
bot.onText(/\/start/, (msg) => {
  const helpText = `
🤖 *Bot de Conversión de Divisas*
    
Ejemplos de uso:
\`chile venezuela 20000\`
\`argentina-colombia 5000\`
\`peru-mexico 1500\`

Países soportados:
${Object.keys(CURRENCY_FORMATS).join(', ')}
  `;
  
  bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

// Manejador de la API
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).end();
    } catch (error) {
      console.error('Error en webhook:', error);
      res.status(500).end();
    }
  } else {
    res.status(405).end();
  }
}