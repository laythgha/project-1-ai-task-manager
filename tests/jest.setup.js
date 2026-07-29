const fs = require('fs');
const path = require('path');

// dotenv's default config() reads from process.cwd(), but Jest runs from the
// repo root while the real .env lives in src/. Load it explicitly here so
// index.js has everything it needs (Google OAuth strategy setup, etc.) when
// required by the test suite.
const envPath = path.join(__dirname, '../src/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!match) continue;
  const [, key, rawValue] = match;
  const value = rawValue.trim().replace(/^"(.*)"$/, '$1');
  process.env[key] = value;
}

// Point tests at a separate database so the suite never touches dev data.
// Run `npm run test:setup` once beforehand to create/migrate/seed it.
process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\/([^/?]+)(\?.*)?$/, '/task_manager_test$2');
process.env.JWT_SECRET = 'test-secret-not-for-production';
