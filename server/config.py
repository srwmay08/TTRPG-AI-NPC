# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration class."""
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') # Use GEMINI_API_KEY
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/ttrpg_ai_npc_db')
    DB_NAME = MONGO_URI.split('/')[-1].split('?')[0]
    FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'a_default_secret_key')

    if not GEMINI_API_KEY: # Use GEMINI_API_KEY
        raise ValueError("No GEMINI_API_KEY set for Bugbear Banter. Please set it in your .env file.")
    if not MONGO_URI:
        raise ValueError("No MONGO_URI set for Bugbear Banter. Please set it in your .env file.")

config = Config()