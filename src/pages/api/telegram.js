import TelegramBot from 'node-telegram-bot-api';
require('dotenv').config(); // Para cargar variables de entorno
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { body } = req;
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text;
      await bot.sendMessage(chatId, `Recibí: ${text}`);
    }
    res.status(200).end();
  } else {
    res.status(404).end();
  }
}