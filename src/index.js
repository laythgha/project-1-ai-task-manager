require('dotenv').config();

const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const session = require('express-session');
const { PrismaClient } = require('./generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

const http = require('http');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
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
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

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
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

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

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await prisma.users.findUnique({ where: { id } });
  done(null, user);
});

async function getUserRoleInWorkspace(user_id, workspace_id) {
  const membership = await prisma.workspaceMembership.findFirst({
    where: { user_id, workspace_id },
    include: { role: true }
  });
  if (!membership) return null;
  return membership.role.role_name;
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

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
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

app.get('/', (req, res) => {
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
  res.send({ message: 'User created', userId: user.id });
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
  res.send({ message: 'Login successful', userId: user.id });
});

app.post('/workspaces', async (req, res) => {
  const { workspace_name, user_id } = req.body;
  const workspace = await prisma.workspaces.create({
    data: { workspace_name }
  });
  const adminRole = await prisma.roles.findFirst({ where: { role_name: 'Admin' } });
  await prisma.workspaceMembership.create({
    data: {
      user_id: user_id,
      workspace_id: workspace.id,
      role_id: adminRole.id
    }
  });
  res.send({ message: 'Workspace created', workspaceId: workspace.id });
});

app.post('/projects', async (req, res) => {
  const { project_name, workspace_id, user_id } = req.body;
  const role = await getUserRoleInWorkspace(user_id, workspace_id);
  if (role !== 'Admin' && role !== 'Editor') {
    return res.status(403).send({ message: 'Only Admins and Editors can create projects' });
  }
  const project = await prisma.projects.create({
    data: { project_name, workspace_id }
  });
  res.send({ message: 'Project created', projectId: project.id });
});

app.get('/workspaces/:workspace_id/projects', async (req, res) => {
  const workspace_id = parseInt(req.params.workspace_id);
  const projects = await prisma.projects.findMany({
    where: { workspace_id }
  });
  res.send(projects);
});

app.get('/workspaces/:workspace_id/members', async (req, res) => {
  const workspace_id = parseInt(req.params.workspace_id);
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

app.post('/workspaces/:workspace_id/members', async (req, res) => {
  const workspace_id = parseInt(req.params.workspace_id);
  const { email, role_name, user_id } = req.body;
  const role = await getUserRoleInWorkspace(user_id, workspace_id);
  if (role !== 'Admin') {
    return res.status(403).send({ message: 'Only Admins can add members' });
  }
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

app.patch('/workspaces/:workspace_id/members/:user_id', async (req, res) => {
  const workspace_id = parseInt(req.params.workspace_id);
  const target_user_id = parseInt(req.params.user_id);
  const { role_name, user_id } = req.body;
  const role = await getUserRoleInWorkspace(user_id, workspace_id);
  if (role !== 'Admin') {
    return res.status(403).send({ message: 'Only Admins can change member roles' });
  }
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

app.delete('/workspaces/:workspace_id/members/:user_id', async (req, res) => {
  const workspace_id = parseInt(req.params.workspace_id);
  const target_user_id = parseInt(req.params.user_id);
  const { user_id } = req.body;
  const role = await getUserRoleInWorkspace(user_id, workspace_id);
  if (role !== 'Admin') {
    return res.status(403).send({ message: 'Only Admins can remove members' });
  }
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


app.get('/users/:user_id/workspaces', async (req, res) => {
  const user_id = parseInt(req.params.user_id);

  const memberships = await prisma.workspaceMembership.findMany({
    where: { user_id },
    include: { workspace: true }
  });

  const workspaces = memberships.map(m => m.workspace);

  res.send(workspaces);
});


app.post('/tasks', async (req, res) => {
  const { task_name, description, status, priority, due_date, assignee_id, estimated_hours, project_id, user_id, workspace_id } = req.body;

  const role = await getUserRoleInWorkspace(user_id, workspace_id);

  if (role !== 'Admin' && role !== 'Editor') {
    return res.status(403).send({ message: 'Only Admins and Editors can create tasks' });
  }

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

app.get('/projects/:project_id/tasks', async (req, res) => {
  const project_id = parseInt(req.params.project_id);
  const tasks = await prisma.tasks.findMany({
    where: { project_id }
  });
  res.send(tasks);
});

app.delete('/projects/:id', async (req, res) => {
  const project_id = parseInt(req.params.id);
  const { user_id, workspace_id } = req.body;
  const role = await getUserRoleInWorkspace(user_id, workspace_id);
  if (role !== 'Admin' && role !== 'Editor') {
    return res.status(403).send({ message: 'Only Admins and Editors can delete projects' });
  }
  await prisma.projects.delete({ where: { id: project_id } });
  io.to(`workspace_${workspace_id}`).emit('project_deleted', { id: project_id });
  res.send({ message: 'Project deleted' });
});

app.patch('/tasks/:id', async (req, res) => {
  const task_id = parseInt(req.params.id);
  const { task_name, description, status, priority, due_date, assignee_id, estimated_hours, user_id, workspace_id } = req.body;

  const role = await getUserRoleInWorkspace(user_id, workspace_id);

  if (role !== 'Admin' && role !== 'Editor') {
    return res.status(403).send({ message: 'Only Admins and Editors can update tasks' });
  }

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

app.delete('/tasks/:id', async (req, res) => {
  const task_id = parseInt(req.params.id);
  const { user_id, workspace_id } = req.body;
  const role = await getUserRoleInWorkspace(user_id, workspace_id);
  if (role !== 'Admin' && role !== 'Editor') {
    return res.status(403).send({ message: 'Only Admins and Editors can delete tasks' });
  }
  await prisma.tasks.delete({ where: { id: task_id } });
  io.to(`workspace_${workspace_id}`).emit('task_deleted', { id: task_id });
  res.send({ message: 'Task deleted' });
});

app.post('/reminders', async (req, res) => {
  const { task_id, remind_at, user_id, recipient_id, workspace_id } = req.body;
  const role = await getUserRoleInWorkspace(user_id, workspace_id);
  if (role !== 'Admin' && role !== 'Editor') {
    return res.status(403).send({ message: 'Only Admins and Editors can create reminders' });
  }
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

app.post('/chat', async (req, res) => {
  const { message, user_id, workspace_id } = req.body;
  const role = await getUserRoleInWorkspace(user_id, workspace_id);
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
    if (role !== 'Admin' && role !== 'Editor') {
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
    if (role !== 'Admin' && role !== 'Editor') {
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
    if (role !== 'Admin' && role !== 'Editor') {
      return res.status(403).send({ message: 'Your role does not allow deleting tasks' });
    }
    const task = await prisma.tasks.delete({
      where: { id: toolUse.input.task_id }
    });
    io.to(`workspace_${workspace_id}`).emit('task_deleted', { id: task.id });
    return res.send({ reply: `Deleted task: ${task.task_name}` });
  }

  if (toolUse.name === 'create_reminder') {
    if (role !== 'Admin' && role !== 'Editor') {
      return res.status(403).send({ message: 'Your role does not allow creating reminders' });
    }
    const reminder = await prisma.reminders.create({
      data: {
        task_id: toolUse.input.task_id,
        user_id: user_id,
        reminder_date: new Date(toolUse.input.remind_at),
        sent: false
      }
    });
    io.to(`workspace_${workspace_id}`).emit('reminder_created', reminder);
    return res.send({ reply: `Reminder created for ${reminder.reminder_date}` });
  }

  res.status(400).send({ message: 'Unknown action requested' });
});

app.delete('/workspaces/:id', async (req, res) => {
  const workspace_id = parseInt(req.params.id);
  const { user_id } = req.body;
  const role = await getUserRoleInWorkspace(user_id, workspace_id);
  if (role !== 'Admin') {
    return res.status(403).send({ message: 'Only Admins can delete a workspace' });
  }
  await prisma.workspaces.delete({ where: { id: workspace_id } });
  io.to(`workspace_${workspace_id}`).emit('workspace_deleted', { id: workspace_id });
  res.send({ message: 'Workspace deleted' });
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}?userId=${req.user.id}`);
  }
);
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
