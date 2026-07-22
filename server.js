const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Datastore = require('@seald-io/nedb');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Local embedded databases for users and messages
const usersDb = new Datastore({ filename: './users.db', autoload: true });
const messagesDb = new Datastore({ filename: './messages.db', autoload: true });

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbState: 'Local DB Active' });
});

// Socket.io setup
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Function to generate unique 1-on-1 conversation ID for any two phone numbers
function getPrivateRoomId(num1, num2) {
  return [num1, num2].sort().join('_');
}

io.on('connection', (socket) => {
  // Join a private 1-on-1 chat room between sender and recipient
  socket.on('join_chat', async ({ myNumber, recipientNumber }) => {
    const roomId = getPrivateRoomId(myNumber, recipientNumber);
    socket.join(roomId);

    // Fetch previous 1-on-1 message history between these two numbers
    try {
      const history = await messagesDb.findAsync({ roomId }).sort({ timestamp: 1 }).limit(50);
      socket.emit('load_history', history);
    } catch (err) {
      console.error('Error fetching history:', err.message);
    }
  });

  // Handle sending direct messages
  socket.on('send_private_message', async ({ sender, recipient, message }) => {
    const roomId = getPrivateRoomId(sender, recipient);
    const newMsg = {
      roomId,
      sender,
      recipient,
      message,
      timestamp: new Date()
    };

    try {
      const savedMsg = await messagesDb.insertAsync(newMsg);
      // Emit message only to participants in this private room
      io.to(roomId).emit('receive_private_message', savedMsg);
    } catch (err) {
      console.error('Error saving message:', err.message);
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
