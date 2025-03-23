const { google } = require('googleapis');

const CLIENT_ID = '38388985396-1r39chunsvoummiqndblpa9r2gfs65bg.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://speed-bot-tasas.vercel.app/api/auth/callback/google';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);



// Pegar el código obtenido aquí (después de autorizar)
const CODE = '4/0AQSTgQGknyy6l9hbviG8V0OKoa9xgoUOPl6N-9uPKUQbkAZYLLkLfDHecmQgA1tJBRHGnQ'; // Reemplazar con tu código

// Obtener tokens
oauth2Client.getToken(CODE, (err, tokens) => {
  if (err) return console.error('Error:', err.message);
  console.log('\n2. Configura estos valores en .env.local:');
  console.log('GOOGLE_REFRESH_TOKEN=', tokens.refresh_token);
});