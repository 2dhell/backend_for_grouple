const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const users = new Map();

// 1. Error Handling for WebSocket and Server
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

// 2. Express Integration: Serve static files from a 'public' directory (optional)
app.use(express.static('public'));

// 3. Secure WebSocket Connection
// If you're deploying over HTTPS, use wss (secure WebSocket)
// Make sure to configure your server with an SSL certificate.
// const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  // Assign a unique user ID
  const userId = generateUserId();
  users.set(userId, ws);

  // Send the user ID to the client
  ws.send(JSON.stringify({ type: 'user-id', userId }));

  // Listen for messages from the client
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    handleWebSocketMessage(userId, data);
  });

  // Handle disconnection
  ws.on('close', () => {
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
        userSocket.send(JSON.stringify({ type: 'match-found', users: usersToConnect }));
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
      receiverSocket.send(JSON.stringify({
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
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'user-list', users: userList }));
    }
  });
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


