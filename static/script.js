const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message");
const sendButton = document.getElementById("send-button");
const emojiButton = document.getElementById("emoji-button");
const micButton = document.getElementById("mic-button");
const emojiPicker = document.getElementById("emoji-picker");
const emotionStatus = document.getElementById("emotion-status");
const heroSentiment = document.getElementById("hero-sentiment");
const sentimentCanvas = document.getElementById("sentiment-canvas");
const moodTrendCanvas = document.getElementById("mood-trend");
const dashboardMoodCanvas = document.getElementById("dashboard-mood-chart");

const demoEmotionPercentages = {
    happy: 24,
    sad: 18,
    stress: 16,
    anxiety: 28,
    calm: 14
};

let latestEmotion = "calm";
let breathingTimer = null;
let breathingIndex = 0;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onstart = () => setListeningState(true);
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (messageInput) {
            messageInput.value = transcript;
            messageInput.focus();
        }
        setVoiceStatus("Captured: " + transcript);
    };
    recognition.onerror = () => {
        setVoiceStatus("Voice capture was interrupted. Try again when you are ready.");
    };
    recognition.onend = () => setListeningState(false);
}

function setListeningState(isListening) {
    [micButton, document.getElementById("voice-panel-button")].forEach((button) => {
        if (!button) return;
        button.classList.toggle("listening", isListening);
        button.title = isListening ? "Listening..." : "Voice input";
        button.innerHTML = isListening ? "<span aria-hidden=\"true\">&#127897;</span>" : "<span aria-hidden=\"true\">&#127908;</span>";
    });
    setVoiceStatus(isListening ? "Listening for your check-in..." : "Speech-to-text ready. AI voice response can be connected to your local assistant module.");
}

function setVoiceStatus(text) {
    const voiceStatus = document.getElementById("voice-status");
    if (voiceStatus) voiceStatus.textContent = text;
}

function addMessage(text, sender, isTyping = false) {
    if (!chatBox) return null;

    const msg = document.createElement("div");
    msg.classList.add("message", sender + "-message");

    if (sender === "bot") {
        const avatar = document.createElement("div");
        avatar.className = "avatar-dot";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = "AI";
        msg.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (isTyping) bubble.classList.add("typing");

    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    bubble.appendChild(paragraph);

    msg.appendChild(bubble);
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msg;
}

function sendMessage() {
    if (!messageInput) return;
    const text = messageInput.value.trim();
    if (!text) return;

    document.querySelectorAll(".demo-message").forEach((item) => item.remove());
    addMessage(text, "user");
    messageInput.value = "";
    if (emojiPicker) emojiPicker.classList.add("hidden");

    const typing = addMessage("Aura is thinking...", "bot", true);

    fetch("/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message: text})
    })
        .then((res) => res.json())
        .then((data) => {
            if (typing) typing.remove();
            addMessage(data.response || "I am here with you.", "bot");
            latestEmotion = normalizeEmotion(data.emotion || estimateEmotion(text));
            refreshEmotionUI(latestEmotion);
            fetchMoodData();
        })
        .catch(() => {
            if (typing) typing.remove();
            addMessage("Sorry, something went wrong. Please try again.", "bot");
        });
}

function normalizeEmotion(emotion) {
    const value = String(emotion || "neutral").toLowerCase();
    if (value === "angry" || value === "anger") return "stress";
    if (value === "neutral") return "calm";
    if (["happy", "sad", "anxiety", "stress", "calm"].includes(value)) return value;
    return "calm";
}

function estimateEmotion(text) {
    const value = text.toLowerCase();
    if (/(happy|great|good|excited|love)/.test(value)) return "happy";
    if (/(angry|mad|furious|annoyed)/.test(value)) return "stress";
    if (/(stress|pressure|overwhelmed|exam|workload)/.test(value)) return "stress";
    if (/(anxious|worried|panic|fear|scared)/.test(value)) return "anxiety";
    if (/(sad|low|down|tired|lonely)/.test(value)) return "sad";
    return "calm";
}

function refreshEmotionUI(activeEmotion, data = null) {
    const cards = document.querySelectorAll("[data-emotion-card]");
    const percentages = data || demoEmotionPercentages;
    cards.forEach((card) => {
        const emotion = card.dataset.emotionCard;
        const score = card.querySelector("strong");
        const value = Math.max(0, Math.min(100, Math.round(percentages[emotion] || 0)));
        if (score) score.textContent = value + "%";
        card.classList.toggle("active", emotion === activeEmotion);
    });

    if (emotionStatus) {
        const label = activeEmotion.charAt(0).toUpperCase() + activeEmotion.slice(1);
        emotionStatus.textContent = label;
    }
    if (heroSentiment) {
        heroSentiment.textContent = activeEmotion === "calm" ? "Calm trend stable" : "Detected " + activeEmotion + " signal";
    }
    drawSentimentWave(activeEmotion);
}

function getCanvasContext(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width || canvas.width));
    const height = Math.max(160, Math.floor(rect.height || canvas.height));
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return {ctx, width, height};
}

function drawSentimentWave(emotion = "neutral") {
    const setup = getCanvasContext(sentimentCanvas);
    if (!setup) return;
    const {ctx, width, height} = setup;
    ctx.clearRect(0, 0, width, height);

    const colors = {
        happy: "#10b981",
        sad: "#2563EB",
        anxiety: "#f59e0b",
        stress: "#06B6D4",
        calm: "#06B6D4",
        neutral: "#06B6D4"
    };
    const amplitude = emotion === "calm" || emotion === "neutral" ? 18 : emotion === "happy" ? 24 : emotion === "stress" ? 36 : 30;
    const mid = height / 2;

    ctx.fillStyle = "rgba(255,255,255,0.035)";
    for (let x = 0; x < width; x += 32) {
        ctx.fillRect(x, 0, 1, height);
    }
    for (let y = 24; y < height; y += 32) {
        ctx.fillRect(0, y, width, 1);
    }

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, colors[emotion] || colors.neutral);
    gradient.addColorStop(0.5, "#2563EB");
    gradient.addColorStop(1, "#06B6D4");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
        const y = mid + Math.sin(x / 22) * amplitude + Math.sin(x / 47) * (amplitude / 2.5);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(6, 182, 212, 0.16)";
    ctx.fillRect(0, mid + amplitude + 22, width, 1);
}

function drawMoodTrend(moodData = null) {
    const setup = getCanvasContext(moodTrendCanvas);
    if (!setup) return;
    const {ctx, width, height} = setup;
    ctx.clearRect(0, 0, width, height);

    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const base = moodData ? [
        moodData.happy + 2,
        moodData.neutral + 3,
        moodData.anxiety + 2,
        moodData.sad + 2,
        moodData.happy + moodData.neutral + 1,
        moodData.happy + 4,
        moodData.neutral + 5
    ] : [4, 5, 3, 6, 5, 8, 7];

    const max = Math.max(...base, 8);
    const pad = 34;
    const chartW = width - pad * 2;
    const chartH = height - pad * 2;

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
        const y = pad + (chartH / 3) * i;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(width - pad, y);
        ctx.stroke();
    }

    const points = base.map((value, index) => {
        const x = pad + (chartW / (base.length - 1)) * index;
        const y = pad + chartH - (value / max) * chartH;
        return {x, y, value};
    });

    const fill = ctx.createLinearGradient(0, pad, 0, height - pad);
    fill.addColorStop(0, "rgba(37, 99, 235, 0.16)");
    fill.addColorStop(1, "rgba(37, 99, 235, 0)");

    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(points[points.length - 1].x, height - pad);
    ctx.lineTo(points[0].x, height - pad);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    const stroke = ctx.createLinearGradient(pad, 0, width - pad, 0);
    stroke.addColorStop(0, "#2563EB");
    stroke.addColorStop(0.55, "#06B6D4");
    stroke.addColorStop(1, "#2563EB");
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    points.forEach((point, index) => {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#2563EB";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#9fb0c6";
        ctx.font = "12px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(labels[index], point.x, height - 10);
    });
}

function drawDashboardMoodChart(moodData = null) {
    const setup = getCanvasContext(dashboardMoodCanvas);
    if (!setup) return;
    const {ctx, width, height} = setup;
    ctx.clearRect(0, 0, width, height);

    const data = moodData || {happy: 2, sad: 1, angry: 0, anxiety: 2, neutral: 3};
    const rows = [
        ["Happy", data.happy || 0, "#10b981"],
        ["Sad", data.sad || 0, "#2563EB"],
        ["Anger", data.angry || 0, "#ef4444"],
        ["Anxiety", data.anxiety || 0, "#f59e0b"],
        ["Neutral", data.neutral || 0, "#06B6D4"]
    ];
    const max = Math.max(...rows.map((row) => row[1]), 1);
    const pad = 28;
    const barArea = width - 150;
    const gap = 14;
    const barHeight = Math.max(18, (height - pad * 2 - gap * (rows.length - 1)) / rows.length);

    ctx.font = "13px Inter, system-ui, sans-serif";
    rows.forEach((row, index) => {
        const y = pad + index * (barHeight + gap);
        const valueWidth = Math.max(6, (row[1] / max) * barArea);
        ctx.fillStyle = "#9fb0c6";
        ctx.textAlign = "left";
        ctx.fillText(row[0], 18, y + barHeight / 2 + 5);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        roundRect(ctx, 92, y, barArea, barHeight, 7, true);
        ctx.fillStyle = row[2];
        roundRect(ctx, 92, y, valueWidth, barHeight, 7, true);
        ctx.fillStyle = "#eef6ff";
        ctx.textAlign = "right";
        ctx.fillText(String(row[1]), width - 18, y + barHeight / 2 + 5);
    });
}

function roundRect(ctx, x, y, width, height, radius, fill) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
}

function fetchMoodData() {
    fetch("/mood")
        .then((response) => response.json())
        .then((data) => {
            const total = Math.max(1, Object.values(data).reduce((sum, value) => sum + Number(value || 0), 0));
            const percentages = {
                happy: ((data.happy || 0) / total) * 100,
                sad: ((data.sad || 0) / total) * 100,
                anxiety: ((data.anxiety || 0) / total) * 100,
                calm: ((data.neutral || 0) / total) * 100,
                stress: (((data.anxiety || 0) + (data.sad || 0) + (data.angry || 0)) / Math.max(1, total * 1.8)) * 100
            };
            refreshEmotionUI(latestEmotion, total > 1 ? percentages : demoEmotionPercentages);
            drawMoodTrend(data);
            drawDashboardMoodChart(data);
        })
        .catch(() => {
            refreshEmotionUI(latestEmotion);
            drawMoodTrend();
            drawDashboardMoodChart();
        });
}

function summarizeJournal() {
    const entry = document.getElementById("journal-entry");
    const summary = document.getElementById("journal-summary");
    if (!entry || !summary) return;

    const text = entry.value.trim();
    let tone = "reflective";
    if (/(happy|good|grateful|proud|excited)/i.test(text)) tone = "hopeful";
    if (/(stress|exam|deadline|pressure|anxious|worried)/i.test(text)) tone = "stressed";
    if (/(sad|lonely|tired|low|hurt)/i.test(text)) tone = "tender";

    const wordCount = text ? text.split(/\s+/).length : 0;
    const message = wordCount
        ? "This entry sounds " + tone + " and highlights " + wordCount + " words of self-reflection. Aura suggests one grounding action and one supportive conversation today."
        : "Add a few lines and Aura will summarize the emotional pattern here.";

    summary.innerHTML = "<strong>AI summary</strong><p>" + escapeHtml(message) + "</p>";
}

function answerRagQuestion() {
    const query = document.getElementById("rag-query");
    const answer = document.getElementById("rag-answer");
    if (!query || !answer) return;

    const text = query.value.trim();
    const lowered = text.toLowerCase();
    let response = "Retrieved resources suggest starting with one small, low-pressure action, then tracking how your body and thoughts respond over time.";

    if (lowered.includes("sleep")) {
        response = "Retrieved sleep resources prioritize a consistent wind-down routine, reduced screen stimulation, and a calmer pre-bed reflection.";
    } else if (lowered.includes("stress") || lowered.includes("exam")) {
        response = "Retrieved stress resources point to paced breathing, splitting tasks into short blocks, and naming the next controllable step.";
    } else if (lowered.includes("anxiety") || lowered.includes("panic")) {
        response = "Retrieved anxiety resources emphasize grounding through breath, present-moment sensory cues, and reaching out to a trusted person when distress rises.";
    }

    answer.innerHTML = "<strong>Evidence-aware response</strong><p>" + escapeHtml(response) + "</p>";
}

function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function startBreathingCycle() {
    const state = document.getElementById("breathing-state");
    const button = document.getElementById("breathing-button");
    if (!state || !button) return;

    const phases = ["Inhale 4", "Hold 4", "Exhale 6", "Rest 2"];
    clearInterval(breathingTimer);
    breathingIndex = 0;
    button.classList.add("active");
    state.textContent = phases[breathingIndex];
    breathingTimer = setInterval(() => {
        breathingIndex = (breathingIndex + 1) % phases.length;
        state.textContent = phases[breathingIndex];
    }, 1400);
}

if (micButton) {
    micButton.addEventListener("click", () => {
        if (!recognition) {
            setVoiceStatus("Voice input is not available in this browser.");
            return;
        }
        recognition.start();
    });
}

const voicePanelButton = document.getElementById("voice-panel-button");
if (voicePanelButton) {
    voicePanelButton.addEventListener("click", () => {
        if (!recognition) {
            setVoiceStatus("Voice input is not available in this browser.");
            return;
        }
        recognition.start();
    });
}

if (emojiButton && emojiPicker) {
    emojiButton.addEventListener("click", () => {
        emojiPicker.classList.toggle("hidden");
    });
}

if (emojiPicker && messageInput) {
    emojiPicker.addEventListener("click", (event) => {
        if (event.target.tagName !== "BUTTON") return;
        messageInput.value += event.target.textContent;
        messageInput.focus();
    });
}

if (sendButton) sendButton.addEventListener("click", sendMessage);
if (messageInput) {
    messageInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") sendMessage();
    });
}

document.querySelectorAll(".mood-chip").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".mood-chip").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        latestEmotion = button.dataset.mood === "anxious" ? "anxiety" : normalizeEmotion(button.dataset.mood);
        refreshEmotionUI(latestEmotion);
    });
});

document.querySelectorAll(".segmented-control button").forEach((button) => {
    button.addEventListener("click", () => {
        button.parentElement.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        drawMoodTrend();
    });
});

const summarizeButton = document.getElementById("summarize-journal");
if (summarizeButton) summarizeButton.addEventListener("click", summarizeJournal);

const ragSearch = document.getElementById("rag-search");
if (ragSearch) ragSearch.addEventListener("click", answerRagQuestion);

const ragQuery = document.getElementById("rag-query");
if (ragQuery) {
    ragQuery.addEventListener("keydown", (event) => {
        if (event.key === "Enter") answerRagQuestion();
    });
}

const breathingButton = document.getElementById("breathing-button");
if (breathingButton) breathingButton.addEventListener("click", startBreathingCycle);

window.addEventListener("resize", () => {
    drawSentimentWave(latestEmotion);
    drawMoodTrend();
    drawDashboardMoodChart();
});

window.addEventListener("load", () => {
    if (messageInput) messageInput.focus();
    refreshEmotionUI(latestEmotion);
    fetchMoodData();
});
