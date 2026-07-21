const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const usersByUsername = {};
const activeSockets = {};

function generateUSNumber() {
    return "+1 (" + Math.floor(200 + Math.random() * 800) + ") " + Math.floor(100 + Math.random() * 900) + "-" + Math.floor(1000 + Math.random() * 9000);
}

app.post("/api/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username & password required" });
    if (usersByUsername[username]) return res.status(400).json({ error: "Username taken" });

    const newUser = { username, password, usNumber: generateUSNumber(), avatar: username.charAt(0).toUpperCase() };
    usersByUsername[username] = newUser;
    res.json({ success: true, user: newUser });
});

app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = usersByUsername[username];
    if (!user || user.password !== password) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ success: true, user });
});

io.on("connection", (socket) => {
    socket.on("register_session", (usNumber) => {
        activeSockets[usNumber] = socket.id;
        socket.usNumber = usNumber;
    });

    socket.on("send_message", (data) => {
        const { senderNumber, receiverNumber, text } = data;
        const msg = { senderNumber, receiverNumber, text, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
        if (activeSockets[receiverNumber]) {
            io.to(activeSockets[receiverNumber]).emit("receive_message", msg);
        }
        socket.emit("message_sent", msg);
    });

    socket.on("disconnect", () => {
        if (socket.usNumber) delete activeSockets[socket.usNumber];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server live on port ${PORT}`));
