// Creates a dedicated task_manager_test database (separate from your dev
// database), applies all Prisma migrations to it, and seeds the four
// workspace roles. Safe to run more than once. Run with: npm run test:setup
require('dotenv').config();
const { Client } = require('pg');
const { execSync } = require('child_process');

const devUrl = process.env.DATABASE_URL;
if (!devUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const testUrl = devUrl.replace(/\/([^/?]+)(\?.*)?$/, '/task_manager_test$2');
const adminUrl = devUrl.replace(/\/([^/?]+)(\?.*)?$/, '/postgres$2');

async function main() {
  const adminClient = new Client({ connectionString: adminUrl });
  await adminClient.connect();
  try {
    await adminClient.query('CREATE DATABASE task_manager_test');
    console.log('Created task_manager_test database.');
  } catch (err) {
    if (err.code === '42P04') {
      console.log('task_manager_test database already exists.');
    } else {
      throw err;
    }
  }
  await adminClient.end();

  console.log('Applying migrations to task_manager_test...');
  execSync('npx prisma migrate deploy', {
    cwd: __dirname + '/..',
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });

  const testClient = new Client({ connectionString: testUrl });
  await testClient.connect();
  for (const roleName of ['Owner', 'Admin', 'Member', 'Viewer']) {
    const existing = await testClient.query('SELECT id FROM "Roles" WHERE role_name = $1', [roleName]);
    if (existing.rows.length === 0) {
      await testClient.query('INSERT INTO "Roles" (role_name) VALUES ($1)', [roleName]);
      console.log(`Seeded role: ${roleName}`);
    }
  }
  await testClient.end();

  console.log('Test database ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
