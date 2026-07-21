const socket = io();
let currentUser = null, activeRecipientNumber = null;

const authScreen = document.getElementById("authScreen");
const appContainer = document.getElementById("appContainer");
const authError = document.getElementById("authError");

document.getElementById("loginBtn").onclick = () => handleAuth("/api/login");
document.getElementById("registerBtn").onclick = () => handleAuth("/api/register");

async function handleAuth(endpoint) {
    const username = document.getElementById("authUsername").value.trim();
    const password = document.getElementById("authPassword").value.trim();
    if (!username || !password) return authError.textContent = "Fill in both fields";

    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) return authError.textContent = data.error;

    currentUser = data.user;
    authScreen.classList.add("hidden");
    appContainer.classList.remove("hidden");
    document.getElementById("myProfileName").textContent = currentUser.username;
    document.getElementById("myUsNumber").textContent = currentUser.usNumber;
    document.getElementById("myAvatar").textContent = currentUser.avatar;
    socket.emit("register_session", currentUser.usNumber);
}

document.getElementById("startChatBtn").onclick = () => {
    const target = document.getElementById("targetNumberInput").value.trim();
    if (!target) return;
    activeRecipientNumber = target;
    document.getElementById("activeChatTitle").textContent = "Chat Room: " + target;
    document.getElementById("chatBody").innerHTML = "";
};

document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("msgInput").onkeypress = (e) => { if (e.key === "Enter") sendMessage(); };

function sendMessage() {
    const input = document.getElementById("msgInput");
    if (!input.value.trim() || !activeRecipientNumber) return;
    socket.emit("send_message", { senderNumber: currentUser.usNumber, receiverNumber: activeRecipientNumber, text: input.value.trim() });
    input.value = "";
}

socket.on("message_sent", (msg) => renderMessage(msg, "outgoing"));
socket.on("receive_message", (msg) => { if (msg.senderNumber === activeRecipientNumber) renderMessage(msg, "incoming"); });

function renderMessage(msg, type) {
    const chatBody = document.getElementById("chatBody");
    const div = document.createElement("div");
    div.className = "msg " + type;
    div.textContent = msg.text;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
}
