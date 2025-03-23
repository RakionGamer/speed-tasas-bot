// setup-webhook.js
require('dotenv').config(); // Para cargar variables de entorno
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

const webhookUrl = 'https://speed-bot-tasas.vercel.app/api/telegram';

bot.setWebHook(webhookUrl)
  .then(() => console.log('✅ Webhook configurado en:', webhookUrl))
  .catch(console.error);