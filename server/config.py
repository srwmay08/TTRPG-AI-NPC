"""
server/config.py
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

class Config:
    """Base configuration."""
    # Standard Flask config name is SECRET_KEY
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev_secret_key_change_in_production'
    
    # MongoDB Configuration
    MONGO_URI = os.environ.get('MONGO_URI') or 'mongodb://localhost:27017/ttrpg_ai_npc_db'
    DB_NAME = 'ttrpg_ai_npc_db'
    
    # Google AI Configuration
    # Checks for GOOGLE_API_KEY first, falls back to GEMINI_API_KEY for backward compatibility
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY') or os.environ.get('GEMINI_API_KEY')
    
    # Using the stable 'latest' alias or fallback to 'gemini-pro'
    GENERATIVE_AI_MODEL_NAME = os.environ.get('GENERATIVE_AI_MODEL_NAME') or 'gemini-flash-latest'

    # Application Settings
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'json'}
    
    # Directories
    PRIMARY_DATA_DIR = os.path.join(UPLOAD_FOLDER)
    VTT_IMPORT_DIR = os.path.join(UPLOAD_FOLDER, 'vtt_imports')
    HISTORY_DATA_DIR = os.path.join(UPLOAD_FOLDER, 'history')
    LORE_DATA_DIR = os.path.join(UPLOAD_FOLDER, 'lore')

    # Ensure directories exist
    for directory in [UPLOAD_FOLDER, VTT_IMPORT_DIR, HISTORY_DATA_DIR, LORE_DATA_DIR]:
        if not os.path.exists(directory):
            os.makedirs(directory)

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False

# Select configuration based on environment
env_name = os.environ.get('FLASK_ENV', 'development')
if env_name == 'production':
    config = ProductionConfig()
else:
    config = DevelopmentConfig()