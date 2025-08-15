import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

// Configuración de caché
const CACHE_TIEMPO = 5 * 60 * 1000; // 5 minutos de caché
let tasasCache = null;
let ultimaActualizacion = 0;

// Mapa de normalización de países
const PAISES_PREDEFINIDOS = {
  'chile': 'chile',
  'venezuela': 'venezuela',
  'argentina': 'argentina',
  'peru': 'peru',
  'colombia': 'colombia',
  'ecuador': 'ecuador',
  'mexico': 'mexico',
  'panama': 'panama',
  'repdominicana': 'repdominicana',
  'brasil': 'brasil',
  'españa': 'españa',
  'pm': 'pm'
};

// Función de normalización optimizada
const normalizeText = (text) => {
  const limpio = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ .-]/g, '')
    .toLowerCase();
  return PAISES_PREDEFINIDOS[limpio] || limpio;
};

// Procesamiento de datos con caché
async function obtenerTasas() {
  const ahora = Date.now();
  
  if (!tasasCache || (ahora - ultimaActualizacion) > CACHE_TIEMPO) {
    try {
      const response = await fetch('https://speed-bot-tasas.vercel.app/api/sheets');
      const data = await response.json();
      tasasCache = processDataIntoRates(data);
      ultimaActualizacion = ahora;
    } catch (error) {
      console.error('Error actualizando caché:', error);
    }
  }
  
  return tasasCache;
}

function processDataIntoRates(data) {
  const rates = {};
  let currentOrigin = null;

  for (const item of data) {
    if (typeof item === 'string' && item.startsWith('DESDE ')) {
      currentOrigin = normalizeText(item.replace('DESDE ', '').trim());
      rates[currentOrigin] = {};
    } else if (Array.isArray(item) && currentOrigin) {
      const [destino, tasa] = item.map(i => typeof i === 'string' ? i.trim() : i);
      const destinoNormalized = normalizeText(destino);
      const tasaNum = parseFloat(tasa.replace(',', '.'));
      if (!isNaN(tasaNum)) {
        rates[currentOrigin][destinoNormalized] = tasaNum;
      }
    }
  }
  return rates;
}

// Mensaje de bienvenida
const welcomeMessage = `
🎉 *Bienvenido al Bot de Tasas de Cambio de Speed* 💱

_Puedes usar estos comandos:_

💵 *Tasas locales:*
  - \`paralelo [monto]\` → Dólar paralelo
  - \`oficial [monto]\`  → Dólar oficial

🌎 *Conversiones internacionales:*
  - \`origen-destino monto\`  
    Ejemplo: \`chile-venezuela 2.500\`

📊 *Ejemplos:*
  - \`/paralelo 20\` (monto en dolarés) 
  - \`/oficial 15.50\` (monto en dolarés) 
  - \`mexico-argentina 3000\`
  - \`oficial\` (solo tasa)
  - \`paralelo\` (solo tasa)
`;

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { body } = req;
    
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text.trim();

      try {
        // Manejar comando de inicio
        if (/^(\/start|hola)$/i.test(text)) {
          await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
          return res.status(200).end();
        }

        // Manejar tasas locales
        const comandoLocal = text.match(/^(\/?(paralelo|oficial))\s*(\d+[\.,]?\d*)?$/i);
        if (comandoLocal) {
          const [_, comando, tipo, monto] = comandoLocal;
          const amount = parseFloat((monto || '').replace(',', '.'));
          
          const response = await fetch('https://ve.dolarapi.com/v1/dolares');
          const datos = await response.json();
          const tasa = datos.find(item => item.nombre === (tipo.toLowerCase() === 'paralelo' ? 'Paralelo' : 'Oficial'));

          if (tasa) {
            let mensaje = `💵 *Dólar ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}*\n` +
                         `📈 Precio: Bs. ${tasa.promedio.toFixed(2)}`;
            
            if (!isNaN(amount)) {
              const resultado = amount * tasa.promedio;
              mensaje += `\n💸 *${amount} USD* → *${resultado.toFixed(2)} Bs.*`;
            }
            
            await bot.sendMessage(chatId, mensaje, { parse_mode: 'Markdown' });
          } else {
            await bot.sendMessage(chatId, `⚠️ No se encontró la tasa ${tipo}`);
          }
          return res.status(200).end();
        }

        // Manejar conversiones internacionales
        const conversionMatch = text.match(/([a-záéíóúñ]+)\s*-\s*([a-záéíóúñ]+)\s+([\d\.,]+)/i);
        if (conversionMatch) {
          const origen = normalizeText(conversionMatch[1]);
          const destino = normalizeText(conversionMatch[2]);
          const monto = parseFloat(conversionMatch[3].replace(/\./g, '').replace(',', '.'));
          
          if (!isNaN(monto)) {
            const rates = await obtenerTasas();
            
            if (rates[origen]?.[destino]) {
              const rate = rates[origen][destino];
              const resultado = monto * rate;
              const mensaje = 
                `💱 *${origen.toUpperCase()} → ${destino.toUpperCase()}*\n` +
                `📊 Monto: ${monto.toLocaleString()}\n` +
                `📈 Tasa: ${rate.toFixed(5)}\n` +
                `💵 *Total: ${resultado.toLocaleString(undefined, { maximumFractionDigits: 2 })}*`;
              
              await bot.sendMessage(chatId, mensaje, { parse_mode: 'Markdown' });
            } else {
              await bot.sendMessage(chatId, '⚠️ No se encontró tasa para esta ruta');
            }
          } else {
            await bot.sendMessage(chatId, '⚠️ Monto inválido');
          }
          return res.status(200).end();
        }

        // Comando no reconocido
        await bot.sendMessage(chatId, '⚠️ Comando no reconocido\n' + welcomeMessage, { parse_mode: 'Markdown' });

      } catch (error) {
        console.error('Error general:', error);
        await bot.sendMessage(chatId, '❌ Error procesando tu solicitud');
      }
    }
    
    res.status(200).end();
  } else {
    res.status(404).end();
  }
}
