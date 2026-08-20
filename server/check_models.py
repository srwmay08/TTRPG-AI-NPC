# server/check_models.py
"""
Diagnostic script to verify Google GenAI API connectivity and list available models.
Useful for validating that the API key is active and has the correct permissions.
"""
from google import genai
from config import config

# Ensure the API key is present before attempting to initialize the client.
if not config.GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY is missing from config.")
else:
    try:
        # Initialize the GenAI client using the configured API key.
        client = genai.Client(api_key=config.GEMINI_API_KEY)
        print(f"Checking available models for your API key...")
        print("-" * 40)
        
        count = 0
        # Iterate through the generator of models provided by the client list method.
        for m in client.models.list():
            print(f"Found model: {m.name}")
            count += 1
        
        # Output a warning if the connection succeeded but the key has no model access.
        if count == 0:
            print("No models found. Check your API key permissions.")
        print("-" * 40)
        
    except Exception as e:
        # Catch and report any network, authentication, or SDK-level errors.
        print(f"Error connecting to Google API: {e}")