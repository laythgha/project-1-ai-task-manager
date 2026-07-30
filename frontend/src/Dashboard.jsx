import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from './api';
import './Dashboard.css';

const ROLE_OPTIONS = ['Owner', 'Admin', 'Member', 'Viewer'];

const STATUS_COLUMNS = [
  { key: 'To Do', label: 'To Do', dot: 'dot-todo' },
  { key: 'In Progress', label: 'In Progress', dot: 'dot-progress' },
  { key: 'Done', label: 'Done', dot: 'dot-done' },
];

const initials = (name) => {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
};

const priorityClass = (priority) => {
  const p = (priority || '').toLowerCase();
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
};

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
    const s = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');
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
  const isOwnerOrAdmin = currentUserRole === 'Owner' || currentUserRole === 'Admin';
  const canManageMembers = isOwnerOrAdmin;
  const canRemoveMembers = currentUserRole === 'Owner';
  const canRenameWorkspace = isOwnerOrAdmin;
  const canManageProjects = currentUserRole && currentUserRole !== 'Viewer';
  const canDeleteProjects = isOwnerOrAdmin;
  const canManageTasks = currentUserRole && currentUserRole !== 'Viewer';

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
        history: chatLog,
      });
      setChatLog((prev) => [...prev, { from: 'ai', text: res.data.reply }]);
    } catch (err) {
      setChatLog((prev) => [...prev, { from: 'ai', text: err.response?.data?.message || 'Something went wrong' }]);
    }
  };

  const currentUserName = members.find((m) => m.user_id === userId)?.name;

  return (
    <div className="app-shell">
      <div className="app-navbar">
        <div className="app-brand">
          <span className="app-brand-mark">✦</span>
          AI Task Manager
        </div>
        <div className="app-navbar-right">
          {currentUserName && (
            <div className="app-user">
              <span className="avatar">{initials(currentUserName)}</span>
            </div>
          )}
          <button className="btn-outline-sm" onClick={onLogout} title="Log out">Log Out</button>
        </div>
      </div>

      <div className="app-body">
        <div className="col-nav">
          <div className="panel">
            <h3 className="panel-title">Workspaces</h3>
            {workspaces.length === 0 && <div className="nav-list-empty">No workspaces yet.</div>}
            <ul className="nav-list">
              {workspaces.map((w) => (
                <li key={w.id} className="nav-item">
                  <button
                    className={`nav-item-btn${activeWorkspace?.id === w.id ? ' active' : ''}`}
                    onClick={() => setActiveWorkspace(w)}
                  >
                    {w.workspace_name}
                  </button>
                  {w.role_name === 'Owner' && (
                    <button className="icon-btn" title="Delete workspace" onClick={() => deleteWorkspace(w.id)}>✕</button>
                  )}
                </li>
              ))}
            </ul>
            {workspaceError && <p className="error-banner">{workspaceError}</p>}
            <input
              placeholder="New workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="field-input"
            />
            <button className="btn btn-primary btn-full" onClick={createWorkspace}>+ Create Workspace</button>
          </div>

          {activeWorkspace && (
            <div className="panel">
              {renamingWorkspace ? (
                <div className="rename-row">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="field-input"
                    style={{ marginBottom: 0 }}
                  />
                  <button className="btn-outline-sm" onClick={renameWorkspace}>Save</button>
                  <button className="btn-outline-sm" onClick={() => setRenamingWorkspace(false)}>Cancel</button>
                </div>
              ) : (
                <h3 className="panel-title">
                  Projects
                  {canRenameWorkspace && (
                    <button
                      className="btn-ghost"
                      onClick={() => { setRenameValue(activeWorkspace.workspace_name); setRenamingWorkspace(true); }}
                    >
                      Rename
                    </button>
                  )}
                </h3>
              )}
              {projects.length === 0 && <div className="nav-list-empty">No projects yet.</div>}
              <ul className="nav-list">
                {projects.map((p) => (
                  <li key={p.id} className="nav-item">
                    <button
                      className={`nav-item-btn${activeProject?.id === p.id ? ' active' : ''}`}
                      onClick={() => setActiveProject(p)}
                    >
                      {p.project_name}
                    </button>
                    {canDeleteProjects && (
                      <button className="icon-btn" title="Delete project" onClick={() => deleteProject(p.id)}>✕</button>
                    )}
                  </li>
                ))}
              </ul>
              {projectError && <p className="error-banner">{projectError}</p>}
              {canManageProjects && (
                <>
                  <input
                    placeholder="New project name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="field-input"
                  />
                  <button className="btn btn-primary btn-full" onClick={createProject}>+ Create Project</button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="col-main">
          {!activeWorkspace && (
            <div className="panel empty-state">
              <div className="empty-state-icon">✦</div>
              <h3>Pick or create a workspace</h3>
              <p>Choose a workspace on the left to see its projects, or create a new one to get started.</p>
            </div>
          )}

          {activeWorkspace && !activeProject && (
            <div className="panel empty-state">
              <div className="empty-state-icon">▤</div>
              <h3>Select a project</h3>
              <p>Choose a project from the sidebar, or create a new one, to see its task board.</p>
            </div>
          )}

          {activeProject && (
            <div className="panel">
              <div className="board-header">
                <h2>{activeProject.project_name}</h2>
                <span className="chip chip-muted">{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
              </div>

              <div className="board" style={{ marginTop: 14 }}>
                {STATUS_COLUMNS.map((col) => {
                  const colTasks = tasks.filter((t) => t.status === col.key);
                  return (
                    <div className="board-col" key={col.key}>
                      <div className="board-col-header">
                        <span className={`board-col-dot ${col.dot}`}></span>
                        {col.label}
                        <span className="board-col-count">{colTasks.length}</span>
                      </div>

                      {colTasks.length === 0 && <div className="board-col-empty">No tasks</div>}

                      {colTasks.map((t) => (
                        <div className={`task-card priority-${priorityClass(t.priority)}`} key={t.id}>
                          <div className="task-card-title">{t.task_name}</div>
                          {t.description && <div className="task-card-desc">{t.description}</div>}
                          <div className="task-card-meta">
                            <span className={`chip chip-priority-${priorityClass(t.priority)}`}>{t.priority}</span>
                            {t.due_date && (
                              <span className="chip chip-muted">Due {new Date(t.due_date).toLocaleDateString()}</span>
                            )}
                          </div>
                          {canManageTasks && (
                            <div className="task-card-actions">
                              <input
                                type="datetime-local"
                                value={reminderInputs[t.id] || ''}
                                onChange={(e) => setReminderInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                className="field-select"
                              />
                              <select
                                value={reminderRecipients[t.id] || userId}
                                onChange={(e) => setReminderRecipients((prev) => ({ ...prev, [t.id]: parseInt(e.target.value) }))}
                                className="field-select"
                              >
                                {members.map((m) => (
                                  <option key={m.user_id} value={m.user_id}>{m.name}</option>
                                ))}
                              </select>
                              <div className="task-card-actions-row">
                                <button className="btn-outline-sm" onClick={() => setReminder(t.id)}>Remind me</button>
                                <button className="btn-outline-sm danger" onClick={() => deleteTask(t.id)}>Delete</button>
                              </div>
                            </div>
                          )}
                          {reminderStatus[t.id] && (
                            <div className={`task-status-msg ${reminderStatus[t.id] === 'Reminder set.' ? 'ok' : 'err'}`}>
                              {reminderStatus[t.id]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {canManageTasks && (
                <div className="new-task-form">
                  <h3 className="panel-title">New Task</h3>
                  <input
                    placeholder="Task name"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    className="field-input"
                  />
                  <textarea
                    placeholder="Description"
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    className="field-textarea"
                  />
                  <div className="field-row">
                    <select
                      value={newTaskStatus}
                      onChange={(e) => setNewTaskStatus(e.target.value)}
                      className="field-select"
                    >
                      <option value="To Do">To Do</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Done">Done</option>
                    </select>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value)}
                      className="field-select"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div className="field-row">
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="field-input"
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Estimated hours"
                      value={newTaskHours}
                      onChange={(e) => setNewTaskHours(e.target.value)}
                      className="field-input"
                    />
                  </div>
                  <button className="btn btn-primary btn-full" onClick={createTask}>+ Create Task</button>
                </div>
              )}
            </div>
          )}
        </div>

        {activeWorkspace && (
          <div className="col-side">
            <div className="panel">
              <h3 className="panel-title">
                Members
                {currentUserRole && <span className="chip chip-muted">you: {currentUserRole}</span>}
              </h3>
              {members.map((m) => (
                <div className="member-row" key={m.user_id}>
                  <span className="avatar avatar-sm">{initials(m.name)}</span>
                  <div className="member-info">
                    <div className="member-name">{m.name}</div>
                    <div className="member-email">{m.email}</div>
                    {canManageMembers ? (
                      <div className="member-controls">
                        <select
                          value={m.role_name}
                          onChange={(e) => updateMemberRole(m.user_id, e.target.value)}
                          className="field-select"
                          style={{ marginBottom: 0 }}
                        >
                          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {canRemoveMembers && (
                          <button className="btn-outline-sm danger" onClick={() => removeMember(m.user_id)}>Remove</button>
                        )}
                      </div>
                    ) : (
                      <div className="role-badge">{m.role_name}</div>
                    )}
                  </div>
                </div>
              ))}

              {canManageMembers && (
                <div style={{ marginTop: 12 }}>
                  <input
                    placeholder="User email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="field-input"
                  />
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="field-select"
                  >
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button className="btn btn-primary btn-full" onClick={addMember}>+ Add Member</button>
                  {memberError && <p className="error-banner" style={{ marginTop: 8 }}>{memberError}</p>}
                </div>
              )}
            </div>

            <div className="panel">
              <h3 className="panel-title">AI Chat Agent</h3>
              <div className="chat-window">
                {chatLog.length === 0 && (
                  <div className="chat-empty">Ask the AI to create tasks, set reminders, or summarize your project.</div>
                )}
                {chatLog.map((entry, i) => (
                  <div className={`chat-bubble-row ${entry.from}`} key={i}>
                    <div className={`chat-bubble ${entry.from}`}>{entry.text}</div>
                  </div>
                ))}
              </div>
              <div className="chat-input-row">
                <input
                  placeholder="Ask the AI..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  className="field-input"
                />
                <button className="btn btn-primary" onClick={sendChatMessage}>Send</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
