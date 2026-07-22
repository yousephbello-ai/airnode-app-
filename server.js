const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust to specific frontend domain in production if needed
    methods: ['GET', 'POST']
  }
});

// Store active user sessions: Map(userId -> socketId)
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // 1. Register User Socket
  socket.on('register_user', (userId) => {
    // Sanitize user ID (e.g. clean phone number format)
    const cleanUserId = String(userId).replace(/\s+/g, '');
    activeUsers.set(cleanUserId, socket.id);
    socket.userId = cleanUserId;
    console.log(`✅ User registered: ${cleanUserId} -> Socket ID: ${socket.id}`);
  });

  // 2. Handle Message Sending
  socket.on('send_message', (data, callback) => {
    const { messageId, recipientId, text, senderId } = data;
    const cleanRecipientId = String(recipientId).replace(/\s+/g, '');
    const recipientSocketId = activeUsers.get(cleanRecipientId);

    const messagePayload = {
      messageId,
      senderId,
      recipientId: cleanRecipientId,
      text,
      timestamp: new Date().toISOString()
    };

    // Check if recipient is online
    if (recipientSocketId) {
      // Emit to recipient and wait for ACK (Receipt Confirmation)
      io.to(recipientSocketId).emit('receive_message', messagePayload, (ack) => {
        if (ack && ack.received) {
          // Send ACK back to sender to trigger Double Ticks (✓✓)
          socket.emit('message_status_update', {
            messageId,
            status: 'delivered'
          });
        }
      });

      // Confirm to sender that server processed the message (Single Tick ✓)
      if (typeof callback === 'function') {
        callback({ success: true, status: 'sent' });
      }
    } else {
      console.warn(`⚠️ Recipient ${cleanRecipientId} is offline.`);
      
      // Server received it, but recipient is offline (Stays Single Tick ✓)
      if (typeof callback === 'function') {
        callback({
          success: true,
          status: 'sent',
          warning: 'Recipient is currently offline.'
        });
      }
    }
  });

  // 3. Handle Disconnection
  socket.on('disconnect', () => {
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      console.log(`❌ User disconnected: ${socket.userId}`);
    }
  });
});

// Serve frontend HTML on wildcard route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Airnode server running on port ${PORT}`);
});
