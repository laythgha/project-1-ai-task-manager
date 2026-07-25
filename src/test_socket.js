const { io } = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Connected as test client:", socket.id);
  socket.emit("join_workspace", 2);
  console.log("Joined workspace 2, listening for updates...");
});

socket.on("task_created", (task) => {
  console.log("REAL-TIME: task_created ->", task);
});

socket.on("task_updated", (task) => {
  console.log("REAL-TIME: task_updated ->", task);
});

socket.on("reminder_created", (reminder) => {
  console.log("REAL-TIME: reminder_created ->", reminder);
});