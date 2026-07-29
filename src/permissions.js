const ROLES = ['Owner', 'Admin', 'Member', 'Viewer'];

const PERMISSIONS = {
  workspace: {
    Owner: ['create', 'read', 'update', 'delete'],
    Admin: ['read', 'update'],
    Member: ['read'],
    Viewer: ['read'],
  },
  member: {
    Owner: ['create', 'read', 'update', 'delete'],
    Admin: ['create', 'read', 'update'],
    Member: ['read'],
    Viewer: ['read'],
  },
  project: {
    Owner: ['create', 'read', 'update', 'delete'],
    Admin: ['create', 'read', 'update', 'delete'],
    Member: ['create', 'read', 'update'],
    Viewer: ['read'],
  },
  task: {
    Owner: ['create', 'read', 'update', 'delete'],
    Admin: ['create', 'read', 'update', 'delete'],
    Member: ['create', 'read', 'update', 'delete'],
    Viewer: ['read'],
  },
  reminder: {
    Owner: ['create', 'read', 'update', 'delete'],
    Admin: ['create', 'read', 'update', 'delete'],
    Member: ['create', 'read', 'update', 'delete'],
    Viewer: ['read'],
  },
};

function can(role, module, action) {
  if (!role) return false;
  const modulePerms = PERMISSIONS[module];
  if (!modulePerms) return false;
  const rolePerms = modulePerms[role];
  if (!rolePerms) return false;
  return rolePerms.includes(action);
}

module.exports = { ROLES, PERMISSIONS, can };
