import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from './api';

const colors = {
  bg: '#f4f5f7',
  panel: '#ffffff',
  border: '#e2e4e9',
  text: '#1f2430',
  muted: '#6b7280',
  primary: '#4f46e5',
  primaryText: '#ffffff',
  danger: '#dc2626',
  success: '#16a34a',
};

const styles = {
  page: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    backgroundColor: colors.bg,
    minHeight: '100vh',
    color: colors.text,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    backgroundColor: colors.panel,
    borderBottom: `1px solid ${colors.border}`,
  },
  headerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
  },
  body: {
    display: 'flex',
    gap: 20,
    padding: 24,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  panel: {
    backgroundColor: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: 16,
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
  },
  panelTitle: {
    margin: '0 0 12px 0',
    fontSize: 14,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.muted,
  },
  list: { listStyle: 'none', padding: 0, margin: '0 0 12px 0' },
  listItem: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  itemButton: (active) => ({
    flex: 1,
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: active ? colors.primary : 'transparent',
    color: active ? colors.primaryText : colors.text,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  }),
  input: {
    backgroundColor: '#fff',
    color: colors.text,
    padding: 8,
    width: '100%',
    marginBottom: 6,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    boxSizing: 'border-box',
  },
  select: {
    backgroundColor: '#fff',
    color: colors.text,
    padding: 8,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
  },
  button: {
    padding: '8px 12px',
    borderRadius: 6,
    border: `1px solid ${colors.border}`,
    backgroundColor: '#fff',
    color: colors.text,
    cursor: 'pointer',
  },
  buttonPrimary: {
    padding: '8px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: colors.primary,
    color: colors.primaryText,
    cursor: 'pointer',
    fontWeight: 600,
    width: '100%',
    marginTop: 4,
  },
  buttonSmall: {
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 5,
    border: `1px solid ${colors.border}`,
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  taskCard: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    backgroundColor: '#fafbfc',
  },
  badge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 999,
    backgroundColor: '#eef0ff',
    color: colors.primary,
    marginLeft: 6,
  },
  errorText: { color: colors.danger, fontSize: 13, margin: '4px 0' },
  statusText: (ok) => ({ fontSize: 12, color: ok ? colors.success : colors.danger, marginTop: 4 }),
};

const ROLE_OPTIONS = ['Owner', 'Admin', 'Member', 'Viewer'];

function Dashboard({ userId, onLogout }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [renamingWorkspace, setRenamingWorkspace] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectError, setProjectError] = useState('');

  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState('To Do');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskHours, setNewTaskHours] = useState('');

  const [chatMessage, setChatMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);

  const [members, setMembers] = useState([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Member');
  const [memberError, setMemberError] = useState('');

  const [reminderInputs, setReminderInputs] = useState({});
  const [reminderRecipients, setReminderRecipients] = useState({});
  const [reminderStatus, setReminderStatus] = useState({});

  const [socket, setSocket] = useState(null);

  useEffect(() => {
    api.get(`/users/${userId}/workspaces`).then((res) => {
      setWorkspaces(res.data);
    });
  }, [userId]);

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL);
    setSocket(s);
    return () => s.disconnect();
  }, []);

  useEffect(() => {
    if (!socket || !activeWorkspace) return;

    socket.emit('join_workspace', activeWorkspace.id);

    const handleTaskCreated = (task) => {
      if (task.project_id === activeProject?.id) {
        setTasks((prev) => [...prev, task]);
      }
    };
    const handleTaskUpdated = (task) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    };
    const handleTaskDeleted = ({ id }) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    };
    const handleMemberAdded = (member) => {
      setMembers((prev) => [...prev, member]);
    };
    const handleMemberUpdated = ({ user_id, role_name }) => {
      setMembers((prev) => prev.map((m) => (m.user_id === user_id ? { ...m, role_name } : m)));
    };
    const handleMemberRemoved = ({ user_id }) => {
      setMembers((prev) => prev.filter((m) => m.user_id !== user_id));
    };
    const handleProjectDeleted = ({ id }) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setActiveProject((prev) => (prev?.id === id ? null : prev));
    };
    const handleProjectCreated = (project) => {
      setProjects((prev) => (prev.some((p) => p.id === project.id) ? prev : [...prev, project]));
    };
    const handleWorkspaceDeleted = ({ id }) => {
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      setActiveWorkspace((prev) => (prev?.id === id ? null : prev));
    };
    const handleWorkspaceUpdated = (workspace) => {
      setWorkspaces((prev) => prev.map((w) => (w.id === workspace.id ? workspace : w)));
      setActiveWorkspace((prev) => (prev?.id === workspace.id ? workspace : prev));
    };

    socket.on('task_created', handleTaskCreated);
    socket.on('task_updated', handleTaskUpdated);
    socket.on('task_deleted', handleTaskDeleted);
    socket.on('member_added', handleMemberAdded);
    socket.on('member_updated', handleMemberUpdated);
    socket.on('member_removed', handleMemberRemoved);
    socket.on('project_deleted', handleProjectDeleted);
    socket.on('project_created', handleProjectCreated);
    socket.on('workspace_deleted', handleWorkspaceDeleted);
    socket.on('workspace_updated', handleWorkspaceUpdated);

    return () => {
      socket.off('task_created', handleTaskCreated);
      socket.off('task_updated', handleTaskUpdated);
      socket.off('task_deleted', handleTaskDeleted);
      socket.off('member_added', handleMemberAdded);
      socket.off('member_updated', handleMemberUpdated);
      socket.off('member_removed', handleMemberRemoved);
      socket.off('project_deleted', handleProjectDeleted);
      socket.off('project_created', handleProjectCreated);
      socket.off('workspace_deleted', handleWorkspaceDeleted);
      socket.off('workspace_updated', handleWorkspaceUpdated);
    };
  }, [socket, activeWorkspace, activeProject]);

  useEffect(() => {
    if (!activeWorkspace) return;
    api.get(`/workspaces/${activeWorkspace.id}/projects`).then((res) => {
      setProjects(res.data);
      setActiveProject(null);
      setTasks([]);
    });
    api.get(`/workspaces/${activeWorkspace.id}/members`).then((res) => {
      setMembers(res.data);
    });
    setMemberError('');
    setRenamingWorkspace(false);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!activeProject) return;
    api.get(`/projects/${activeProject.id}/tasks`).then((res) => {
      setTasks(res.data);
    });
  }, [activeProject]);

  const createWorkspace = async () => {
    if (!newWorkspaceName) return;
    const res = await api.post('/workspaces', { workspace_name: newWorkspaceName });
    setWorkspaces((prev) => [...prev, { id: res.data.workspaceId, workspace_name: newWorkspaceName }]);
    setNewWorkspaceName('');
  };

  const renameWorkspace = async () => {
    if (!renameValue || !activeWorkspace) return;
    setWorkspaceError('');
    try {
      await api.patch(`/workspaces/${activeWorkspace.id}`, { workspace_name: renameValue });
      setRenamingWorkspace(false);
    } catch (err) {
      setWorkspaceError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const createProject = async () => {
    if (!newProjectName || !activeWorkspace) return;
    const res = await api.post('/projects', {
      project_name: newProjectName,
      workspace_id: activeWorkspace.id,
    });
    setProjects((prev) => [...prev, { id: res.data.projectId, project_name: newProjectName, workspace_id: activeWorkspace.id }]);
    setNewProjectName('');
  };

  const createTask = async () => {
    if (!newTaskName || !activeProject) return;
    await api.post('/tasks', {
      task_name: newTaskName,
      description: newTaskDescription,
      status: newTaskStatus,
      priority: newTaskPriority,
      due_date: newTaskDueDate || undefined,
      estimated_hours: newTaskHours ? parseFloat(newTaskHours) : undefined,
      project_id: activeProject.id,
    });
    setNewTaskName('');
    setNewTaskDescription('');
    setNewTaskStatus('To Do');
    setNewTaskPriority('Medium');
    setNewTaskDueDate('');
    setNewTaskHours('');
  };

  const deleteWorkspace = async (workspaceId) => {
    if (!window.confirm('Delete this workspace? This also deletes all its projects and tasks.')) return;
    setWorkspaceError('');
    try {
      await api.delete(`/workspaces/${workspaceId}`);
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
      if (activeWorkspace?.id === workspaceId) setActiveWorkspace(null);
    } catch (err) {
      setWorkspaceError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm('Delete this project? This also deletes all its tasks.')) return;
    setProjectError('');
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (activeProject?.id === projectId) setActiveProject(null);
    } catch (err) {
      setProjectError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      setReminderStatus((prev) => ({ ...prev, [taskId]: err.response?.data?.message || 'Something went wrong' }));
    }
  };

  const currentUserRole = members.find((m) => m.user_id === userId)?.role_name;
  const canManageMembers = currentUserRole === 'Owner' || currentUserRole === 'Admin';
  const canRemoveMembers = currentUserRole === 'Owner';

  const addMember = async () => {
    if (!newMemberEmail || !activeWorkspace) return;
    setMemberError('');
    try {
      await api.post(`/workspaces/${activeWorkspace.id}/members`, {
        email: newMemberEmail,
        role_name: newMemberRole,
      });
      setNewMemberEmail('');
      setNewMemberRole('Member');
    } catch (err) {
      setMemberError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const updateMemberRole = async (targetUserId, role_name) => {
    setMemberError('');
    try {
      await api.patch(`/workspaces/${activeWorkspace.id}/members/${targetUserId}`, { role_name });
    } catch (err) {
      setMemberError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const removeMember = async (targetUserId) => {
    setMemberError('');
    try {
      await api.delete(`/workspaces/${activeWorkspace.id}/members/${targetUserId}`);
    } catch (err) {
      setMemberError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const setReminder = async (taskId) => {
    const remind_at = reminderInputs[taskId];
    if (!remind_at) return;
    const recipient_id = reminderRecipients[taskId] || userId;
    setReminderStatus((prev) => ({ ...prev, [taskId]: '' }));
    try {
      await api.post('/reminders', {
        task_id: taskId,
        remind_at: new Date(remind_at).toISOString(),
        recipient_id,
      });
      setReminderStatus((prev) => ({ ...prev, [taskId]: 'Reminder set.' }));
      setReminderInputs((prev) => ({ ...prev, [taskId]: '' }));
    } catch (err) {
      setReminderStatus((prev) => ({ ...prev, [taskId]: err.response?.data?.message || 'Something went wrong' }));
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage || !activeWorkspace) return;
    const userMsg = chatMessage;
    setChatLog((prev) => [...prev, { from: 'you', text: userMsg }]);
    setChatMessage('');

    try {
      const res = await api.post('/chat', {
        message: userMsg,
        workspace_id: activeWorkspace.id,
      });
      setChatLog((prev) => [...prev, { from: 'ai', text: res.data.reply }]);
    } catch (err) {
      setChatLog((prev) => [...prev, { from: 'ai', text: err.response?.data?.message || 'Something went wrong' }]);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>AI Task Manager</h1>
        <button style={styles.button} onClick={onLogout}>Log Out</button>
      </div>

      <div style={styles.body}>
        <div style={{ ...styles.panel, minWidth: 220 }}>
          <h3 style={styles.panelTitle}>Workspaces</h3>
          <ul style={styles.list}>
            {workspaces.map((w) => (
              <li key={w.id} style={styles.listItem}>
                <button style={styles.itemButton(activeWorkspace?.id === w.id)} onClick={() => setActiveWorkspace(w)}>
                  {w.workspace_name}
                </button>
                <button style={styles.buttonSmall} onClick={() => deleteWorkspace(w.id)}>Delete</button>
              </li>
            ))}
          </ul>
          {workspaceError && <p style={styles.errorText}>{workspaceError}</p>}
          <input
            placeholder="New workspace name"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            style={styles.input}
          />
          <button style={styles.buttonPrimary} onClick={createWorkspace}>Create Workspace</button>
        </div>

        {activeWorkspace && (
          <div style={{ ...styles.panel, minWidth: 260 }}>
            {renamingWorkspace ? (
              <div style={{ marginBottom: 12 }}>
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  style={styles.input}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={styles.buttonSmall} onClick={renameWorkspace}>Save</button>
                  <button style={styles.buttonSmall} onClick={() => setRenamingWorkspace(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <h3 style={styles.panelTitle}>
                Projects in {activeWorkspace.workspace_name}{' '}
                <button
                  style={{ ...styles.buttonSmall, textTransform: 'none', fontWeight: 400 }}
                  onClick={() => { setRenameValue(activeWorkspace.workspace_name); setRenamingWorkspace(true); }}
                >
                  Rename
                </button>
              </h3>
            )}
            <ul style={styles.list}>
              {projects.map((p) => (
                <li key={p.id} style={styles.listItem}>
                  <button style={styles.itemButton(activeProject?.id === p.id)} onClick={() => setActiveProject(p)}>
                    {p.project_name}
                  </button>
                  <button style={styles.buttonSmall} onClick={() => deleteProject(p.id)}>Delete</button>
                </li>
              ))}
            </ul>
            {projectError && <p style={styles.errorText}>{projectError}</p>}
            <input
              placeholder="New project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              style={styles.input}
            />
            <button style={styles.buttonPrimary} onClick={createProject}>Create Project</button>

            {activeProject && (
              <div style={{ marginTop: 24 }}>
                <h4 style={styles.panelTitle}>Tasks in {activeProject.project_name}</h4>
                <ul style={styles.list}>
                  {tasks.map((t) => (
                    <li key={t.id} style={styles.taskCard}>
                      <div>
                        <strong>{t.task_name}</strong>
                        <span style={styles.badge}>{t.status}</span>
                        <span style={styles.badge}>{t.priority}</span>
                      </div>
                      {t.description && <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{t.description}</div>}
                      {t.due_date && <div style={{ fontSize: 12, color: colors.muted }}>Due: {new Date(t.due_date).toLocaleDateString()}</div>}
                      <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                        <input
                          type="datetime-local"
                          value={reminderInputs[t.id] || ''}
                          onChange={(e) => setReminderInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          style={{ ...styles.select, fontSize: 12 }}
                        />
                        <select
                          value={reminderRecipients[t.id] || userId}
                          onChange={(e) => setReminderRecipients((prev) => ({ ...prev, [t.id]: parseInt(e.target.value) }))}
                          style={{ ...styles.select, fontSize: 12 }}
                        >
                          {members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>{m.name}</option>
                          ))}
                        </select>
                        <button style={styles.buttonSmall} onClick={() => setReminder(t.id)}>Remind me</button>
                        <button style={styles.buttonSmall} onClick={() => deleteTask(t.id)}>Delete</button>
                      </div>
                      {reminderStatus[t.id] && (
                        <div style={styles.statusText(reminderStatus[t.id] === 'Reminder set.')}>{reminderStatus[t.id]}</div>
                      )}
                    </li>
                  ))}
                </ul>

                <input
                  placeholder="Task name"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  style={styles.input}
                />
                <textarea
                  placeholder="Description"
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  style={styles.input}
                />
                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value)}
                  style={{ ...styles.select, width: '100%', marginBottom: 6, boxSizing: 'border-box' }}
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  style={{ ...styles.select, width: '100%', marginBottom: 6, boxSizing: 'border-box' }}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  style={styles.input}
                />
                <input
                  type="number"
                  step="0.5"
                  placeholder="Estimated hours"
                  value={newTaskHours}
                  onChange={(e) => setNewTaskHours(e.target.value)}
                  style={styles.input}
                />
                <button style={styles.buttonPrimary} onClick={createTask}>Create Task</button>
              </div>
            )}
          </div>
        )}

        {activeWorkspace && (
          <div style={{ ...styles.panel, minWidth: 260 }}>
            <h3 style={styles.panelTitle}>Members {currentUserRole && <span style={styles.badge}>you: {currentUserRole}</span>}</h3>
            <ul style={styles.list}>
              {members.map((m) => (
                <li key={m.user_id} style={{ marginBottom: 10 }}>
                  <div>{m.name} <span style={{ color: colors.muted, fontSize: 12 }}>({m.email})</span></div>
                  {canManageMembers ? (
                    <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                      <select
                        value={m.role_name}
                        onChange={(e) => updateMemberRole(m.user_id, e.target.value)}
                        style={styles.select}
                      >
                        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      {canRemoveMembers && (
                        <button style={styles.buttonSmall} onClick={() => removeMember(m.user_id)}>Remove</button>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: colors.muted }}>{m.role_name}</div>
                  )}
                </li>
              ))}
            </ul>

            {canManageMembers && (
              <div style={{ marginTop: 10 }}>
                <input
                  placeholder="User email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  style={styles.input}
                />
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  style={{ ...styles.select, width: '100%', marginBottom: 6, boxSizing: 'border-box' }}
                >
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button style={styles.buttonPrimary} onClick={addMember}>Add Member</button>
                {memberError && <p style={styles.errorText}>{memberError}</p>}
              </div>
            )}
          </div>
        )}

        {activeWorkspace && (
          <div style={{ ...styles.panel, minWidth: 320, flex: 1 }}>
            <h3 style={styles.panelTitle}>Chat Agent</h3>
            <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, height: 320, overflowY: 'auto', padding: 12, marginBottom: 10, backgroundColor: '#fafbfc' }}>
              {chatLog.map((entry, i) => (
                <p key={i} style={{ margin: '0 0 8px 0' }}>
                  <strong>{entry.from === 'you' ? 'You' : 'AI'}:</strong> {entry.text}
                </p>
              ))}
            </div>
            <input
              placeholder="Ask the AI to create/update tasks or reminders..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
              style={styles.input}
            />
            <button style={styles.buttonPrimary} onClick={sendChatMessage}>Send</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
