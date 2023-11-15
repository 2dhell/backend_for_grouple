const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const users = new Map();

// Error Handling for Socket.io and Server
io.on('error', (error) => {
  console.error('Socket.io server error:', error);
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

// Serve static files from a 'public' directory (optional)
app.use(express.static('public'));

io.on('connection', (socket) => {
  // Assign a unique user ID
  const userId = generateUserId();
  users.set(userId, socket);

  // Send the user ID to the client
  socket.emit('data', { type: 'user-id', userId });

  // Listen for messages from the client
  socket.on('message', (message) => {
    const data = JSON.parse(message);
    handleWebSocketMessage(userId, data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    users.delete(userId);
    broadcastUsers();
  });
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
    // Handle other message types as needed
  }
}

function handleMatchRequest(userId) {
  const matchedUserId = findMatch(userId);

  if (matchedUserId) {
    const usersToConnect = [userId, matchedUserId];
    usersToConnect.forEach((user) => {
      const userSocket = users.get(user);
      if (userSocket) {
        userSocket.emit('data', { type: 'match-found', users: usersToConnect });
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
      receiverSocket.emit('data', {
        type: data.type,
        senderId: senderId,
        data: data.data,
      });
    }
  }
}

function getOtherUserId(userId, usersList) {
  return usersList.find((user) => user !== userId);
}

function broadcastUsers() {
  const userList = Array.from(users.keys());
  io.sockets.emit('data', { type: 'user-list', users: userList });
}

function generateUserId() {
  return Math.random().toString(36).substring(2, 15);
}

// Additional route (optional)
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
