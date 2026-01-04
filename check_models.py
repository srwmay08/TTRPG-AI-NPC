import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def list_available_models():
    api_key = os.environ.get('GOOGLE_API_KEY') or os.environ.get('GEMINI_API_KEY')
    
    if not api_key:
        print("CRITICAL: No API Key found in .env (GOOGLE_API_KEY or GEMINI_API_KEY).")
        return

    try:
        genai.configure(api_key=api_key)
        print(f"Successfully authenticated with API Key: {api_key[:5]}...{api_key[-4:]}")
        print("\n--- Available Generative Models (supporting 'generateContent') ---")
        
        found = False
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"Name: {m.name}")
                print(f"  - Display Name: {m.display_name}")
                print(f"  - Version: {m.version}")
                print("-" * 30)
                found = True
        
        if not found:
            print("No models found that support 'generateContent'.")
            
    except Exception as e:
        print(f"\nERROR: Failed to list models. Details:\n{e}")

if __name__ == "__main__":
    list_available_models()