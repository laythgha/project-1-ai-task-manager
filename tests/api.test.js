const request = require('supertest');
const app = require('../src/index');

const suffix = Math.random().toString(36).slice(2, 8);

async function signup(name, emailPrefix) {
  const email = `${emailPrefix}-${suffix}@test.com`;
  const res = await request(app).post('/signup').send({ name, email, password: 'password123' });
  return { userId: res.body.userId, token: res.body.token, email };
}

describe('authentication', () => {
  test('signup returns a usable token', async () => {
    const res = await request(app)
      .post('/signup')
      .send({ name: 'Auth Test', email: `auth-${suffix}@test.com`, password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.userId).toBeDefined();
  });

  test('login with the wrong password is rejected', async () => {
    await request(app)
      .post('/signup')
      .send({ name: 'Wrong Pw', email: `wrongpw-${suffix}@test.com`, password: 'correct-password' });
    const res = await request(app)
      .post('/login')
      .send({ email: `wrongpw-${suffix}@test.com`, password: 'incorrect-password' });
    expect(res.status).toBe(401);
  });

  test('a protected route with no Authorization header is rejected with 401', async () => {
    const res = await request(app).post('/workspaces').send({ workspace_name: 'No Auth' });
    expect(res.status).toBe(401);
  });

  test('a protected route with a garbage token is rejected with 401', async () => {
    const res = await request(app)
      .post('/workspaces')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ workspace_name: 'Bad Token' });
    expect(res.status).toBe(401);
  });

  test('claiming a user_id in the request body with no token no longer works (the old vulnerability)', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ task_name: 'Spoofed task', project_id: 1, user_id: 1 });
    expect(res.status).toBe(401);
  });
});

describe('role-based permissions across the workspace hierarchy', () => {
  let owner, admin, member, viewer, outsider;
  let workspaceId, projectId, taskId;

  beforeAll(async () => {
    owner = await signup('Owner User', 'owner');
    admin = await signup('Admin User', 'admin');
    member = await signup('Member User', 'member');
    viewer = await signup('Viewer User', 'viewer');
    outsider = await signup('Outsider User', 'outsider');

    const wsRes = await request(app)
      .post('/workspaces')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ workspace_name: `Test Workspace ${suffix}` });
    workspaceId = wsRes.body.workspaceId;

    for (const [user, role] of [[admin, 'Admin'], [member, 'Member'], [viewer, 'Viewer']]) {
      const res = await request(app)
        .post(`/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: user.email, role_name: role });
      expect(res.status).toBe(200);
    }

    const projRes = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ project_name: 'Test Project', workspace_id: workspaceId });
    projectId = projRes.body.projectId;

    const taskRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ task_name: 'Test Task', project_id: projectId });
    taskId = taskRes.body.taskId;
  });

  test('workspace creator automatically becomes Owner', async () => {
    const res = await request(app)
      .get(`/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${owner.token}`);
    const ownerMembership = res.body.find((m) => m.user_id === owner.userId);
    expect(ownerMembership.role_name).toBe('Owner');
  });

  test('Viewer can read tasks but cannot create one', async () => {
    const readRes = await request(app)
      .get(`/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(readRes.status).toBe(200);

    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ task_name: 'Viewer should not be able to make this', project_id: projectId });
    expect(createRes.status).toBe(403);
  });

  test('Viewer sending a delete request directly to the API gets a real permission error, not a hidden button', async () => {
    const res = await request(app)
      .delete(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBeDefined();

    const stillThere = await request(app)
      .get(`/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(stillThere.body.some((t) => t.id === taskId)).toBe(true);
  });

  test('Member can create and delete tasks, but cannot delete a project', async () => {
    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ task_name: 'Member task', project_id: projectId });
    expect(createRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/tasks/${createRes.body.taskId}`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(deleteRes.status).toBe(200);

    const deleteProjectRes = await request(app)
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(deleteProjectRes.status).toBe(403);
  });

  test('Admin can delete a project, but cannot delete the workspace itself', async () => {
    const throwawayProject = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ project_name: 'Throwaway', workspace_id: workspaceId });
    const deleteRes = await request(app)
      .delete(`/projects/${throwawayProject.body.projectId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleteRes.status).toBe(200);

    const deleteWorkspaceRes = await request(app)
      .delete(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleteWorkspaceRes.status).toBe(403);
  });

  test('Admin cannot remove a member (only Owner can), but can still update a member role', async () => {
    const removeRes = await request(app)
      .delete(`/workspaces/${workspaceId}/members/${viewer.userId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(removeRes.status).toBe(403);

    const updateRes = await request(app)
      .patch(`/workspaces/${workspaceId}/members/${viewer.userId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role_name: 'Member' });
    expect(updateRes.status).toBe(200);

    await request(app)
      .patch(`/workspaces/${workspaceId}/members/${viewer.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role_name: 'Viewer' });
  });

  test('someone with no membership in the workspace at all is denied, not just downgraded', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ task_name: 'Outsider task', project_id: projectId });
    expect(res.status).toBe(403);
  });

  test('permission is derived from the task\'s real workspace, not a client-supplied workspace_id (regression test for the spoofing bug)', async () => {
    // outsider creates their OWN workspace where they are legitimately Owner
    const otherWsRes = await request(app)
      .post('/workspaces')
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ workspace_name: `Outsider Workspace ${suffix}` });
    expect(otherWsRes.body.workspaceId).toBeDefined();

    // They try to delete a task from the FIRST workspace (where they have no role),
    // while asserting a misleading workspace_id pointing at their own workspace,
    // where they really are Owner. This must still fail, because the server
    // should resolve workspace_id from the task itself, not trust the body.
    const res = await request(app)
      .delete(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ workspace_id: otherWsRes.body.workspaceId });
    expect(res.status).toBe(403);
  });
});
