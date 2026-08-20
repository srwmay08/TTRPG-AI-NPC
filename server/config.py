# server/config.py
"""
Configuration Management Module.
Responsible for loading environment variables and setting up application-wide
constants, paths, and environment-specific settings (Development vs. Production).
"""
import os
from dotenv import load_dotenv

# Initialize dotenv to read key-value pairs from a local .env file into os.environ.
# This keeps secrets like API keys out of source control.
load_dotenv()

class Config:
    """
    Base configuration class.
    Contains default settings and fallback values for the application.
    """
    # Cryptographic key for Flask sessions and security. Falls back to a dev key if missing.
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev_secret_key_change_in_production'
    
    # MongoDB connection string and target database name.
    MONGO_URI = os.environ.get('MONGO_URI') or 'mongodb://localhost:27017/ttrpg_ai_npc_db'
    DB_NAME = 'ttrpg_ai_npc_db'
    
    # Retrieves the Google GenAI API key, checking two common variable names for flexibility.
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY') or os.environ.get('GEMINI_API_KEY')
    
    # Defines the specific AI model to be utilized for generation.
    GENERATIVE_AI_MODEL_NAME = os.environ.get('GENERATIVE_AI_MODEL_NAME') or 'gemini-flash-latest'

    # Dynamically resolve the absolute path to the 'data' folder relative to this file's location.
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    
    # Define acceptable file types for potential upload functionality.
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'json'}
    
    # Construct specific sub-directory paths for organizing application data.
    PRIMARY_DATA_DIR = os.path.join(UPLOAD_FOLDER)
    VTT_IMPORT_DIR = os.path.join(UPLOAD_FOLDER, 'vtt_imports')
    PC_IMPORT_DIR = os.path.join(VTT_IMPORT_DIR, 'PCs')
    HISTORY_DATA_DIR = os.path.join(UPLOAD_FOLDER, 'history')
    LORE_DATA_DIR = os.path.join(UPLOAD_FOLDER, 'lore')

    @classmethod
    def ensure_dirs(cls):
        """
        Class method to verify that all necessary data directories exist on disk.
        If a directory is missing, it creates it to prevent runtime FileNotFoundError exceptions.
        """
        for directory in [cls.UPLOAD_FOLDER, cls.VTT_IMPORT_DIR, cls.PC_IMPORT_DIR, cls.HISTORY_DATA_DIR, cls.LORE_DATA_DIR]:
            if not os.path.exists(directory):
                os.makedirs(directory)

class DevelopmentConfig(Config):
    """
    Development-specific configuration.
    Enables verbose debugging and error tracebacks.
    """
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """
    Production-specific configuration.
    Disables debugging to secure internal application logic from end-users.
    """
    DEBUG = False
    TESTING = False

# Determine which configuration profile to load based on the FLASK_ENV environment variable.
env_name = os.environ.get('FLASK_ENV', 'development')
if env_name == 'production':
    config = ProductionConfig()
else:
    config = DevelopmentConfig()

# Immediately ensure all required data directories exist when the configuration is loaded.
config.ensure_dirs()