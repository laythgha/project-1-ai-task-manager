const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/oauth2callback'
);
oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

function encodeMessage({ to, from, subject, text }) {
  const message = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, '', text].join('\r\n');
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendGmailEmail({ to, subject, text }) {
  const raw = encodeMessage({ to, from: process.env.GMAIL_USER, subject, text });
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
}

module.exports = { sendGmailEmail };
