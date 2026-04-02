import sqlite3
from datetime import datetime, timedelta
import random

def seed_database():
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    
    # Try creating table just in case
    try:
        c.execute('''CREATE TABLE IF NOT EXISTS chat
                     (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, sender TEXT, message TEXT, emotion TEXT, topic TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    except Exception:
        pass

    session_id = "demo_session_123"
    topics = ["exam", "family", "relationship", "health"]
    
    # Generate 7 days of historical data showing improvement
    for days_ago in range(6, -1, -1):
        target_date = datetime.now() - timedelta(days=days_ago)
        date_str = target_date.strftime("%Y-%m-%d 12:00:00")
        
        # Day 6-5: High anxiety, some sad
        if days_ago >= 5:
            emotions = ["anxiety"] * 4 + ["sad"] * 2 + ["neutral"]
        # Day 4-3: Mixed, starting to get better
        elif days_ago >= 3:
            emotions = ["anxiety"] * 2 + ["neutral"] * 3 + ["happy"] * 1
        # Day 2-0: Happy and neutral
        else:
            emotions = ["happy"] * 3 + ["neutral"] * 2 + ["anxiety"] * 1
            
        # Insert 5-8 random messages per day
        num_messages = random.randint(5, 8)
        for _ in range(num_messages):
            emotion = random.choice(emotions)
            topic = random.choice(topics)
            # Insert User message
            c.execute("INSERT INTO chat (session_id, sender, message, emotion, topic, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                      (session_id, "user", f"Demo message feeling {emotion}", emotion, topic, date_str))
            
    conn.commit()
    conn.close()
    print("Database seeded with 7 days of historical demo data!")

if __name__ == "__main__":
    seed_database()
