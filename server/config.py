# server/config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration class."""
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/ttrpg_ai_npc_db')
    DB_NAME = MONGO_URI.split('/')[-1].split('?')[0] if MONGO_URI else 'ttrpg_ai_npc_db' # Added a default for DB_NAME if MONGO_URI is somehow None
    FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'a_default_secret_key')

    # It's good practice to check for essential keys after loading.
    # if not GEMINI_API_KEY:
    #     print("Warning: GEMINI_API_KEY not found. AI features may be limited.")
    # if not MONGO_URI:
    #     raise ValueError("No MONGO_URI set for Bugbear Banter. Please set it in your .env file.")

config = Config()