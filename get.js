const { google } = require('googleapis');

const CLIENT_ID = '38388985396-1r39chunsvoummiqndblpa9r2gfs65bg.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/api/auth/callback/google';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const CODE = '4/0AQSTgQGcNrXpB1sQnmmKerIdLx1oWafvZYX2JRYz47zCL--2l_xSTt5NG0DsRJmIQvzoqg';

// Obtener tokens
oauth2Client.getToken(CODE, (err, tokens) => {
  if (err) return console.error('Error:', err.message);
  console.log('\n2. Configura estos valores en .env.local:');
  console.log('GOOGLE_REFRESH_TOKEN=', tokens.refresh_token);
});