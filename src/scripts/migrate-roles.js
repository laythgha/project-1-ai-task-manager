// One-time data migration: moves the role model from the old
// Admin/Editor/Viewer set to the brief's Owner/Admin/Member/Viewer set.
// Existing memberships with role 'Admin' (previously the top role) become
// 'Owner'. Existing memberships with role 'Editor' become 'Member'.
// Safe to run more than once.
require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function getOrCreateRole(name) {
  let role = await prisma.roles.findFirst({ where: { role_name: name } });
  if (!role) {
    role = await prisma.roles.create({ data: { role_name: name } });
    console.log(`Created role: ${name}`);
  }
  return role;
}

async function main() {
  const owner = await getOrCreateRole('Owner');
  const member = await getOrCreateRole('Member');
  const admin = await prisma.roles.findFirst({ where: { role_name: 'Admin' } });
  const editor = await prisma.roles.findFirst({ where: { role_name: 'Editor' } });

  if (admin) {
    const result = await prisma.workspaceMembership.updateMany({
      where: { role_id: admin.id },
      data: { role_id: owner.id }
    });
    console.log(`Promoted ${result.count} Admin membership(s) to Owner`);
  }

  if (editor) {
    const result = await prisma.workspaceMembership.updateMany({
      where: { role_id: editor.id },
      data: { role_id: member.id }
    });
    console.log(`Migrated ${result.count} Editor membership(s) to Member`);

    const stillUsed = await prisma.workspaceMembership.findFirst({ where: { role_id: editor.id } });
    if (!stillUsed) {
      await prisma.roles.delete({ where: { id: editor.id } });
      console.log('Removed unused Editor role');
    }
  }

  console.log('Role migration complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
