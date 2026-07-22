const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'airnode_secret_key_123';
const MONGO_URI = process.env.MONGO_URI;

// 1. Connect to MongoDB Cloud
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB Cloud!'))
  .catch(err => console.error('DB Connection Error:', err));

// 2. Database Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const MessageSchema = new mongoose.Schema({
  sender: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// 3. User Registration Endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.json({ success: true, message: 'User registered successfully!' });
  } catch (err) {
    res.status(400).json({ error: 'Username already taken or invalid' });
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

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 5. Socket.io Real-Time Chat Engine
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  // Load chat history on connect
  Message.find().sort({ timestamp: 1 }).limit(50).then(messages => {
    socket.emit('load_history', messages);
  });

  socket.on('send_message', async (data) => {
    const newMsg = new Message({ sender: data.sender, message: data.message });
    await newMsg.save();
    io.emit('receive_message', newMsg);
  });
});

// 6. Bind to Dynamic Port for Render
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
