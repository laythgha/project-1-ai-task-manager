require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { betaTool } = require('@anthropic-ai/sdk/helpers/beta/json-schema');
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

// Builds the chat agent's tool set for one request. The tool list itself is the
// permission boundary: a tool is only ever added when `can(role, module, action)`
// allows it, so the model has no way to represent an action the user's role
// forbids — there's nothing to jailbreak into calling. `workspace_id` is closed
// over server-side (never an argument the model supplies), so a workspace-scoped
// tool can only ever act on the workspace the user is actually chatting from.
function buildChatTools({ role, workspace_id, user_id }) {
  const chatTools = [];

  // Global — creating or listing your own workspaces isn't scoped to any
  // existing workspace's role (mirrors POST /workspaces, which has no
  // authorize() check because the caller becomes Owner of a brand-new workspace).
  chatTools.push(betaTool({
    name: 'list_my_workspaces',
    description: "List all workspaces the current user belongs to, with their role in each.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const memberships = await prisma.workspaceMembership.findMany({
        where: { user_id },
        include: { workspace: true, role: true }
      });
      if (memberships.length === 0) return 'You are not a member of any workspaces yet.';
      return memberships
        .map((m) => `#${m.workspace.id} "${m.workspace.workspace_name}" — your role: ${m.role.role_name}`)
        .join('\n');
    }
  }));

  chatTools.push(betaTool({
    name: 'create_workspace',
    description: 'Create a brand new workspace. The current user becomes its Owner. Not restricted by role in any other workspace.',
    inputSchema: {
      type: 'object',
      properties: { workspace_name: { type: 'string', description: 'Name for the new workspace' } },
      required: ['workspace_name'],
      additionalProperties: false
    },
    run: async ({ workspace_name }) => {
      const workspace = await prisma.workspaces.create({ data: { workspace_name } });
      const ownerRole = await prisma.roles.findFirst({ where: { role_name: 'Owner' } });
      await prisma.workspaceMembership.create({
        data: { user_id, workspace_id: workspace.id, role_id: ownerRole.id }
      });
      return `Created workspace "${workspace_name}" (#${workspace.id}). You are its Owner.`;
    }
  }));

  if (!workspace_id || !role) return chatTools;

  // Read tools — every role, including Viewer, has 'read' on everything.
  chatTools.push(betaTool({
    name: 'list_projects',
    description: 'List all projects in the workspace the user is currently chatting from.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const projects = await prisma.projects.findMany({ where: { workspace_id } });
      if (projects.length === 0) return 'No projects in this workspace yet.';
      return projects.map((p) => `#${p.id} "${p.project_name}"`).join('\n');
    }
  }));

  chatTools.push(betaTool({
    name: 'list_tasks',
    description: 'List all tasks in a project. Call list_projects first to find the project_id.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'integer', description: 'ID of the project, from list_projects' } },
      required: ['project_id'],
      additionalProperties: false
    },
    run: async ({ project_id }) => {
      const project = await prisma.projects.findUnique({ where: { id: project_id } });
      if (!project || project.workspace_id !== workspace_id) return 'No such project in this workspace.';
      const tasks = await prisma.tasks.findMany({ where: { project_id } });
      if (tasks.length === 0) return `No tasks in "${project.project_name}" yet.`;
      return tasks
        .map((t) => `#${t.id} "${t.task_name}" — status: ${t.status}, priority: ${t.priority}` +
          (t.due_date ? `, due: ${t.due_date.toISOString().split('T')[0]}` : '') +
          (t.description ? `, notes: ${t.description}` : ''))
        .join('\n');
    }
  }));

  chatTools.push(betaTool({
    name: 'list_members',
    description: 'List all members of the current workspace with their roles.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const memberships = await prisma.workspaceMembership.findMany({
        where: { workspace_id },
        include: { user: true, role: true }
      });
      return memberships.map((m) => `${m.user.name} <${m.user.email}> — ${m.role.role_name}`).join('\n');
    }
  }));

  // Write tools — each only exists in the tool set when this role is allowed
  // the matching action, per the exact same permission matrix the REST API enforces.
  if (can(role, 'workspace', 'update')) {
    chatTools.push(betaTool({
      name: 'rename_workspace',
      description: 'Rename the current workspace.',
      inputSchema: {
        type: 'object',
        properties: { workspace_name: { type: 'string' } },
        required: ['workspace_name'],
        additionalProperties: false
      },
      run: async ({ workspace_name }) => {
        const workspace = await prisma.workspaces.update({ where: { id: workspace_id }, data: { workspace_name } });
        io.to(`workspace_${workspace_id}`).emit('workspace_updated', workspace);
        return `Renamed the workspace to "${workspace_name}".`;
      }
    }));
  }

  if (can(role, 'workspace', 'delete')) {
    chatTools.push(betaTool({
      name: 'delete_workspace',
      description: 'Delete the current workspace, including all of its projects and tasks. This cannot be undone.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      run: async () => {
        const workspace = await prisma.workspaces.findUnique({ where: { id: workspace_id } });
        await prisma.workspaces.delete({ where: { id: workspace_id } });
        io.to(`workspace_${workspace_id}`).emit('workspace_deleted', { id: workspace_id });
        return `Deleted workspace "${workspace?.workspace_name ?? workspace_id}".`;
      }
    }));
  }

  if (can(role, 'project', 'create')) {
    chatTools.push(betaTool({
      name: 'create_project',
      description: 'Create a new project in the current workspace.',
      inputSchema: {
        type: 'object',
        properties: { project_name: { type: 'string' } },
        required: ['project_name'],
        additionalProperties: false
      },
      run: async ({ project_name }) => {
        const project = await prisma.projects.create({ data: { project_name, workspace_id } });
        io.to(`workspace_${workspace_id}`).emit('project_created', project);
        return `Created project "${project_name}" (#${project.id}).`;
      }
    }));
  }

  if (can(role, 'project', 'delete')) {
    chatTools.push(betaTool({
      name: 'delete_project',
      description: 'Delete a project and all of its tasks. Call list_projects first to find the project_id.',
      inputSchema: {
        type: 'object',
        properties: { project_id: { type: 'integer' } },
        required: ['project_id'],
        additionalProperties: false
      },
      run: async ({ project_id }) => {
        const project = await prisma.projects.findUnique({ where: { id: project_id } });
        if (!project || project.workspace_id !== workspace_id) return 'No such project in this workspace.';
        await prisma.projects.delete({ where: { id: project_id } });
        io.to(`workspace_${workspace_id}`).emit('project_deleted', { id: project_id });
        return `Deleted project "${project.project_name}".`;
      }
    }));
  }

  if (can(role, 'task', 'create')) {
    chatTools.push(betaTool({
      name: 'create_task',
      description: 'Create a new task in a project. Call list_projects first to find the project_id.',
      inputSchema: {
        type: 'object',
        properties: {
          project_id: { type: 'integer' },
          task_name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['To Do', 'In Progress', 'Done'] },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
          due_date: { type: 'string', description: 'ISO 8601 date, e.g. 2026-08-05' },
          estimated_hours: { type: 'number' }
        },
        required: ['project_id', 'task_name'],
        additionalProperties: false
      },
      run: async ({ project_id, task_name, description, status, priority, due_date, estimated_hours }) => {
        const project = await prisma.projects.findUnique({ where: { id: project_id } });
        if (!project || project.workspace_id !== workspace_id) return 'No such project in this workspace.';
        const task = await prisma.tasks.create({
          data: {
            project_id,
            task_name,
            description,
            status: status || 'To Do',
            priority: priority || 'Medium',
            due_date: due_date ? new Date(due_date) : undefined,
            estimated_hours
          }
        });
        io.to(`workspace_${workspace_id}`).emit('task_created', task);
        return `Created task "${task_name}" (#${task.id}) in "${project.project_name}".`;
      }
    }));
  }

  if (can(role, 'task', 'update')) {
    chatTools.push(betaTool({
      name: 'update_task',
      description: 'Update a task — rename it, change its status, re-prioritize it, adjust its due date or description. Call list_tasks first to find the task_id.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'integer' },
          task_name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['To Do', 'In Progress', 'Done'] },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Use this to prioritize or re-prioritize a task' },
          due_date: { type: 'string', description: 'ISO 8601 date, e.g. 2026-08-05' },
          estimated_hours: { type: 'number' }
        },
        required: ['task_id'],
        additionalProperties: false
      },
      run: async ({ task_id, task_name, description, status, priority, due_date, estimated_hours }) => {
        const existing = await prisma.tasks.findUnique({ where: { id: task_id }, include: { project: true } });
        if (!existing || existing.project.workspace_id !== workspace_id) return 'No such task in this workspace.';
        const task = await prisma.tasks.update({
          where: { id: task_id },
          data: {
            ...(task_name !== undefined && { task_name }),
            ...(description !== undefined && { description }),
            ...(status !== undefined && { status }),
            ...(priority !== undefined && { priority }),
            ...(due_date !== undefined && { due_date: new Date(due_date) }),
            ...(estimated_hours !== undefined && { estimated_hours })
          }
        });
        io.to(`workspace_${workspace_id}`).emit('task_updated', task);
        return `Updated task "${task.task_name}" (status: ${task.status}, priority: ${task.priority}).`;
      }
    }));
  }

  if (can(role, 'task', 'delete')) {
    chatTools.push(betaTool({
      name: 'delete_task',
      description: 'Delete a task. Call list_tasks first to find the task_id.',
      inputSchema: {
        type: 'object',
        properties: { task_id: { type: 'integer' } },
        required: ['task_id'],
        additionalProperties: false
      },
      run: async ({ task_id }) => {
        const existing = await prisma.tasks.findUnique({ where: { id: task_id }, include: { project: true } });
        if (!existing || existing.project.workspace_id !== workspace_id) return 'No such task in this workspace.';
        await prisma.tasks.delete({ where: { id: task_id } });
        io.to(`workspace_${workspace_id}`).emit('task_deleted', { id: task_id });
        return `Deleted task "${existing.task_name}".`;
      }
    }));
  }

  if (can(role, 'reminder', 'create')) {
    chatTools.push(betaTool({
      name: 'create_reminder',
      description: 'Set a reminder for a task at a specific date and time. Call list_tasks first to find the task_id, and list_members first if setting it for someone other than the current user.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'integer' },
          remind_at: { type: 'string', description: 'ISO 8601 date-time string' },
          recipient_email: { type: 'string', description: "Email of the workspace member to remind. Defaults to the current user if omitted." }
        },
        required: ['task_id', 'remind_at'],
        additionalProperties: false
      },
      run: async ({ task_id, remind_at, recipient_email }) => {
        const existing = await prisma.tasks.findUnique({ where: { id: task_id }, include: { project: true } });
        if (!existing || existing.project.workspace_id !== workspace_id) return 'No such task in this workspace.';

        let recipient_id = user_id;
        if (recipient_email) {
          const recipientUser = await prisma.users.findUnique({ where: { email: recipient_email } });
          const recipientRole = recipientUser ? await getUserRoleInWorkspace(recipientUser.id, workspace_id) : null;
          if (!recipientUser || !recipientRole) return `${recipient_email} is not a member of this workspace.`;
          recipient_id = recipientUser.id;
        }

        const reminder = await prisma.reminders.create({
          data: { task_id, user_id: recipient_id, reminder_date: new Date(remind_at), sent: false }
        });
        io.to(`workspace_${workspace_id}`).emit('reminder_created', reminder);
        return `Reminder set for "${existing.task_name}" at ${reminder.reminder_date.toISOString()}.`;
      }
    }));
  }

  if (can(role, 'member', 'create')) {
    chatTools.push(betaTool({
      name: 'add_member',
      description: 'Invite an existing user to the current workspace by email, with a given role.',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          role_name: { type: 'string', enum: ['Owner', 'Admin', 'Member', 'Viewer'] }
        },
        required: ['email', 'role_name'],
        additionalProperties: false
      },
      run: async ({ email, role_name }) => {
        const targetUser = await prisma.users.findUnique({ where: { email } });
        if (!targetUser) return `No user found with email ${email}. They need to sign up first.`;
        const existingMembership = await prisma.workspaceMembership.findFirst({
          where: { user_id: targetUser.id, workspace_id }
        });
        if (existingMembership) return `${email} is already a member of this workspace.`;
        const targetRole = await prisma.roles.findFirst({ where: { role_name } });
        if (!targetRole) return `"${role_name}" is not a valid role.`;
        await prisma.workspaceMembership.create({
          data: { user_id: targetUser.id, workspace_id, role_id: targetRole.id }
        });
        const member = { user_id: targetUser.id, name: targetUser.name, email: targetUser.email, role_name: targetRole.role_name };
        io.to(`workspace_${workspace_id}`).emit('member_added', member);
        return `Added ${targetUser.name} <${email}> to the workspace as ${role_name}.`;
      }
    }));
  }

  if (can(role, 'member', 'update')) {
    chatTools.push(betaTool({
      name: 'update_member_role',
      description: "Change a workspace member's role. Call list_members first to confirm who's in the workspace.",
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          role_name: { type: 'string', enum: ['Owner', 'Admin', 'Member', 'Viewer'] }
        },
        required: ['email', 'role_name'],
        additionalProperties: false
      },
      run: async ({ email, role_name }) => {
        const targetUser = await prisma.users.findUnique({ where: { email } });
        if (!targetUser) return `No user found with email ${email}.`;
        const membership = await prisma.workspaceMembership.findFirst({
          where: { user_id: targetUser.id, workspace_id }
        });
        if (!membership) return `${email} is not a member of this workspace.`;
        const targetRole = await prisma.roles.findFirst({ where: { role_name } });
        if (!targetRole) return `"${role_name}" is not a valid role.`;
        await prisma.workspaceMembership.update({ where: { id: membership.id }, data: { role_id: targetRole.id } });
        io.to(`workspace_${workspace_id}`).emit('member_updated', { user_id: targetUser.id, role_name });
        return `${email} is now ${role_name}.`;
      }
    }));
  }

  if (can(role, 'member', 'delete')) {
    chatTools.push(betaTool({
      name: 'remove_member',
      description: "Remove a member from the current workspace (\"kick\" them). Call list_members first to confirm who's in the workspace.",
      inputSchema: {
        type: 'object',
        properties: { email: { type: 'string' } },
        required: ['email'],
        additionalProperties: false
      },
      run: async ({ email }) => {
        const targetUser = await prisma.users.findUnique({ where: { email } });
        if (!targetUser) return `No user found with email ${email}.`;
        const membership = await prisma.workspaceMembership.findFirst({
          where: { user_id: targetUser.id, workspace_id }
        });
        if (!membership) return `${email} is not a member of this workspace.`;
        await prisma.workspaceMembership.delete({ where: { id: membership.id } });
        io.to(`workspace_${workspace_id}`).emit('member_removed', { user_id: targetUser.id });
        return `Removed ${email} from the workspace.`;
      }
    }));
  }

  return chatTools;
}

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
    include: { workspace: true, role: true }
  });

  const workspaces = memberships.map(m => ({ ...m.workspace, role_name: m.role.role_name }));

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
  const { message, workspace_id, history } = req.body;
  if (!message) {
    return res.status(400).send({ message: 'message is required' });
  }

  let role = null;
  let workspace = null;
  if (workspace_id) {
    role = await getUserRoleInWorkspace(req.user_id, workspace_id);
    if (!role) {
      return res.status(403).send({ message: 'You are not a member of this workspace' });
    }
    workspace = await prisma.workspaces.findUnique({ where: { id: workspace_id } });
  }

  const chatTools = buildChatTools({ role, workspace_id: workspace_id || null, user_id: req.user_id });

  const systemPrompt = [
    'You are the AI assistant embedded in AI Task Manager, a workspace/project/task manager.',
    `Today's date is ${new Date().toISOString().split('T')[0]}. Resolve relative dates ("tomorrow", "August 5th") against it.`,
    workspace
      ? `The user is chatting from workspace "${workspace.workspace_name}" (#${workspace.id}), where their role is ${role}.`
      : 'The user is not currently viewing a specific workspace.',
    "The tools you were given already reflect exactly what this user's role permits — nothing more, nothing less. If they ask for something you have no tool for (e.g. a Viewer asking to create or delete something, or an Admin asking to remove a member), plainly say your role does not allow it and suggest who could (usually an Owner or Admin) — never claim to have done it.",
    'Look up IDs via list_projects / list_tasks / list_members before acting on something the user only named — do not guess IDs.',
    'Be concise.'
  ].join(' ');

  const conversationHistory = Array.isArray(history)
    ? history.slice(-20).map((entry) => ({
        role: entry.from === 'you' ? 'user' : 'assistant',
        content: entry.text
      }))
    : [];

  try {
    const finalMessage = await anthropic.beta.messages.toolRunner({
      model: 'claude-opus-5',
      max_tokens: 4096,
      system: systemPrompt,
      tools: chatTools,
      messages: [...conversationHistory, { role: 'user', content: message }],
      max_iterations: 8
    });

    if (finalMessage.stop_reason === 'refusal') {
      return res.send({ reply: "I can't help with that request." });
    }

    const textBlock = finalMessage.content.find((block) => block.type === 'text');
    return res.send({ reply: textBlock ? textBlock.text : "Done, but I don't have anything else to add." });
  } catch (err) {
    console.error('Chat agent error:', err);
    return res.status(500).send({ message: 'The AI assistant ran into an error. Please try again.' });
  }
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
