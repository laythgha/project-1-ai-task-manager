const { can } = require('../src/permissions');

// These tests encode the permissions matrix from the project brief directly,
// so a typo in permissions.js that drifts from the spec fails loudly here
// instead of surfacing later as a silent authorization bug in the API.

describe('workspace settings module', () => {
  test('Owner can create, read, update, delete', () => {
    expect(can('Owner', 'workspace', 'create')).toBe(true);
    expect(can('Owner', 'workspace', 'read')).toBe(true);
    expect(can('Owner', 'workspace', 'update')).toBe(true);
    expect(can('Owner', 'workspace', 'delete')).toBe(true);
  });

  test('Admin can read and update, but not create or delete', () => {
    expect(can('Admin', 'workspace', 'read')).toBe(true);
    expect(can('Admin', 'workspace', 'update')).toBe(true);
    expect(can('Admin', 'workspace', 'create')).toBe(false);
    expect(can('Admin', 'workspace', 'delete')).toBe(false);
  });

  test('Member can only read', () => {
    expect(can('Member', 'workspace', 'read')).toBe(true);
    expect(can('Member', 'workspace', 'create')).toBe(false);
    expect(can('Member', 'workspace', 'update')).toBe(false);
    expect(can('Member', 'workspace', 'delete')).toBe(false);
  });

  test('Viewer can only read', () => {
    expect(can('Viewer', 'workspace', 'read')).toBe(true);
    expect(can('Viewer', 'workspace', 'create')).toBe(false);
    expect(can('Viewer', 'workspace', 'update')).toBe(false);
    expect(can('Viewer', 'workspace', 'delete')).toBe(false);
  });
});

describe('workspace members module', () => {
  test('Owner can create, read, update, delete', () => {
    expect(can('Owner', 'member', 'create')).toBe(true);
    expect(can('Owner', 'member', 'read')).toBe(true);
    expect(can('Owner', 'member', 'update')).toBe(true);
    expect(can('Owner', 'member', 'delete')).toBe(true);
  });

  test('Admin can create, read, update, but NOT delete', () => {
    expect(can('Admin', 'member', 'create')).toBe(true);
    expect(can('Admin', 'member', 'read')).toBe(true);
    expect(can('Admin', 'member', 'update')).toBe(true);
    expect(can('Admin', 'member', 'delete')).toBe(false);
  });

  test('Member can only read', () => {
    expect(can('Member', 'member', 'read')).toBe(true);
    expect(can('Member', 'member', 'create')).toBe(false);
    expect(can('Member', 'member', 'update')).toBe(false);
    expect(can('Member', 'member', 'delete')).toBe(false);
  });

  test('Viewer can only read', () => {
    expect(can('Viewer', 'member', 'read')).toBe(true);
    expect(can('Viewer', 'member', 'create')).toBe(false);
  });
});

describe('project module', () => {
  test('Owner can create, read, update, delete', () => {
    expect(can('Owner', 'project', 'create')).toBe(true);
    expect(can('Owner', 'project', 'delete')).toBe(true);
  });

  test('Admin can create, read, update, delete', () => {
    expect(can('Admin', 'project', 'create')).toBe(true);
    expect(can('Admin', 'project', 'read')).toBe(true);
    expect(can('Admin', 'project', 'update')).toBe(true);
    expect(can('Admin', 'project', 'delete')).toBe(true);
  });

  test('Member can create, read, update, but NOT delete', () => {
    expect(can('Member', 'project', 'create')).toBe(true);
    expect(can('Member', 'project', 'read')).toBe(true);
    expect(can('Member', 'project', 'update')).toBe(true);
    expect(can('Member', 'project', 'delete')).toBe(false);
  });

  test('Viewer can only read', () => {
    expect(can('Viewer', 'project', 'read')).toBe(true);
    expect(can('Viewer', 'project', 'create')).toBe(false);
    expect(can('Viewer', 'project', 'update')).toBe(false);
    expect(can('Viewer', 'project', 'delete')).toBe(false);
  });
});

describe('task module', () => {
  test('Owner, Admin, and Member can all fully manage tasks', () => {
    for (const role of ['Owner', 'Admin', 'Member']) {
      expect(can(role, 'task', 'create')).toBe(true);
      expect(can(role, 'task', 'read')).toBe(true);
      expect(can(role, 'task', 'update')).toBe(true);
      expect(can(role, 'task', 'delete')).toBe(true);
    }
  });

  test('Viewer can only read tasks — this is the case the brief calls out explicitly', () => {
    expect(can('Viewer', 'task', 'read')).toBe(true);
    expect(can('Viewer', 'task', 'create')).toBe(false);
    expect(can('Viewer', 'task', 'update')).toBe(false);
    expect(can('Viewer', 'task', 'delete')).toBe(false);
  });
});

describe('reminder module (additional module introduced beyond the brief matrix)', () => {
  test('Owner, Admin, and Member can fully manage reminders', () => {
    for (const role of ['Owner', 'Admin', 'Member']) {
      expect(can(role, 'reminder', 'create')).toBe(true);
      expect(can(role, 'reminder', 'delete')).toBe(true);
    }
  });

  test('Viewer can only read reminders', () => {
    expect(can('Viewer', 'reminder', 'read')).toBe(true);
    expect(can('Viewer', 'reminder', 'create')).toBe(false);
  });
});

describe('edge cases', () => {
  test('a null role (not a workspace member) is denied everything', () => {
    expect(can(null, 'task', 'read')).toBe(false);
    expect(can(undefined, 'workspace', 'read')).toBe(false);
  });

  test('an unknown module is denied', () => {
    expect(can('Owner', 'not_a_real_module', 'read')).toBe(false);
  });

  test('an unknown role is denied', () => {
    expect(can('SuperAdmin', 'task', 'read')).toBe(false);
  });

  test('an unknown action on a real role/module is denied', () => {
    expect(can('Owner', 'task', 'not_a_real_action')).toBe(false);
  });
});
