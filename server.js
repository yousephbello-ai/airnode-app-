const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

// Serve static frontend files from 'public' directory
app.use(express.static('public'));

// 1. Database Schemas & Models
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// 2. Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbState: mongoose.connection.readyState });
});

// 3. User Registration Endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'Username already taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 4. User Login Endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_123';
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, token, username: user.username });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 5. Create Server & Setup Socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  // Load message history on connect
  Message.find().sort({ timestamp: 1 }).limit(50)
    .then(messages => socket.emit('load_history', messages))
    .catch(err => console.error('Error loading history:', err));

  socket.on('send_message', async (data) => {
    try {
      const newMsg = new Message({ sender: data.sender, message: data.message });
      await newMsg.save();
      io.emit('receive_message', newMsg);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });
});

// 6. Connect to DB First, Then Start Server
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully 🚀');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB Initial Connection Error:', err);
    // Listen anyway so Express endpoints return clear errors instead of 502 crashing
    server.listen(PORT, () => console.log(`Server running on port ${PORT} (DB Disconnected)`));
  });
