import sqlite3
import os
from typing import List, Dict, Any, Optional
from datetime import datetime

# The database will be stored in the /app/data mapped volume
DB_DIR = "/app/data"
DB_FILE = os.path.join(DB_DIR, "swat4_activity.db")

def init_db():
    if not os.path.exists(DB_DIR):
        try:
            os.makedirs(DB_DIR)
        except OSError:
            pass # In case permissions prevent, we fallback to memory or handle
            
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    
    # Create the activities table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_name TEXT NOT NULL,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Check if there are columns, add index for faster retrieval by timestamp
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC)")
    
    # Create the role_settings table for RBAC Profiles
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS role_settings (
            role_name TEXT PRIMARY KEY,
            settings TEXT NOT NULL
        )
    """)
    
    conn.commit()
    conn.close()

import json

def get_role_settings(role_name: str) -> dict:
    """Retrieve settings for a specific role."""
    try:
        conn = sqlite3.connect(DB_FILE, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute("SELECT settings FROM role_settings WHERE role_name = ?", (role_name,))
        row = cursor.fetchone()
        conn.close()
        if row and row[0]:
            return json.loads(row[0])
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to fetch role settings: {e}")
    return {}

def set_role_settings(role_name: str, settings_dict: dict):
    """Save settings for a specific role."""
    try:
        conn = sqlite3.connect(DB_FILE, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO role_settings (role_name, settings) VALUES (?, ?) ON CONFLICT(role_name) DO UPDATE SET settings=excluded.settings",
            (role_name, json.dumps(settings_dict))
        )
        conn.commit()
        conn.close()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to save role settings: {e}")

def log_activity(username: str, action: str, entity_type: str, entity_name: str, details: str = ""):
    """Log an activity to SQLite database."""
    try:
        conn = sqlite3.connect(DB_FILE, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO activities (username, action, entity_type, entity_name, details) 
               VALUES (?, ?, ?, ?, ?)""",
            (username, action, entity_type, entity_name, details)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to log activity: {e}")

def get_activities(limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
    """Retrieve activities from SQLite database."""
    try:
        conn = sqlite3.connect(DB_FILE, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM activities ORDER BY timestamp DESC LIMIT ? OFFSET ?", 
            (limit, offset)
        )
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to fetch activities: {e}")
        return []
