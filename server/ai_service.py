# ai_service.py
import google.generativeai as genai
from config import config
from typing import Optional # <<< --- ADD THIS LINE
from models import NPCProfile, DialogueRequest # For type hinting if needed

# Configure the Generative AI client
try:
    genai.configure(api_key=config.GOOGLE_API_KEY)
    # For list_models, you need to use a client object (less common for basic generation)
    # For general generation, configuring the default API key is sufficient.
except AttributeError: # This might be the cause of the warning below.
    print("Warning: google.generativeai.configure failed. Make sure the library is installed and API key is valid.")
    # Potentially handle this more gracefully if genai is critical at import time.
except Exception as e: # Catching a broader range of potential configuration errors
    print(f"Warning: An error occurred during google.generativeai.configure: {e}. Make sure the library is installed and API key is valid.")


# Choose a model (e.g., 'gemini-1.5-flash' or 'gemini-pro')
# You can list available models:
# for m in genai.list_models():
#   if 'generateContent' in m.supported_generation_methods:
#     print(m.name)
GENERATIVE_MODEL_NAME = "gemini-1.5-flash" # Or your preferred model

class AIService:
    """Service for interacting with Google's Generative AI."""

    def __init__(self, model_name: str = GENERATIVE_MODEL_NAME):
        try:
            self.model = genai.GenerativeModel(model_name)
            print(f"Generative AI model '{model_name}' initialized.")
        except Exception as e:
            print(f"Error initializing Generative AI model '{model_name}': {e}")
            self.model = None

    def generate_npc_dialogue(self, npc: NPCProfile, dialogue_request: DialogueRequest, world_lore_summary: Optional[str] = None) -> str:
        """
        Generates dialogue for an NPC based on its profile, scene context, and player utterance.
        """
        if not self.model:
            return "Error: AI model not initialized."

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

        # Include relevant memories (simplistic approach for now, just last few or most relevant)
        if npc.memories:
            prompt_parts.append("Recent relevant memories for the NPC:")
            # For now, let's take the last 3 memories. We'll refine memory retrieval later.
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

        try:
            response = self.model.generate_content(prompt)
            if response.parts:
                if response.prompt_feedback and response.prompt_feedback.block_reason:
                    return f"AI generation blocked. Reason: {response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason}"
                
                candidate = response.candidates[0]
                if candidate.finish_reason not in [1, 'STOP', 'stop']: 
                    print(f"Warning: AI generation finished with reason: {candidate.finish_reason}")
                    if candidate.content and candidate.content.parts:
                         return candidate.content.parts[0].text.strip()
                    return "AI generation finished unexpectedly. No content."
                return response.text.strip() if hasattr(response, 'text') and response.text else response.candidates[0].content.parts[0].text.strip()
            else:
                if response.prompt_feedback and response.prompt_feedback.block_reason:
                     return f"AI generation blocked. Reason: {response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason}"
                return "AI did not generate a response. The prompt might have been blocked or an issue occurred."
        except Exception as e:
            print(f"Error generating dialogue with AI: {e}")
            return f"Error: Could not get dialogue from AI. {e}"

# Initialize AI Service
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