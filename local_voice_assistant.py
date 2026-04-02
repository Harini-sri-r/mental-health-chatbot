import speech_recognition as sr
import pyttsx3
import requests
import time

# Configure TTS Engine
engine = pyttsx3.init()
engine.setProperty('rate', 150)
voices = engine.getProperty('voices')
for voice in voices:
    if "female" in voice.name.lower() or "zira" in voice.name.lower():
        engine.setProperty('voice', voice.id)
        break

def speak(text):
    print(f"Aura: {text}")
    # Remove HTML tags returned from backend
    clean_text = text.replace("<br>", "\n").replace("<b>", "").replace("</b>", "")
    engine.say(clean_text)
    engine.runAndWait()

def listen():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("\n[Aura is listening...]")
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        try:
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=15)
            text = recognizer.recognize_google(audio)
            print(f"You: {text}")
            return text
        except sr.WaitTimeoutError:
            return None
        except sr.UnknownValueError:
            print("[Could not understand audio]")
            return None
        except sr.RequestError as e:
            print(f"[Could not request results; {e}]")
            return None

def main():
    print("=======================================")
    print(" Aura AI Therapist - Local Voice Demo  ")
    print("=======================================")
    
    # Needs the flask app running on port 5000
    API_URL = "http://127.0.0.1:5000/chat"
    
    speak("Hi Harini, I'm Aura, your AI therapist. How are you feeling today?")
    
    while True:
        user_input = listen()
        if user_input:
            if user_input.lower() in ["quit", "exit", "stop"]:
                speak("Goodbye Harini. Take care.")
                break
                
            try:
                # Send to our locally running backend endpoint!
                response = requests.post(API_URL, json={"message": user_input})
                if response.status_code == 200:
                    data = response.json()
                    bot_reply = data.get("response", "I'm not sure what to say.")
                    # Mimic the 1.5s typing delay to feel like the web app
                    time.sleep(1.5)
                    speak(bot_reply)
                else:
                    print(f"[Backend Error: {response.status_code}]")
            except requests.exceptions.ConnectionError:
                print("[Error: Flask server is not running! Please start app.py first.]")
                break

if __name__ == "__main__":
    main()
