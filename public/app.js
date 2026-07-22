// Connect automatically to the server hosted on Render
const socket = io();

// Prompt for user setup (or replace with your login system)
const myUserId = prompt("Enter YOUR ID or Phone Number:") || "user1";
const recipientId = prompt("Enter RECIPIENT ID or Phone Number to chat with:") || "user2";

// 1. Register user with backend on connection
socket.on('connect', () => {
  console.log('Connected to server!');
  socket.emit('register_user', myUserId);
});

// 2. Handle sending outgoing messages
function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text) return;

  const messageId = `msg_${Date.now()}`;

  // Render outgoing message on screen with single tick (✓)
  const messagesDiv = document.getElementById('messages');
  const msgEl = document.createElement('div');
  msgEl.className = 'message sent';
  msgEl.id = messageId;
  msgEl.innerHTML = `<span>${text}</span><span class="tick" id="tick-${messageId}">✓</span>`;
  messagesDiv.appendChild(msgEl);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  input.value = '';

  // Emit to server
  socket.emit('send_message', {
    messageId,
    senderId: myUserId,
    recipientId,
    text
  }, (response) => {
    if (!response.success) {
      document.getElementById(`tick-${messageId}`).innerText = '❌';
    }
  });
}

// 3. Listen for incoming messages and send ACK back
socket.on('receive_message', (message, ackCallback) => {
  const messagesDiv = document.getElementById('messages');
  const msgEl = document.createElement('div');
  msgEl.className = 'message received';
  msgEl.innerText = message.text;
  messagesDiv.appendChild(msgEl);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  // Send ACK back to server so sender gets double tick (✓✓)
  if (typeof ackCallback === 'function') {
    ackCallback({ received: true });
  }
});

// 4. Update status when server sends confirmation (✓ -> ✓✓)
socket.on('message_status_update', ({ messageId, status }) => {
  if (status === 'delivered') {
    const tickEl = document.getElementById(`tick-${messageId}`);
    if (tickEl) {
      tickEl.innerText = '✓✓'; // Double tick confirmed
    }
  }
});
