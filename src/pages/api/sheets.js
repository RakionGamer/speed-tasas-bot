import { google } from 'googleapis';
require('dotenv').config();




export default async function handler(req, res) {
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/api/auth/callback/google'
    );

    auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREEDSHEAT_ID,
      range: process.env.SPREEDSHEAT_TITLE,
    });

    
    const rawData = response.data.values || [];
    let formattedData = [];
    let currentHeaderGroup = [];
    let currentBlock = [];

    // Procesar bloques de datos basados en filas "DESDE"
    rawData.forEach(row => {
      if (row[0]?.startsWith('DESDE')) {
        if (currentHeaderGroup.length > 0) {
          // Procesar el bloque anterior
          currentHeaderGroup.forEach((header, headerIndex) => {
            formattedData.push(header);
            currentBlock.forEach(dataRow => {
              const country = dataRow[headerIndex * 2];
              const value = dataRow[headerIndex * 2 + 1];
              if (country && value) formattedData.push([country, value]);
            });
          });
          currentBlock = [];
        }
        // Nueva cabecera: tomar elementos en índices pares (0, 2, 4...)
        currentHeaderGroup = row.filter((_, idx) => idx % 2 === 0 && row[idx] !== '');
      } else {
        currentBlock.push(row);
      }
    });

    // Procesar el último bloque
    if (currentHeaderGroup.length > 0) {
      currentHeaderGroup.forEach((header, headerIndex) => {
        formattedData.push(header);
        currentBlock.forEach(dataRow => {
          const country = dataRow[headerIndex * 2];
          const value = dataRow[headerIndex * 2 + 1];
          if (country && value) formattedData.push([country, value]);
        });
      });
    }

    console.log(formattedData);


    return res.status(200).json(formattedData);
    
  } catch (error) {
    console.error('Error en la API:', error);
    return res.status(500).json({ 
      error: 'Error al obtener datos',
      details: error.message,
      solution: 'Verificar refresh token y permisos de la hoja'
    });
  }
}