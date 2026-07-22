const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to strip all non-numeric characters from phone numbers
function cleanNumber(num) {
  return num ? String(num).replace(/\D/g, '') : '';
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle joining a private chat room
  socket.on('join_chat', ({ myNumber, recipientNumber }) => {
    const user = cleanNumber(myNumber);
    const target = cleanNumber(recipientNumber);

    if (!user || !target) return;

    // Create a deterministic room ID regardless of who initiates (alphabetically sorted)
    const roomId = [user, target].sort().join('_');
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room: ${roomId}`);
  });

  // Handle private messages
  socket.on('send_private_message', (data) => {
    const sender = cleanNumber(data.sender);
    const recipient = cleanNumber(data.recipient);

    if (!sender || !recipient) return;

    const roomId = [sender, recipient].sort().join('_');
    const cleanPayload = {
      ...data,
      sender,
      recipient,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Broadcast message to everyone in the shared room (including sender)
    io.to(roomId).emit('receive_private_message', cleanPayload);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
