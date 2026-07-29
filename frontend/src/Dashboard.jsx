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

  const [chatMessage, setChatMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);

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

    socket.on('task_created', handleTaskCreated);
    socket.on('task_updated', handleTaskUpdated);

    return () => {
      socket.off('task_created', handleTaskCreated);
      socket.off('task_updated', handleTaskUpdated);
    };
  }, [socket, activeWorkspace, activeProject]);

  useEffect(() => {
    if (!activeWorkspace) return;
    api.get(`/workspaces/${activeWorkspace.id}/projects`).then((res) => {
      setProjects(res.data);
      setActiveProject(null);
      setTasks([]);
    });
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
      project_id: activeProject.id,
      user_id: userId,
      workspace_id: activeWorkspace.id,
    });
    setNewTaskName('');
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
                  <li key={t.id}>
                    {t.task_name} <em>({t.priority})</em>
                  </li>
                ))}
              </ul>
              <input
                placeholder="New task name"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                style={{ backgroundColor: 'white', color: 'black', padding: 6, width: '100%' }}
              />
              <button onClick={createTask} style={{ width: '100%', marginTop: 5 }}>Create Task</button>
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