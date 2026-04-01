# Mental Health Assistant Chatbot

This project is a conversational web application designed to support users by understanding their emotional state and responding in a helpful and empathetic way.
Unlike basic rule-based chatbots, this system combines natural language processing with real-time interaction to simulate meaningful conversations.

---

## Key Features

* AI-powered chatbot for natural conversations
* Emotion detection from user input
* Crisis detection with immediate support responses
* Chat history stored using a database
* Mood tracking dashboard to visualize emotional trends

---

## Technologies Used

* Python (Flask) for backend development
* Hugging Face Transformers for NLP models
* HTML, CSS, JavaScript for frontend
* SQLite for data storage
* Chart.js for data visualization

---

## How It Works

1. The user sends a message through the chat interface
2. The system analyzes the message to detect emotion
3. If critical phrases are detected, a safety response is triggered
4. Otherwise, the AI model generates a contextual reply
5. The interaction is stored and later used for mood analysis

---

## Dashboard

The dashboard provides a visual summary of user emotions over time, helping identify patterns such as frequent sadness or stress.

---

## Run the Project

```bash
pip install -r requirements.txt
python app.py
```

Then open:
http://127.0.0.1:5000
