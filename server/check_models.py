# server/check_models.py
from google import genai
from config import config

# Initialize client
if not config.GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY is missing from config.")
else:
    try:
        client = genai.Client(api_key=config.GEMINI_API_KEY)
        print(f"Checking available models for your API key...")
        print("-" * 40)
        
        # List all models without filtering attributes
        count = 0
        for m in client.models.list():
            print(f"Found model: {m.name}")
            count += 1
        
        if count == 0:
            print("No models found. Check your API key permissions.")
        print("-" * 40)
        
    except Exception as e:
        print(f"Error connecting to Google API: {e}")