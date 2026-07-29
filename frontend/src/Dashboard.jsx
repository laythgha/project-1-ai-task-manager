import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from './api';

function Dashboard({ userId }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');

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
  const [newMemberRole, setNewMemberRole] = useState('Viewer');
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

    socket.on('task_created', handleTaskCreated);
    socket.on('task_updated', handleTaskUpdated);
    socket.on('task_deleted', handleTaskDeleted);
    socket.on('member_added', handleMemberAdded);
    socket.on('member_updated', handleMemberUpdated);
    socket.on('member_removed', handleMemberRemoved);

    return () => {
      socket.off('task_created', handleTaskCreated);
      socket.off('task_updated', handleTaskUpdated);
      socket.off('task_deleted', handleTaskDeleted);
      socket.off('member_added', handleMemberAdded);
      socket.off('member_updated', handleMemberUpdated);
      socket.off('member_removed', handleMemberRemoved);
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
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeProject) return;
    api.get(`/projects/${activeProject.id}/tasks`).then((res) => {
      setTasks(res.data);
    });
  }, [activeProject]);

  const createWorkspace = async () => {
    if (!newWorkspaceName) return;
    const res = await api.post('/workspaces', { workspace_name: newWorkspaceName, user_id: userId });
    setWorkspaces((prev) => [...prev, { id: res.data.workspaceId, workspace_name: newWorkspaceName }]);
    setNewWorkspaceName('');
  };

  const createProject = async () => {
    if (!newProjectName || !activeWorkspace) return;
    const res = await api.post('/projects', {
      project_name: newProjectName,
      workspace_id: activeWorkspace.id,
      user_id: userId,
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
    user_id: userId,
    workspace_id: activeWorkspace.id,
  });
  setNewTaskName('');
  setNewTaskDescription('');
  setNewTaskStatus('To Do');
  setNewTaskPriority('Medium');
  setNewTaskDueDate('');
  setNewTaskHours('');
};

  const currentUserRole = members.find((m) => m.user_id === userId)?.role_name;

  const addMember = async () => {
    if (!newMemberEmail || !activeWorkspace) return;
    setMemberError('');
    try {
      await api.post(`/workspaces/${activeWorkspace.id}/members`, {
        email: newMemberEmail,
        role_name: newMemberRole,
        user_id: userId,
      });
      setNewMemberEmail('');
      setNewMemberRole('Viewer');
    } catch (err) {
      setMemberError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const updateMemberRole = async (targetUserId, role_name) => {
    setMemberError('');
    try {
      await api.patch(`/workspaces/${activeWorkspace.id}/members/${targetUserId}`, {
        role_name,
        user_id: userId,
      });
    } catch (err) {
      setMemberError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const removeMember = async (targetUserId) => {
    setMemberError('');
    try {
      await api.delete(`/workspaces/${activeWorkspace.id}/members/${targetUserId}`, {
        data: { user_id: userId },
      });
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
        user_id: userId,
        recipient_id,
        workspace_id: activeWorkspace.id,
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

    const res = await api.post('/chat', {
      message: userMsg,
      user_id: userId,
      workspace_id: activeWorkspace.id,
    });
    setChatLog((prev) => [...prev, { from: 'ai', text: res.data.reply }]);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 20, display: 'flex', gap: 30 }}>
      <div style={{ minWidth: 200 }}>
        <h3>Workspaces</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {workspaces.map((w) => (
            <li key={w.id}>
              <button
                onClick={() => setActiveWorkspace(w)}
                style={{
                  fontWeight: activeWorkspace?.id === w.id ? 'bold' : 'normal',
                  display: 'block',
                  marginBottom: 5,
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                {w.workspace_name}
              </button>
            </li>
          ))}
        </ul>
        <input
          placeholder="New workspace name"
          value={newWorkspaceName}
          onChange={(e) => setNewWorkspaceName(e.target.value)}
          style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%' }}
        />
        <button onClick={createWorkspace} style={{ width: '100%', marginTop: 5 }}>Create Workspace</button>
      </div>

      {activeWorkspace && (
        <div style={{ minWidth: 250 }}>
          <h3>Projects in {activeWorkspace.workspace_name}</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setActiveProject(p)}
                  style={{
                    fontWeight: activeProject?.id === p.id ? 'bold' : 'normal',
                    display: 'block',
                    marginBottom: 5,
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  {p.project_name}
                </button>
              </li>
            ))}
          </ul>
          <input
            placeholder="New project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%' }}
          />
          <button onClick={createProject} style={{ width: '100%', marginTop: 5 }}>Create Project</button>

          {activeProject && (
            <div style={{ marginTop: 20 }}>
              <h4>Tasks in {activeProject.project_name}</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {tasks.map((t) => (
                  <li key={t.id} style={{ marginBottom: 10, borderBottom: '1px solid #ccc', paddingBottom: 5 }}>
                    <strong>{t.task_name}</strong> <em>({t.status}, {t.priority})</em>
                    {t.description && <div style={{ fontSize: 12 }}>{t.description}</div>}
                    {t.due_date && <div style={{ fontSize: 12 }}>Due: {new Date(t.due_date).toLocaleDateString()}</div>}
                    <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                      <input
                        type="datetime-local"
                        value={reminderInputs[t.id] || ''}
                        onChange={(e) => setReminderInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        style={{ backgroundColor: 'white', color: 'black', fontSize: 12 }}
                      />
                      <select
                        value={reminderRecipients[t.id] || userId}
                        onChange={(e) => setReminderRecipients((prev) => ({ ...prev, [t.id]: parseInt(e.target.value) }))}
                        style={{ backgroundColor: 'white', color: 'black', fontSize: 12 }}
                      >
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>{m.name}</option>
                        ))}
                      </select>
                      <button onClick={() => setReminder(t.id)} style={{ fontSize: 12 }}>Remind me</button>
                    </div>
                    {reminderStatus[t.id] && <div style={{ fontSize: 12, color: reminderStatus[t.id] === 'Reminder set.' ? 'green' : 'red' }}>{reminderStatus[t.id]}</div>}
                  </li>
                ))}
              </ul>

              <input
                placeholder="Task name"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%', marginBottom: 5 }}
              />
              <textarea
                placeholder="Description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%', marginBottom: 5 }}
              />
              <select
                value={newTaskStatus}
                onChange={(e) => setNewTaskStatus(e.target.value)}
                style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%', marginBottom: 5 }}
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%', marginBottom: 5 }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%', marginBottom: 5 }}
              />
              <input
                type="number"
                step="0.5"
                placeholder="Estimated hours"
                value={newTaskHours}
                onChange={(e) => setNewTaskHours(e.target.value)}
                style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%', marginBottom: 5 }}
              />
              <button onClick={createTask} style={{ width: '100%', marginTop: 5 }}>Create Task</button>
            </div>
          )}
        </div>
      )}

      {activeWorkspace && (
        <div style={{ minWidth: 250 }}>
          <h3>Members</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {members.map((m) => (
              <li key={m.user_id} style={{ marginBottom: 8 }}>
                <div>{m.name} <em>({m.email})</em></div>
                {currentUserRole === 'Admin' ? (
                  <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                    <select
                      value={m.role_name}
                      onChange={(e) => updateMemberRole(m.user_id, e.target.value)}
                      style={{ backgroundColor: 'white', color: 'black' }}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Editor">Editor</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                    <button onClick={() => removeMember(m.user_id)}>Remove</button>
                  </div>
                ) : (
                  <div>{m.role_name}</div>
                )}
              </li>
            ))}
          </ul>

          {currentUserRole === 'Admin' && (
            <div style={{ marginTop: 10 }}>
              <input
                placeholder="User email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%', marginBottom: 5 }}
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%', marginBottom: 5 }}
              >
                <option value="Admin">Admin</option>
                <option value="Editor">Editor</option>
                <option value="Viewer">Viewer</option>
              </select>
              <button onClick={addMember} style={{ width: '100%' }}>Add Member</button>
              {memberError && <p style={{ color: 'red' }}>{memberError}</p>}
            </div>
          )}
        </div>
      )}

      {activeWorkspace && (
        <div style={{ minWidth: 300, flex: 1 }}>
          <h3>Chat Agent</h3>
          <div style={{ border: '1px solid #ccc', height: 300, overflowY: 'auto', padding: 10, marginBottom: 10 }}>
            {chatLog.map((entry, i) => (
              <p key={i}>
                <strong>{entry.from === 'you' ? 'You' : 'AI'}:</strong> {entry.text}
              </p>
            ))}
          </div>
          <input
            placeholder="Ask the AI to create/update tasks or reminders..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
            style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%' }}
          />
          <button onClick={sendChatMessage} style={{ width: '100%', marginTop: 5 }}>Send</button>
        </div>
      )}
    </div>
  );
}

export default Dashboard;