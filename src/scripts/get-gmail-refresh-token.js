// One-time setup: obtains a refresh token authorizing this app to send email
// via the Gmail API as GMAIL_USER. Run once locally: node scripts/get-gmail-refresh-token.js
// Prerequisites (see README): the Gmail API must be enabled in Google Cloud
// Console, and http://localhost:3000/oauth2callback must be added to the
// OAuth client's Authorized redirect URIs.
require('dotenv').config();
const http = require('http');
const { google } = require('googleapis');

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
});

console.log('\nOpen this URL in your browser and sign in with the Gmail account reminders should be sent from:\n');
console.log(authUrl);
console.log('\nWaiting for you to approve access...\n');

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) {
    res.end();
    return;
  }
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  if (!code) {
    res.end('No authorization code received. Check the terminal for errors.');
    server.close();
    return;
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      res.end('Google did not return a refresh token. Revoke this app\'s access at https://myaccount.google.com/permissions and run this script again.');
      console.error('No refresh_token in response:', tokens);
    } else {
      res.end('Success! Refresh token printed in your terminal. You can close this tab.');
      console.log('\nAdd this to src/.env and to your Render backend environment variables:\n');
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    }
  } catch (err) {
    res.end('Failed to exchange code for tokens. Check the terminal for errors.');
    console.error(err);
  }
  server.close();
});

server.listen(3000);
