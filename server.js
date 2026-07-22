const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Datastore = require('@seald-io/nedb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Local File Databases (No external servers needed!)
const usersDb = new Datastore({ filename: './users.db', autoload: true });
const messagesDb = new Datastore({ filename: './messages.db', autoload: true });

// 1. Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbState: 'Local Embedded DB Active 🚀' });
});

// 2. User Registration Endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const existingUser = await usersDb.findOneAsync({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await usersDb.insertAsync({ username, password: hashedPassword });

    res.json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration Error:', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 3. User Login Endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await usersDb.findOneAsync({ username });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_123';
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, token, username: user.username });
  } catch (err) {
    console.error('Login Error:', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 4. Create Server & Setup Socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', async (socket) => {
  try {
    // Load message history on connect
    const messages = await messagesDb.findAsync({}).sort({ timestamp: 1 }).limit(50);
    socket.emit('load_history', messages);
  } catch (err) {
    console.error('Error loading history:', err.message);
  }

  socket.on('send_message', async (data) => {
    try {
      const newMsg = { sender: data.sender, message: data.message, timestamp: new Date() };
      const savedMsg = await messagesDb.insertAsync(newMsg);
      io.emit('receive_message', savedMsg);
    } catch (err) {
      console.error('Error saving message:', err.message);
    }
  });
});

// 5. Start Server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running smoothly on port ${PORT} with Local DB 🚀`));
