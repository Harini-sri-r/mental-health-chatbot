function addMessage(text, sender, isTyping = false) {
    const box = document.getElementById("chat-box");
    const msg = document.createElement("div");
    msg.classList.add("message", sender + "-message");
    if (isTyping) msg.classList.add("typing");
    msg.innerText = text;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById("message");
    const text = input.value.trim();
    if (!text) return;

    addMessage(text, "user");
    input.value = "";
    const typingMessage = addMessage("Typing...", "bot", true);

    fetch("/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message: text})
    })
    .then(res => res.json())
    .then(data => {
        const typing = document.querySelector(".bot-message.typing");
        if (typing) typing.remove();
        addMessage(data.response, "bot");
    })
    .catch(() => {
        const typing = document.querySelector(".bot-message.typing");
        if (typing) typing.remove();
        addMessage("Error ❌ Please try again.", "bot");
    });
}

const messageInput = document.getElementById("message");
const sendButton = document.getElementById("send-button");

sendButton.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", function(e) {
    if (e.key === "Enter") sendMessage();
});

window.onload = function() {
    addMessage("Hi 👋 I'm your assistant. How are you feeling today?", "bot");
    messageInput.focus();
};

