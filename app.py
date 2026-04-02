from flask import Flask, request, jsonify, render_template, session
from transformers import pipeline
import sqlite3
import random
import os
from datetime import datetime
import importlib

try:
    openai = importlib.import_module("openai")
    openai.api_key = os.getenv("OPENAI_API_KEY")
    if openai.api_key:
        print("OpenAI API key detected. API fallback enabled.")
    else:
        openai = None
except Exception as e:
    print(f"OpenAI SDK not available: {e}")
    openai = None

app = Flask(__name__)
app.secret_key = "secret123"

# =========================
# LOAD MODELS & LLM CONFIG
# =========================
print("Loading emotion model (fast)...")
emotion_pipeline = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base"
)
print("Model loaded!")

# Setup Local AI Model (No API Key Required)
print("Loading Local LLM (Flan-T5)...")
try:
    llm_pipeline = pipeline("text2text-generation", model="google/flan-t5-small")
    print("Local LLM Loaded!")
except Exception as e:
    print(f"Error loading LLM: {e}")
    llm_pipeline = None

# =========================
# API FALLBACK
# =========================
def fetch_api_response(prompt):
    if not openai or not getattr(openai, "api_key", None):
        return None
    try:
        completion = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a supportive AI therapist. Answer empathetically, safely, and clearly."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=140,
            temperature=0.8,
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        print("OpenAI fallback failed:", e)
        return None

# =========================
# DATABASE & MEMORY
# =========================
def init_db():
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    # Ensure table handles topic and date properly
    try:
        c.execute('''CREATE TABLE IF NOT EXISTS chat
                     (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, sender TEXT, message TEXT, emotion TEXT, topic TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    except sqlite3.OperationalError:
        c.execute("ALTER TABLE chat RENAME TO chat_old")
        c.execute('''CREATE TABLE chat
                     (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, sender TEXT, message TEXT, emotion TEXT, topic TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

def get_session_id():
    if "session_id" not in session:
        session["session_id"] = os.urandom(8).hex()
    return session["session_id"]

def detect_topic(text):
    text = text.lower()
    if any(w in text for w in ["exam", "test", "grade", "study", "homework", "school", "college"]): return "exam"
    if any(w in text for w in ["relationship", "girlfriend", "boyfriend", "partner", "breakup"]): return "relationship"
    if any(w in text for w in ["family", "mom", "dad", "parents", "brother", "sister"]): return "family"
    if any(w in text for w in ["job", "work", "boss", "interview", "career"]): return "career"
    return "general"

def save_chat(sender, message, emotion="neutral", topic="general"):
    sess_id = get_session_id()
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    try:
        c.execute("INSERT INTO chat (session_id, sender, message, emotion, topic) VALUES (?, ?, ?, ?, ?)", 
                  (sess_id, sender, message, emotion, topic))
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()

def get_past_topic():
    sess_id = get_session_id()
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    try:
        c.execute("SELECT topic FROM chat WHERE session_id=? AND sender='user' AND topic != 'general' ORDER BY timestamp DESC LIMIT 1", (sess_id,))
        row = c.fetchone()
    except Exception:
        row = None
    conn.close()
    return row[0] if row else None

# =========================
# 🚨 CRISIS DETECTION
# =========================
import re

def crisis_detection(text, emotion):
    text = text.lower()

    # Ignore clear hypothetical or inquisitive phrases
    if "do you die" in text or "if i die" in text or "when i die" in text:
        return False

    severe_words = ["suicide", "kill myself", "end my life", "take my own life"]
    medium_words = ["i want to die", "i want to kill myself", "wanna die", "kill me"]
    risky_words = ["die", "kill", "hopeless", "worthless", "giving up"]

    # HIGH PRIORITY (always trigger)
    if any(w in text for w in severe_words):
        return True

    # MEDIUM (clear intent)
    if any(w in text for w in medium_words):
        return True
        
    # Catch typos like "i want tin die" using Regex (want + <any small word> + die)
    if re.search(r"want\s+\w{1,4}\s+die", text):
        return True

    # LOW (context dependent)
    if any(w in text for w in risky_words):
        # Trigger if emotion is negative
        if emotion in ["sad", "anxiety", "angry"]:
            return True
            
        # Trigger if the message is extremely short (e.g., just the word "die")
        # because the emotion model often misclassifies solitary 1-word inputs as neutral.
        if len(text.strip()) < 15:
            return True

    return False

def crisis_response():
    return """I'm really sorry you're feeling this way. 💙\nYou are not alone and things can get better.\n\n📞 Please call the India Helpline: 9152987821\nTalk to someone you trust.\n\nI'm here to listen. 🤍"""

# =========================
# 🧠 EMOTION DETECTION
# =========================
def detect_emotion(text):
    try:
        result = emotion_pipeline(text)[0]['label']
        mapping = {
            "joy": "happy",
            "sadness": "sad",
            "anger": "angry",
            "fear": "anxiety",
            "love": "happy",
            "surprise": "happy",
            "neutral": "neutral"
        }
        return mapping.get(result, "neutral")
    except:
        return "neutral"

# =========================
# 🤖 AI LLM RESPONSE
# =========================
def generate_ai_response(user_input, emotion, topic, user_name="Harini"):
    # 1. CBT Therapy Mode Handling
    state = session.get("therapy_state")
    if "help me" in user_input.lower() or "guide me" in user_input.lower() or "therapy mode" in user_input.lower():
        session["therapy_state"] = "step_1"
        return f"I'm here to guide you, {user_name}. Let's take this step-by-step. First, what happened to make you feel this way?"
        
    if state == "step_1":
        session["therapy_state"] = "step_2"
        return "I see. And how did that specific situation make you feel physically and emotionally?"
    elif state == "step_2":
        session["therapy_state"] = "step_3"
        return "That's completely valid to feel that way. Looking at the situation, what is one small thing we can actually control right now?"
    elif state == "step_3":
        session["therapy_state"] = None
        return "Excellent. Focus on that one thing you can control. Remember, everything else will pass with time. I'm always here if you want to run through this again. 💙"

    # 2. Smart Memory Recall
    past_topic = get_past_topic()
    if past_topic and past_topic != topic and random.random() < 0.2:
        return f"By the way, {user_name}, you mentioned {past_topic} stress earlier. Is that still bothering you?"

    # 3. Local LLM Driven Generation
    prompt = (
        f"You are Aura, a caring AI therapist. The user is feeling {emotion} and is talking about {topic}. "
        f"Respond with empathy, validation, and supportive guidance without sounding generic. "
        f"Keep the answer concise, safe, and human-like. User says: {user_input}"
    )
    if llm_pipeline:
        try:
            # Flan-T5 works best with direct instructional prompts
            response = llm_pipeline(prompt, max_length=60, num_return_sequences=1)[0]["generated_text"]
            if response and len(response.strip()) > 3:
                return response
        except Exception as e:
            print(f"LLM generation failed: {e}")
            pass

    # 4. API Fallback for better responses
    api_response = fetch_api_response(prompt)
    if api_response:
        return api_response

    # 5. Rule-based Fallback
    fallbacks = {
        "sad": [f"I'm sorry to hear that, {user_name}. Want to talk about it?", f"I'm here for you 💙, {user_name}."],
        "happy": ["That's great 😊! Keep smiling!", "Love seeing you happy!"],
        "anxiety": ["Take a deep breath. Let’s relax together.", "I understand. Anxiety is tough."],
        "angry": ["It's completely okay to be angry. Want to vent about it?", "Take your time. What triggered this?"],
        "neutral": ["I'm listening 🤍.", "Tell me more 😊."]
    }
    return random.choice(fallbacks.get(emotion, fallbacks["neutral"]))

# =========================
# ROUTES
# =========================
@app.route("/")
def home():
    if "user_name" not in session:
        session["user_name"] = "Harini"
    
    greeting = f"Hi 👋 I'm Aura, your AI therapist. How are you feeling today, {session['user_name']}?"
    
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    try:
        c.execute("SELECT emotion FROM chat WHERE sender='user' ORDER BY timestamp DESC LIMIT 5")
        recent_emotions = [row[0] for row in c.fetchall()]
        if recent_emotions.count('anxiety') >= 2:
            greeting = f"Hey {session['user_name']}, I noticed you've been feeling anxious lately. Want to talk about it?"
        elif recent_emotions.count('sad') >= 2:
            greeting = f"Hey {session['user_name']}, I noticed you've been a bit down lately. I'm here for you 💙"
    except Exception:
        pass
    conn.close()
    
    return render_template("index.html", greeting=greeting)

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        user_input = data.get("message", "").strip()
        user_name = session.get("user_name", "Harini")

        if not user_input:
            return jsonify({"response": "Please type something 😊"})

        emotion = detect_emotion(user_input)
        topic = detect_topic(user_input)

        if crisis_detection(user_input, emotion):
            response = crisis_response()
            save_chat("user", user_input, "sad", topic)
            save_chat("bot", response, "sad", topic)
            return jsonify({"response": response})

        save_chat("user", user_input, emotion, topic)
        response = generate_ai_response(user_input, emotion, topic, user_name)
        save_chat("bot", response, emotion, topic)

        return jsonify({"response": response, "emotion": emotion})

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"response": "⚠️ Something went wrong"})

# =========================
# MOOD DASHBOARD - SIMPLE
# =========================
@app.route("/mood")
@app.route("/mood_trends")
def mood():
    try:
        conn = sqlite3.connect("chat.db")
        c = conn.cursor()
        c.execute("SELECT emotion FROM chat WHERE sender='user'")
        data = [row[0] for row in c.fetchall()]
        conn.close()

        return jsonify({
            "happy": data.count("happy"),
            "sad": data.count("sad"),
            "angry": data.count("angry"),
            "anxiety": data.count("anxiety"),
            "neutral": data.count("neutral")
        })
    except Exception as e:
        print("Dashboard error:", e)
        return jsonify({"happy": 0, "sad": 0, "angry": 0, "anxiety": 0, "neutral": 0})

@app.route("/dashboard")
def dashboard():
    return render_template("mood.html")

if __name__ == "__main__":
    app.run(debug=True, threaded=True)