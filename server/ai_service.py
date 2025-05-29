# ai_service.py
import google.generativeai as genai
from config import config
from typing import Optional
from models import NPCProfile, DialogueRequest

GENERATIVE_MODEL_NAME = "gemini-1.5-flash"
genai_configured_successfully = False # Flag to track configuration

try:
    # --- FIX: Use config.GEMINI_API_KEY instead of config.GOOGLE_API_KEY ---
    if config.GEMINI_API_KEY: # Only attempt if key exists
        genai.configure(api_key=config.GEMINI_API_KEY)
        # Add a check here if possible, e.g., try listing models
        # For now, we'll assume if no exception, it's superficially okay
        print("Google AI SDK configured (or attempted).")
        genai_configured_successfully = True 
    else:
        # --- FIX: Updated warning message for clarity ---
        print("Warning: GEMINI_API_KEY not found in config. Skipping genai.configure.")
except AttributeError:
    print("Warning: google.generativeai.configure failed (AttributeError). Library might be improperly installed or API key structure issue.")
except Exception as e:
    print(f"Warning: An error occurred during google.generativeai.configure: {e}. API key might be invalid or other issue.")

class AIService:
    def __init__(self, model_name: str = GENERATIVE_MODEL_NAME):
        self.model = None # Start with model as None
        if genai_configured_successfully: # Only try to init model if configure seemed okay
            try:
                self.model = genai.GenerativeModel(model_name)
                print(f"Generative AI model '{model_name}' initialized.")
            except Exception as e:
                print(f"Error initializing Generative AI model '{model_name}' after configuration attempt: {e}")
                self.model = None # Ensure model is None if init fails
        else:
            print(f"Skipping Generative AI model initialization because SDK configuration failed or was skipped.")

    def generate_npc_dialogue(self, npc: NPCProfile, dialogue_request: DialogueRequest, world_lore_summary: Optional[str] = None) -> str:
        if self.model is None: # Check changed to 'is None'
            print("AI Service Error: Model is not available for dialogue generation.")
            # --- FIX: Updated error message for clarity ---
            return "Error: AI model not available. Please check configuration and GEMINI_API_KEY."
        
        # ... (rest of your generate_npc_dialogue method)
        # Ensure this part is robust if self.model is somehow not what's expected
        try:
            # ... (your existing prompt building logic) ...
            prompt_parts = [
                f"You are an AI assistant generating dialogue for a Non-Player Character (NPC) in a tabletop role-playing game (TTRPG).",
                f"NPC Name: {npc.name}",
                f"NPC Description: {npc.description}",
                f"NPC Personality: {', '.join(npc.personality_traits)}",
            ]
            if npc.background_story:
                prompt_parts.append(f"NPC Background: {npc.background_story}")
            if npc.motivations:
                prompt_parts.append(f"NPC Motivations: {', '.join(npc.motivations)}")
            if npc.knowledge:
                prompt_parts.append(f"NPC Knowledge: {', '.join(npc.knowledge)}")
            if npc.memories:
                prompt_parts.append("Recent relevant memories for the NPC:")
                for mem in npc.memories[-3:]:
                    prompt_parts.append(f"- ({mem.timestamp.strftime('%Y-%m-%d %H:%M')}, type: {mem.type}): {mem.content}")
            if world_lore_summary:
                prompt_parts.append(f"Relevant World Lore/Context: {world_lore_summary}")
            prompt_parts.append(f"\nCurrent Scene Context: {dialogue_request.scene_context}")
            if dialogue_request.active_pcs:
                prompt_parts.append(f"Player Characters present: {', '.join(dialogue_request.active_pcs)}")
            if dialogue_request.recent_dialogue_history:
                prompt_parts.append("\nRecent Dialogue History (last few lines):")
                for line in dialogue_request.recent_dialogue_history:
                    prompt_parts.append(f"- {line}")
            if dialogue_request.player_utterance:
                prompt_parts.append(f"\nThe player character says to {npc.name}: \"{dialogue_request.player_utterance}\"")
                prompt_parts.append(f"\nWhat does {npc.name} say in response? (Be creative, in character, and concise):")
            else:
                prompt_parts.append(f"\nWhat does {npc.name} say or do given the current context? (Be creative, in character, and concise, can be an observation, a statement, or a question):")
            prompt = "\n".join(prompt_parts)

            response = self.model.generate_content(prompt)

            # ... (your existing response handling logic) ...
            if response.parts:
                if response.prompt_feedback and response.prompt_feedback.block_reason:
                    return f"AI generation blocked. Reason: {response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason}"
                candidate = response.candidates[0]
                if candidate.finish_reason not in [1, 'STOP', 'stop']: 
                    print(f"Warning: AI generation finished with reason: {candidate.finish_reason}")
                    # If content is still usable, return it
                    if candidate.content and candidate.content.parts:
                         return candidate.content.parts[0].text.strip()
                    # Otherwise, indicate an issue based on finish reason
                    return f"AI generation finished unexpectedly (Reason: {candidate.finish_reason}). No complete content."
                # Standard successful response text extraction
                return response.text.strip() if hasattr(response, 'text') and response.text else response.candidates[0].content.parts[0].text.strip()
            else: # No parts in response
                if response.prompt_feedback and response.prompt_feedback.block_reason:
                     return f"AI generation blocked. Reason: {response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason}"
                return "AI did not generate a response. The prompt might have been blocked or an issue occurred (no parts in response)."
        except Exception as e:
            print(f"Error during AI dialogue generation: {e}")
            return f"Error: Exception during AI dialogue generation. {e}"


ai_service_instance = AIService()

# Example Usage (optional, for testing directly)
if __name__ == '__main__':
    if ai_service_instance.model:
        # (Your example usage code from before is fine here)
        sample_npc_data = {
            "name": "Elder Elara",
            "description": "A wise old herbalist living at the edge of the Whispering Woods.",
            "personality_traits": ["calm", "observant", "slightly mysterious", "knowledgeable about herbs"],
            "knowledge": ["Healing properties of moonpetal flowers", "Legends of the Whispering Woods"],
            "memories": [ # Assuming MemoryItem structure from models.py
                {"timestamp": "2024-05-29T12:00:00Z", "content": "A young adventurer asked about the Shadowfen last week.", "type": "observation", "source": "dialogue"}
            ]
        }
        # Need to import MemoryItem if you construct it here, or pass dicts if NPCProfile expects them.
        # from models import MemoryItem # if you were to construct MemoryItem objects directly here
        sample_npc = NPCProfile(**sample_npc_data)
        
        sample_dialogue_req_data = {
             "npc_id": "elara001", 
             "scene_context": "The adventurers approach Elara's hut as dusk settles. The air is chilly.",
             "player_utterance": "Greetings, Elder Elara. We seek your wisdom about a rare herb.",
             "active_pcs": ["Valerius the Knight", "Lyra the Rogue"],
             "recent_dialogue_history": ["GM: You see a small, well-kept hut with smoke curling from its chimney."]
        }
        sample_dialogue_req = DialogueRequest(**sample_dialogue_req_data)

        dialogue = ai_service_instance.generate_npc_dialogue(sample_npc, sample_dialogue_req, "The Whispering Woods are known to be ancient and hold many secrets.")
        print(f"\nGenerated Dialogue for {sample_npc.name}: {dialogue}")

    else:
        print("AI Service model not loaded, skipping direct test.")