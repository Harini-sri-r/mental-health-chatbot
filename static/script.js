const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message");
const sendButton = document.getElementById("send-button");
const emojiButton = document.getElementById("emoji-button");
const micButton = document.getElementById("mic-button");
const emojiPicker = document.getElementById("emoji-picker");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
    recognition.interimResults = false;
    recognition.onstart = () => {
        micButton.textContent = "🎙️";
        micButton.title = "Listening...";
    };
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        messageInput.value = transcript;
    };
    recognition.onend = () => {
        micButton.textContent = "🎤";
        micButton.title = "Voice input";
    };
}

micButton.addEventListener("click", () => {
    if (!recognition) return;
    recognition.start();
});

emojiButton.addEventListener("click", () => {
    emojiPicker.classList.toggle("hidden");
});

emojiPicker.addEventListener("click", (event) => {
    if (event.target.tagName !== "BUTTON") return;
    messageInput.value += event.target.textContent;
    messageInput.focus();
});

function addMessage(text, sender, isTyping = false) {
    const msg = document.createElement("div");
    msg.classList.add("message", sender + "-message");

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    if (isTyping) bubble.classList.add("typing");

    msg.appendChild(bubble);
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msg;
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    addMessage(text, "user");
    messageInput.value = "";
    emojiPicker.classList.add("hidden");

    const typing = addMessage("Asha is typing...", "bot", true);

    fetch("/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message: text})
    })
    .then(res => res.json())
    .then(data => {
        typing.remove();
        addMessage(data.response, "bot");
    })
    .catch(() => {
        typing.remove();
        addMessage("Sorry, something went wrong. Please try again.", "bot");
    });
}

sendButton.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", function(e) {
    if (e.key === "Enter") sendMessage();
});

window.onload = function() {
    messageInput.focus();
};

