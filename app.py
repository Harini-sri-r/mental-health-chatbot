from flask import Flask, request, jsonify, render_template, session
from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer
import torch
import sqlite3
import random

app = Flask(__name__)
app.secret_key = "secret123"

# =========================
# LOAD MODELS
# =========================
print("Loading models...")

emotion_pipeline = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base"
)

tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-small")
model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-small")
model.eval()

print("Models loaded!")

# =========================
# DATABASE
# =========================
def init_db():
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS chat
                 (sender TEXT, message TEXT, emotion TEXT)''')
    conn.commit()
    conn.close()

init_db()

fallback_responses = [
    "I'm here for you 💙",
    "Tell me more 😊",
    "I'm listening 🤍",
    "That sounds important 💭",
    "You can talk to me freely 😊"
]

def save_chat(sender, message, emotion=None):
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute("INSERT INTO chat VALUES (?, ?, ?)", (sender, message, emotion))
    conn.commit()
    conn.close()

# =========================
# 🚨 CRISIS DETECTION
# =========================
def crisis_detection(text):
    text = text.lower()
    words = [
        "suicide", "kill myself", "end my life",
        "i want to die", "hopeless",
        "die", "kill"
    ]
    return any(word in text for word in words)

def crisis_response():
    return """I'm really sorry you're feeling this way 💙  
You are not alone.

📞 India Helpline: 9152987821  
Talk to someone you trust.

I'm here with you 🤍"""

# =========================
# 🧠 EMOTION DETECTION
# =========================
def detect_emotion(text):
    try:
        result = emotion_pipeline(text)[0]['label']

        # Normalize labels
        mapping = {
            "joy": "happy",
            "sadness": "sad",
            "anger": "angry",
            "fear": "sad",
            "love": "happy"
        }
        return mapping.get(result, "neutral")
    except:
        return "neutral"

# =========================
# 🤖 AI RESPONSE
# =========================
def generate_ai_response(user_input, emotion):

    chat_history_ids = session.get("chat_history_ids")

    if chat_history_ids is not None:
        chat_history_ids = torch.tensor(chat_history_ids)

    prompt = f"User feels {emotion}. Respond supportively: {user_input}"

    new_input_ids = tokenizer.encode(prompt + tokenizer.eos_token, return_tensors='pt')

    if chat_history_ids is not None:
        bot_input_ids = torch.cat([chat_history_ids, new_input_ids], dim=-1)
    else:
        bot_input_ids = new_input_ids

    with torch.no_grad():
        chat_history_ids = model.generate(
            bot_input_ids,
            max_length=150,
            pad_token_id=tokenizer.eos_token_id,
            do_sample=True,
            top_k=30,
            top_p=0.9
        )

    chat_history_ids = chat_history_ids[:, -150:]
    session["chat_history_ids"] = chat_history_ids.tolist()

    response = tokenizer.decode(
        chat_history_ids[:, bot_input_ids.shape[-1]:][0],
        skip_special_tokens=True
    ).strip()

    normalized = [resp.lower() for resp in fallback_responses]
    if len(response) < 2 or response.lower() in normalized:
        return random.choice(fallback_responses)

    return response

# =========================
# ROUTES
# =========================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        user_input = data.get("message", "").strip()

        if not user_input:
            return jsonify({"response": "Please type something 😊"})

        emotion = detect_emotion(user_input)
        save_chat("user", user_input, emotion)

        # Crisis
        if crisis_detection(user_input):
            response = crisis_response()
            save_chat("bot", response, emotion)
            return jsonify({"response": response})

        # Simple responses
        simple = {
            "hi": "Hello 😊 How are you feeling today?",
            "hello": "Hi there 👋 How are you doing today?"
        }

        if user_input.lower() in simple:
            return jsonify({"response": simple[user_input.lower()]})

        # AI response
        try:
            response = generate_ai_response(user_input, emotion)
        except:
            response = random.choice(fallback_responses)

        save_chat("bot", response, emotion)

        return jsonify({"response": response})

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"response": "⚠️ Something went wrong"})

# =========================
# MOOD DASHBOARD
# =========================
@app.route("/mood")
def mood():
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute("SELECT emotion FROM chat WHERE sender='user'")
    data = [row[0] for row in c.fetchall()]
    conn.close()

    return jsonify({
        "happy": data.count("happy"),
        "sad": data.count("sad"),
        "angry": data.count("angry"),
        "neutral": data.count("neutral")
    })

@app.route("/dashboard")
def dashboard():
    return render_template("mood.html")

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(debug=True)