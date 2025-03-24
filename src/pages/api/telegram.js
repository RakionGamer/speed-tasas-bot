import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);
function processDataIntoRates(data) {
  const rates = {};
  let currentOrigin = null;
  const normalizeText = (text) => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ .]/g, '')
      .toLowerCase();
  };
  for (const item of data) {
    if (typeof item === 'string' && item.startsWith('DESDE ')) {
      const origin = item.replace('DESDE ', '').trim();
      currentOrigin = normalizeText(origin);
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

const welcomeMessage = `
🎉 *Bienvenido al Bot de Tasas de Cambio de Spped* 💱

_Puedes usar estos comandos:_

🌎 *Conversiones internacionales:*
  - \`origen-destino monto\`  
    Ejemplo: \`chile-venezuela 2500\`

📊 *Ejemplos:*
  - \`venezuela-chile 500.000\`
  - \`mexico-argentina 3.000\`
  - \`chile-pm 3.000\`

👨🏻‍💻 *Created by: Ricardo Valera*
`;


function normalizeUserInput(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ .]/g, '')
    .toLowerCase();
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { body } = req;
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text.toLowerCase();
      try {
        if (text === '/start' || text === 'hola') {
          await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
          return res.status(200).end();
        } else if (text === 'sandra') {
          const mensaje = "Eres lo más lindo de mí corazón, te amo mucho🖤"
          await bot.sendMessage(chatId, mensaje);
        } else {
          const args = text.split(' ');
          if (args.length >= 2) {
            const countriesPart = args[0];
            const montoStr = args[1];
            const countries = countriesPart.split('-');
            if (countries.length === 2) {
              const origen = normalizeUserInput(countries[0]);
              const destino = normalizeUserInput(countries[1]);
              const cleanedMontoStr = montoStr.replace(/\./g, '').replace(',', '.');
              const monto = parseFloat(cleanedMontoStr);
              if (!isNaN(monto)) {
                try {
                  const response = await fetch('https://speed-bot-tasas.vercel.app/api/sheets');
                  const data = await response.json();
                  const rates = processDataIntoRates(data);
                  
                  if (rates[origen] && rates[origen][destino]) {
                    const rate = rates[origen][destino];
                    const resultado = monto * rate;
                    const mensaje = 
                      `💱 Conversión: ${countries[0].toUpperCase()} → ${countries[1].toUpperCase()}\n` +
                      `📊 Monto: ${monto.toLocaleString()}\n` +
                      `📈 Tasa: ${rate.toFixed(5)}\n` +
                      `💵 Total: ${resultado.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                    await bot.sendMessage(chatId, mensaje);
                  } else {
                    await bot.sendMessage(chatId, '⚠️ No se encontró la tasa para la ruta especificada.');
                  }
                } catch (error) {
                  console.error(error);
                  await bot.sendMessage(chatId, '❌ Error al obtener las tasas.');
                }
              } else {
                await bot.sendMessage(chatId, '⚠️ Monto inválido. Ingresa un número válido.');
              }
            } else {
              await bot.sendMessage(chatId, '⚠️ Formato incorrecto. Usa: origen-destino monto\nEjemplo: chile-venezuela 2500');
            }
          } else {
            await bot.sendMessage(chatId, '⚠️ Comando no reconocido, recuerda usar: "origen-destino monto".');
          }
        }
      } catch (error) {
        console.error(error);
        await bot.sendMessage(chatId, '❌ Error al procesar tu solicitud.');
      }
    }
  
    res.status(200).end();
  } else {
    res.status(404).end();
  }
}