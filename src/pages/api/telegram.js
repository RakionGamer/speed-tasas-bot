import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch'; // Necesitarás instalar esto

require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { body } = req;
    
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text.toLowerCase();

      try {
        if (text === 'tasa-paralelo') {
          const response = await fetch('https://ve.dolarapi.com/v1/dolares');
          const datos = await response.json();
          const paralelo = datos.find(item => item.nombre === 'Paralelo');
          
          if (paralelo) {
            const mensaje = `💵 Dólar Paralelo:\n` +
                            `📈 Precio: Bs. ${paralelo.promedio.toFixed(2)}\n` +
                            `🕒 Actualizado: ${new Date(paralelo.fechaActualizacion).toLocaleDateString()}`;
            
            await bot.sendMessage(chatId, mensaje);
          } else {
            await bot.sendMessage(chatId, '⚠️ No se encontró la tasa paralelo');
          }
        } else if (text === 'tasa-oficial') {
            const response = await fetch('https://s3.amazonaws.com/dolartoday/data.json');
            const datos = await response.json();
            const oficial = datos.USD.promedio_real;
            if (oficial) {
                const mensaje = `💵 Dólar Oficial:\n` +
                                `📈 Precio: Bs. ${oficial.toFixed(2)}\n` +
                                `🕒 Actualizado: ${new Date(datos._timestamp).toLocaleDateString()}`;
                
                await bot.sendMessage(chatId, mensaje);
            } else {
                await bot.sendMessage(chatId, '⚠️ No se encontró la tasa oficial');
            }
        } else {
          await bot.sendMessage(chatId, `Para ingresar un comando válido, escribe "tasa-paralelo u tasa-oficial"`);
        }
      } catch (error) {
        console.error(error);
        await bot.sendMessage(chatId, '❌ Error al obtener la tasa');
      }
    }
    
    res.status(200).end();
  } else {
    res.status(404).end();
  }
}