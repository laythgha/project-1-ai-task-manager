require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const { PrismaClient } = require('./generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const { generateToken, authenticate } = require('./auth');
const { can } = require('./permissions');
const { sendGmailEmail } = require('./gmail');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

const http = require('http');
const { Server } = require('socket.io');
if (require.main === module) {
  setInterval(async () => {
    const now = new Date();

    const dueReminders = await prisma.reminders.findMany({
      where: {
        reminder_date: { lte: now },
        sent: false
      }
    });

    for (const reminder of dueReminders) {
      await sendReminderEmail(reminder);
      console.log(`Sent reminder email for reminder ${reminder.id}`);
    }
  }, 60000);
}

const tools = [
  {
    name: "create_task",
    description: "Create a new task in a project",
    input_schema: {
      type: "object",
      properties: {
        task_name: { type: "string" },
        project_id: { type: "integer" }
      },
      required: ["task_name", "project_id"]
    }
  },
  {
    name: "update_task",
    description: "Update an existing task's name or priority",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "integer" },
        task_name: { type: "string" },
        priority: { type: "string", enum: ["Low", "Medium", "High"] }
      },
      required: ["task_id"]
    }
  },
  {
    name: "create_reminder",
    description: "Create a reminder for a task at a specific date and time",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "integer" },
        remind_at: { type: "string", description: "ISO 8601 date-time string" }
      },
      required: ["task_id", "remind_at"]
    }
  },
  {
    name: "delete_task",
    description: "Delete an existing task",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "integer" }
      },
      required: ["task_id"]
    }
  }
];

app.use(express.json());
app.use(passport.initialize());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.BACKEND_URL + "/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  let user = await prisma.users.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.users.create({
      data: {
        name: profile.displayName,
        email: email,
        password_hashed: '',
        signin_method: 'google'
      }
    });
  }
  return done(null, user);
}));

async function getUserRoleInWorkspace(user_id, workspace_id) {
  const membership = await prisma.workspaceMembership.findFirst({
    where: { user_id, workspace_id },
    include: { role: true }
  });
  if (!membership) return null;
  return membership.role.role_name;
}

async function authorize(req, res, workspace_id, module, action) {
  const role = await getUserRoleInWorkspace(req.user_id, workspace_id);
  if (!can(role, module, action)) {
    res.status(403).send({ message: `Your role does not allow you to ${action} this ${module}` });
    return null;
  }
  return role;
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});
async function sendReminderEmail(reminder) {
  const task = await prisma.tasks.findUnique({
    where: { id: reminder.task_id },
    include: {
      project: {
        include: { workspace: true }
      }
    }
  });

  if (!reminder.user_id) {
    console.log(`Reminder ${reminder.id} has no recipient, skipping email`);
    await prisma.reminders.update({
      where: { id: reminder.id },
      data: { sent: true }
    });
    return;
  }

  const user = await prisma.users.findUnique({ where: { id: reminder.user_id } });

  await sendGmailEmail({
    to: user.email,
    subject: `Reminder: ${task.task_name}`,
    text: `This is a reminder for your task "${task.task_name}" in project "${task.project.project_name}" (workspace: "${task.project.workspace.workspace_name}").`
  });

  await prisma.reminders.update({
    where: { id: reminder.id },
    data: { sent: true }
  });
}
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  socket.on('join_workspace', (workspace_id) => {
    socket.join(`workspace_${workspace_id}`);
  });

  socket.on('disconnect', () => {
    console.log('A client disconnected:', socket.id);
  });
});
const PORT = process.env.PORT || 3000;

const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

app.get('/', (req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.send('Task Manager API is running');
});

app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const password_hashed = await bcrypt.hash(password, 10);
  const user = await prisma.users.create({
    data: {
      name,
      email,
      password_hashed,
      signin_method: 'password'
    }
  });
  const token = generateToken(user.id);
  res.send({ message: 'User created', userId: user.id, token });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).send({ message: 'Invalid email or password' });
  }
  const passwordMatches = await bcrypt.compare(password, user.password_hashed);
  if (!passwordMatches) {
    return res.status(401).send({ message: 'Invalid email or password' });
  }
  const token = generateToken(user.id);
  res.send({ message: 'Login successful', userId: user.id, token });
});

app.get('/me', authenticate, async (req, res) => {
  const user = await prisma.users.findUnique({ where: { id: req.user_id } });
  if (!user) {
    return res.status(404).send({ message: 'User not found' });
  }
  res.send({ id: user.id, name: user.name, email: user.email });
});

app.post('/workspaces', authenticate, async (req, res) => {
  const { workspace_name } = req.body;
  const workspace = await prisma.workspaces.create({
    data: { workspace_name }
  });
  const ownerRole = await prisma.roles.findFirst({ where: { role_name: 'Owner' } });
  await prisma.workspaceMembership.create({
    data: {
      user_id: req.user_id,
      workspace_id: workspace.id,
      role_id: ownerRole.id
    }
  });
  res.send({ message: 'Workspace created', workspaceId: workspace.id });
});

app.patch('/workspaces/:id', authenticate, async (req, res) => {
  const workspace_id = parseInt(req.params.id);
  const { workspace_name } = req.body;
  const role = await authorize(req, res, workspace_id, 'workspace', 'update');
  if (!role) return;
  const workspace = await prisma.workspaces.update({
    where: { id: workspace_id },
    data: { workspace_name }
  });
  io.to(`workspace_${workspace_id}`).emit('workspace_updated', workspace);
  res.send({ message: 'Workspace updated', workspace });
});

app.delete('/workspaces/:id', authenticate, async (req, res) => {
  const workspace_id = parseInt(req.params.id);
  const role = await authorize(req, res, workspace_id, 'workspace', 'delete');
  if (!role) return;
  await prisma.workspaces.delete({ where: { id: workspace_id } });
  io.to(`workspace_${workspace_id}`).emit('workspace_deleted', { id: workspace_id });
  res.send({ message: 'Workspace deleted' });
});

app.post('/projects', authenticate, async (req, res) => {
  const { project_name, workspace_id } = req.body;
  const role = await authorize(req, res, workspace_id, 'project', 'create');
  if (!role) return;
  const project = await prisma.projects.create({
    data: { project_name, workspace_id }
  });
  io.to(`workspace_${workspace_id}`).emit('project_created', project);
  res.send({ message: 'Project created', projectId: project.id });
});

app.get('/workspaces/:workspace_id/projects', authenticate, async (req, res) => {
  const workspace_id = parseInt(req.params.workspace_id);
  const role = await authorize(req, res, workspace_id, 'project', 'read');
  if (!role) return;
  const projects = await prisma.projects.findMany({
    where: { workspace_id }
  });
  res.send(projects);
});

app.delete('/projects/:id', authenticate, async (req, res) => {
  const project_id = parseInt(req.params.id);
  const project = await prisma.projects.findUnique({ where: { id: project_id } });
  if (!project) {
    return res.status(404).send({ message: 'Project not found' });
  }
  const workspace_id = project.workspace_id;
  const role = await authorize(req, res, workspace_id, 'project', 'delete');
  if (!role) return;
  await prisma.projects.delete({ where: { id: project_id } });
  io.to(`workspace_${workspace_id}`).emit('project_deleted', { id: project_id });
  res.send({ message: 'Project deleted' });
});

app.get('/workspaces/:workspace_id/members', authenticate, async (req, res) => {
  const workspace_id = parseInt(req.params.workspace_id);
  const role = await authorize(req, res, workspace_id, 'member', 'read');
  if (!role) return;
  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspace_id },
    include: { user: true, role: true }
  });
  const members = memberships.map((m) => ({
    user_id: m.user_id,
    name: m.user.name,
    email: m.user.email,
    role_name: m.role.role_name
  }));
  res.send(members);
});

app.post('/workspaces/:workspace_id/members', authenticate, async (req, res) => {
  const workspace_id = parseInt(req.params.workspace_id);
  const { email, role_name } = req.body;
  const role = await authorize(req, res, workspace_id, 'member', 'create');
  if (!role) return;
  const targetUser = await prisma.users.findUnique({ where: { email } });
  if (!targetUser) {
    return res.status(404).send({ message: 'No user found with that email. They need to sign up first.' });
  }
  const existingMembership = await prisma.workspaceMembership.findFirst({
    where: { user_id: targetUser.id, workspace_id }
  });
  if (existingMembership) {
    return res.status(409).send({ message: 'This user is already a member of the workspace' });
  }
  const targetRole = await prisma.roles.findFirst({ where: { role_name } });
  if (!targetRole) {
    return res.status(400).send({ message: 'Invalid role' });
  }
  await prisma.workspaceMembership.create({
    data: { user_id: targetUser.id, workspace_id, role_id: targetRole.id }
  });
  const member = { user_id: targetUser.id, name: targetUser.name, email: targetUser.email, role_name: targetRole.role_name };
  io.to(`workspace_${workspace_id}`).emit('member_added', member);
  res.send({ message: 'Member added', member });
});

app.patch('/workspaces/:workspace_id/members/:user_id', authenticate, async (req, res) => {
  const workspace_id = parseInt(req.params.workspace_id);
  const target_user_id = parseInt(req.params.user_id);
  const { role_name } = req.body;
  const role = await authorize(req, res, workspace_id, 'member', 'update');
  if (!role) return;
  const targetRole = await prisma.roles.findFirst({ where: { role_name } });
  if (!targetRole) {
    return res.status(400).send({ message: 'Invalid role' });
  }
  const membership = await prisma.workspaceMembership.findFirst({
    where: { user_id: target_user_id, workspace_id }
  });
  if (!membership) {
    return res.status(404).send({ message: 'Member not found in this workspace' });
  }
  await prisma.workspaceMembership.update({
    where: { id: membership.id },
    data: { role_id: targetRole.id }
  });
  io.to(`workspace_${workspace_id}`).emit('member_updated', { user_id: target_user_id, role_name: targetRole.role_name });
  res.send({ message: 'Member role updated' });
});

app.delete('/workspaces/:workspace_id/members/:user_id', authenticate, async (req, res) => {
  const workspace_id = parseInt(req.params.workspace_id);
  const target_user_id = parseInt(req.params.user_id);
  const role = await authorize(req, res, workspace_id, 'member', 'delete');
  if (!role) return;
  const membership = await prisma.workspaceMembership.findFirst({
    where: { user_id: target_user_id, workspace_id }
  });
  if (!membership) {
    return res.status(404).send({ message: 'Member not found in this workspace' });
  }
  await prisma.workspaceMembership.delete({ where: { id: membership.id } });
  io.to(`workspace_${workspace_id}`).emit('member_removed', { user_id: target_user_id });
  res.send({ message: 'Member removed' });
});

app.get('/users/:user_id/workspaces', authenticate, async (req, res) => {
  const user_id = parseInt(req.params.user_id);
  if (user_id !== req.user_id) {
    return res.status(403).send({ message: 'You can only view your own workspaces' });
  }

  const memberships = await prisma.workspaceMembership.findMany({
    where: { user_id },
    include: { workspace: true }
  });

  const workspaces = memberships.map(m => m.workspace);

  res.send(workspaces);
});

app.post('/tasks', authenticate, async (req, res) => {
  const { task_name, description, status, priority, due_date, assignee_id, estimated_hours, project_id } = req.body;

  const project = await prisma.projects.findUnique({ where: { id: project_id } });
  if (!project) {
    return res.status(404).send({ message: 'Project not found' });
  }
  const workspace_id = project.workspace_id;

  const role = await authorize(req, res, workspace_id, 'task', 'create');
  if (!role) return;

  const task = await prisma.tasks.create({
    data: {
      task_name,
      project_id,
      description,
      status,
      priority,
      due_date: due_date ? new Date(due_date) : undefined,
      assignee_id,
      estimated_hours
    }
  });

  io.to(`workspace_${workspace_id}`).emit('task_created', task);

  res.send({ message: 'Task created', taskId: task.id });
});

app.get('/projects/:project_id/tasks', authenticate, async (req, res) => {
  const project_id = parseInt(req.params.project_id);
  const project = await prisma.projects.findUnique({ where: { id: project_id } });
  if (!project) {
    return res.status(404).send({ message: 'Project not found' });
  }
  const role = await authorize(req, res, project.workspace_id, 'task', 'read');
  if (!role) return;
  const tasks = await prisma.tasks.findMany({
    where: { project_id }
  });
  res.send(tasks);
});

app.patch('/tasks/:id', authenticate, async (req, res) => {
  const task_id = parseInt(req.params.id);
  const { task_name, description, status, priority, due_date, assignee_id, estimated_hours } = req.body;

  const existingTask = await prisma.tasks.findUnique({ where: { id: task_id }, include: { project: true } });
  if (!existingTask) {
    return res.status(404).send({ message: 'Task not found' });
  }
  const workspace_id = existingTask.project.workspace_id;

  const role = await authorize(req, res, workspace_id, 'task', 'update');
  if (!role) return;

  const task = await prisma.tasks.update({
    where: { id: task_id },
    data: {
      task_name,
      description,
      status,
      priority,
      due_date: due_date ? new Date(due_date) : undefined,
      assignee_id,
      estimated_hours
    }
  });

  io.to(`workspace_${workspace_id}`).emit('task_updated', task);

  res.send({ message: 'Task updated', task });
});

app.delete('/tasks/:id', authenticate, async (req, res) => {
  const task_id = parseInt(req.params.id);
  const existingTask = await prisma.tasks.findUnique({ where: { id: task_id }, include: { project: true } });
  if (!existingTask) {
    return res.status(404).send({ message: 'Task not found' });
  }
  const workspace_id = existingTask.project.workspace_id;
  const role = await authorize(req, res, workspace_id, 'task', 'delete');
  if (!role) return;
  await prisma.tasks.delete({ where: { id: task_id } });
  io.to(`workspace_${workspace_id}`).emit('task_deleted', { id: task_id });
  res.send({ message: 'Task deleted' });
});

app.post('/reminders', authenticate, async (req, res) => {
  const { task_id, remind_at, recipient_id } = req.body;
  const existingTask = await prisma.tasks.findUnique({ where: { id: task_id }, include: { project: true } });
  if (!existingTask) {
    return res.status(404).send({ message: 'Task not found' });
  }
  const workspace_id = existingTask.project.workspace_id;
  const role = await authorize(req, res, workspace_id, 'reminder', 'create');
  if (!role) return;
  const recipientRole = await getUserRoleInWorkspace(recipient_id, workspace_id);
  if (!recipientRole) {
    return res.status(400).send({ message: 'Selected recipient is not a member of this workspace' });
  }
  const reminder = await prisma.reminders.create({
    data: {
      task_id,
      user_id: recipient_id,
      reminder_date: new Date(remind_at),
      sent: false
    }
  });
  io.to(`workspace_${workspace_id}`).emit('reminder_created', reminder);
  res.send({ message: 'Reminder created', reminderId: reminder.id });
});

app.post('/chat', authenticate, async (req, res) => {
  const { message, workspace_id } = req.body;
  const role = await getUserRoleInWorkspace(req.user_id, workspace_id);
  if (!role) {
    return res.status(403).send({ message: 'You are not a member of this workspace' });
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    system: `Today's date is ${new Date().toISOString().split('T')[0]}. When the user gives a relative or partial date (like "tomorrow" or "August 5th"), resolve it to a full date using today's date as reference.`,
    tools: tools,
    messages: [
      { role: 'user', content: message }
    ]
  });

  const toolUse = response.content.find(block => block.type === 'tool_use');

  if (!toolUse) {
    const textBlock = response.content.find(block => block.type === 'text');
    return res.send({ reply: textBlock.text });
  }

  if (toolUse.name === 'create_task') {
    if (!can(role, 'task', 'create')) {
      return res.status(403).send({ message: 'Your role does not allow creating tasks' });
    }
    const task = await prisma.tasks.create({
      data: {
        task_name: toolUse.input.task_name,
        project_id: toolUse.input.project_id
      }
    });
    io.to(`workspace_${workspace_id}`).emit('task_created', task);
    return res.send({ reply: `Created task: ${task.task_name}`, taskId: task.id });
  }

  if (toolUse.name === 'update_task') {
    if (!can(role, 'task', 'update')) {
      return res.status(403).send({ message: 'Your role does not allow updating tasks' });
    }
    const task = await prisma.tasks.update({
      where: { id: toolUse.input.task_id },
      data: {
        ...(toolUse.input.task_name && { task_name: toolUse.input.task_name }),
        ...(toolUse.input.priority && { priority: toolUse.input.priority })
      }
    });
    io.to(`workspace_${workspace_id}`).emit('task_updated', task);
    return res.send({ reply: `Updated task: ${task.task_name} (priority: ${task.priority})` });
  }

  if (toolUse.name === 'delete_task') {
    if (!can(role, 'task', 'delete')) {
      return res.status(403).send({ message: 'Your role does not allow deleting tasks' });
    }
    const task = await prisma.tasks.delete({
      where: { id: toolUse.input.task_id }
    });
    io.to(`workspace_${workspace_id}`).emit('task_deleted', { id: task.id });
    return res.send({ reply: `Deleted task: ${task.task_name}` });
  }

  if (toolUse.name === 'create_reminder') {
    if (!can(role, 'reminder', 'create')) {
      return res.status(403).send({ message: 'Your role does not allow creating reminders' });
    }
    const reminder = await prisma.reminders.create({
      data: {
        task_id: toolUse.input.task_id,
        user_id: req.user_id,
        reminder_date: new Date(toolUse.input.remind_at),
        sent: false
      }
    });
    io.to(`workspace_${workspace_id}`).emit('reminder_created', reminder);
    return res.send({ reply: `Reminder created for ${reminder.reminder_date}` });
  }

  res.status(400).send({ message: 'Unknown action requested' });
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/', session: false }),
  (req, res) => {
    const token = generateToken(req.user.id);
    res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);
  }
);
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
