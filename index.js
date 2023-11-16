const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const users = new Map();

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  const userId = generateUserId();
  users.set(userId, socket);

  socket.emit('message', JSON.stringify({ type: 'user-id', userId }));

  socket.on('message', (message) => {
    const data = JSON.parse(message);
    handleWebSocketMessage(userId, data);
  });

  socket.on('disconnect', () => {
    users.delete(userId);
    broadcastUsers();
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'CODE/WEBSITES/index.html'));
});

function handleWebSocketMessage(userId, data) {
  switch (data.type) {
    case 'match':
      handleMatchRequest(userId);
      break;
    case 'offer':
    case 'answer':
    case 'ice-candidate':
      handleWebRTCMessage(userId, data);
      break;
  }
}

function handleMatchRequest(userId) {
  const matchedUserId = findMatch(userId);

  if (matchedUserId) {
    const usersToConnect = [userId, matchedUserId];
    usersToConnect.forEach((user) => {
      const userSocket = users.get(user);
      if (userSocket) {
        userSocket.emit('message', JSON.stringify({ type: 'match-found', users: usersToConnect }));
      }
    });
    broadcastUsers();
  }
}

function findMatch(userId) {
  const availableUsers = Array.from(users.keys()).filter((user) => user !== userId);
  return availableUsers[Math.floor(Math.random() * availableUsers.length)];
}

function handleWebRTCMessage(senderId, data) {
  const receiverId = getOtherUserId(senderId, data.users);

  if (receiverId) {
    const receiverSocket = users.get(receiverId);

    if (receiverSocket) {
      receiverSocket.emit('message', JSON.stringify({
        type: data.type,
        senderId: senderId,
        data: data.data,
      }));
    }
  }
}

function getOtherUserId(userId, usersList) {
  return usersList.find(user => user !== userId);
}

function broadcastUsers() {
  const userList = Array.from(users.keys());
  io.sockets.emit('message', JSON.stringify({ type: 'user-list', users: userList }));
}

function generateUserId() {
  return Math.random().toString(36).substring(2, 15);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
