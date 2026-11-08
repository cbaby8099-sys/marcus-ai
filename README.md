
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Marcus AI | CJ Technologies</title>
<style>
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #080b14;
  color: white;
  font-family: Arial, sans-serif;
}
header {
  padding: 22px;
  background: #111827;
  border-bottom: 1px solid #26334c;
}
h1 { margin: 0; color: #60a5fa; }
header p { color: #9ca3af; margin-bottom: 0; }
main {
  max-width: 650px;
  margin: auto;
  padding: 20px;
}
.status { color: #4ade80; font-size: 13px; }
#chat {
  height: 55vh;
  min-height: 300px;
  overflow-y: auto;
  padding: 15px;
  background: #111827;
  border-radius: 14px;
  margin-top: 18px;
}
.message {
  padding: 12px;
  margin: 10px 0;
  border-radius: 12px;
  line-height: 1.5;
}
.marcus { background: #1e293b; }
.user { background: #1d4ed8; margin-left: 35px; }
.controls { display: flex; gap: 8px; margin-top: 15px; }
input {
  flex: 1;
  min-width: 0;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid #334155;
  background: #111827;
  color: white;
}
button {
  padding: 13px 18px;
  border: 0;
  border-radius: 10px;
  background: #2563eb;
  color: white;
  font-weight: bold;
}
footer { text-align: center; color: #64748b; margin-top: 25px; }
</style>
</head>
<body>
<header>
  <h1>MARCUS AI</h1>
  <p>Created by CJ Technologies</p>
</header>
<main>
  <div class="status">● Marcus interface online</div>
  <div id="chat">
    <div class="message marcus">
      <b>Marcus:</b><br>
      Hello! I am Marcus, your AI assistant.
      My journey begins here. How can I help you today?
    </div>
  </div>
  <div class="controls">
    <input id="message" placeholder="Talk to Marcus...">
    <button onclick="sendMessage()">Send</button>
  </div>
  <footer>Marcus AI · CJ Technologies · V1</footer>
</main>
<script>
function sendMessage() {
  const input = document.getElementById("message");
  const chat = document.getElementById("chat");
  const value = input.value.trim();
  if (!value) return;

  const user = document.createElement("div");
  user.className = "message user";
  user.textContent = "You: " + value;
  chat.appendChild(user);

  const reply = document.createElement("div");
  reply.className = "message marcus";
  reply.textContent = "Marcus: I received your message! My AI brain is still being connected. Stay tuned.";
  chat.appendChild(reply);

  input.value = "";
  chat.scrollTop = chat.scrollHeight;
}
</script>
</body>
</html>
