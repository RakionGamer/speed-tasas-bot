import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
let tasasCache = [];
let lastUpdate = 0;

// Mapeo de países a códigos de moneda
const CURRENCY_MAP = {
  'VENEZUELA': 'VES',
  'ARGENTINA': 'ARS',
  'CHILE': 'CLP',
  'COLOMBIA': 'COP',
  'PERU': 'PEN',
  'ECUADOR': 'USD',
  'MEXICO': 'MXN',
  'PANAMA': 'PAB',
  'BRASIL': 'BRL',
  'ESPAÑA': 'EUR',
  'REP. DOMINICANA': 'DOP',
  'PM': 'USD'
};

async function fetchExchangeRates() {
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://speed-bot-tasas.vercel.app/api/auth/callback/google'
    );

    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: process.env.SPREADSHEET_RANGE,
    });

    return response.data.values || [];
  } catch (error) {
    console.error('Error fetching rates:', error);
    return [];
  }
}

// Procesar datos de la hoja
function processSheetData(rawData) {
  const processed = {};
  let currentCountry = '';
  
  rawData.forEach(row => {
    if (row[0]?.startsWith('DESDE')) {
      currentCountry = row[0].replace('DESDE', '').trim();
      processed[currentCountry] = {};
    } else if (currentCountry && row[0]) {
      processed[currentCountry][row[0].toUpperCase()] = parseFloat(row[1].replace(',', '.'));
    }
  });
  
  return processed;
}

// Actualizar caché cada 5 minutos
async function updateCache() {
  if (Date.now() - lastUpdate > 300000 || !tasasCache.length) {
    const rawData = await fetchExchangeRates();
    tasasCache = processSheetData(rawData);
    lastUpdate = Date.now();
  }
}

// Formatear montos
function formatCurrency(amount, country) {
  const currency = CURRENCY_MAP[country.toUpperCase()] || 'USD';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(amount);
}

// Manejar comando de conversión
async function handleConversion(msg, match) {
  const chatId = msg.chat.id;
  const [orig, dest] = match[1].split(/[- ]/);
  const amount = parseFloat(match[2].replace(',', '.'));
  
  await updateCache();
  
  const originCountry = orig.toUpperCase();
  const destCountry = dest.toUpperCase();
  
  if (!tasasCache[originCountry]) {
    return bot.sendMessage(chatId, `❌ No hay tasas disponibles para ${originCountry}`);
  }
  
  const rate = tasasCache[originCountry][destCountry];
  if (!rate) {
    return bot.sendMessage(chatId, `❌ No se encontró tasa para ${originCountry} → ${destCountry}`);
  }
  
  const result = amount * rate;
  const response = `
💱 *Conversión de divisas*
  
➡️ *Origen:* ${originCountry} (${CURRENCY_MAP[originCountry] || '?'})
⬅️ *Destino:* ${destCountry} (${CURRENCY_MAP[destCountry] || '?'})
  
💰 *Monto:* ${formatCurrency(amount, originCountry)}
📈 *Tasa:* 1 ${CURRENCY_MAP[originCountry] || originCountry} = ${rate.toFixed(6)}
  
💡 *Resultado:* ${formatCurrency(result, destCountry)}
  `;

  bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
}

// Comandos del bot
bot.onText(/\/start/, (msg) => {
  const helpText = `
¡Bienvenido al bot de conversión de divisas! 🏦

*Ejemplos de uso:*
\`chile venezuela 20000\`
\`argentina-colombia 5000\`
\`peru-mexico 1500\`

*Países disponibles:*
${Object.keys(CURRENCY_MAP).join(', ')}
  `;
  
  bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

bot.onText(/^(\w+)[-\s](\w+)\s+([\d.,]+)$/i, (msg, match) => {
  handleConversion(msg, match).catch(error => {
    console.error('Error:', error);
    bot.sendMessage(msg.chat.id, '❌ Error al procesar la solicitud');
  });
});

// Comandos existentes para tasas
bot.onText(/\/paralelo/, async (msg) => {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares');
    const data = await response.json();
    const paralelo = data.find(item => item.nombre === 'Paralelo');
    
    const message = paralelo 
      ? `💵 *Dólar Paralelo*\n📈 Precio: Bs. ${paralelo.promedio.toFixed(2)}\n🕒 ${new Date(paralelo.fechaActualizacion).toLocaleDateString()}`
      : '⚠️ No se encontró la tasa paralelo';
    
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(error);
    bot.sendMessage(msg.chat.id, '❌ Error al obtener la tasa paralelo');
  }
});

bot.onText(/\/oficial/, async (msg) => {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares');
    const data = await response.json();
    const oficial = data.find(item => item.nombre === 'Oficial');
    
    const message = oficial 
      ? `💵 *Dólar Oficial*\n📈 Precio: Bs. ${oficial.promedio.toFixed(2)}\n🕒 ${new Date(oficial.fechaActualizacion).toLocaleDateString()}`
      : '⚠️ No se encontró la tasa oficial';
    
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(error);
    bot.sendMessage(msg.chat.id, '❌ Error al obtener la tasa oficial');
  }
});

// Manejo de errores
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('Bot iniciado...');