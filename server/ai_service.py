# ai_service.py
import google.generativeai as genai
from config import config
from typing import Optional, List
from models import NPCProfile, DialogueRequest

GENERATIVE_MODEL_NAME = "gemini-1.5-flash"
genai_configured_successfully = False # Flag to track configuration

try:
    if config.GEMINI_API_KEY: # Only attempt if key exists
        genai.configure(api_key=config.GEMINI_API_KEY)
        # Add a check here if possible, e.g., try listing models
        # For now, we'll assume if no exception, it's superficially okay
        print("Google AI SDK configured (or attempted).")
        genai_configured_successfully = True 
    else:
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
            
    def summarize_interaction_for_memory(self, player_utterance: str, npc_response: str) -> str:
        """
        Takes a player utterance and NPC response and creates a concise memory summary.
        """
        if self.model is None:
            return "Player said: " + player_utterance # Fallback
        try:
            prompt = (
                "You are a summarization assistant for a TTRPG. "
                "Condense the following player-NPC interaction into a single, concise memory for the NPC. "
                "Focus on the key facts, entities, and the emotional tone of the exchange. "
                "Start with a verb. For example: 'Learned that...', 'Agreed to...', 'Became suspicious of...'.\n\n"
                f"Player's statement: \"{player_utterance}\"\n"
                f"NPC's response: \"{npc_response}\"\n\n"
                "Concise memory:"
            )
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Error during memory summarization: {e}")
            return f"Player asked about '{player_utterance}', and I responded."


    def generate_npc_dialogue(self, npc: NPCProfile, dialogue_request: DialogueRequest, world_lore_summary: Optional[str] = None) -> str:
        if self.model is None: # Check changed to 'is None'
            print("AI Service Error: Model is not available for dialogue generation.")
            return "Error: AI model not available. Please check configuration and GEMINI_API_KEY."
        
        try:
            prompt_parts = [
                f"You are an AI assistant generating dialogue for an NPC named {npc.name} in a TTRPG.",
                f"Your core identity: {npc.description}",
                f"Your personality is: {', '.join(npc.personality_traits)}.",
            ]
            if npc.background_story:
                prompt_parts.append(f"Your background: {npc.background_story}")
            if npc.motivations:
                prompt_parts.append(f"Your motivations: {', '.join(npc.motivations)}")

            # --- ENHANCEMENT A: NPC MEMORY RECALL ---
            if npc.memories:
                # Use recent memories as a proxy for relevance. A more advanced implementation could use semantic search.
                relevant_memories = npc.memories[-5:] # Use last 5 for more context
                if relevant_memories:
                    memory_summary = "\n".join([f"- {mem.content}" for mem in relevant_memories])
                    prompt_parts.append("\n--- Your Relevant Memories ---")
                    prompt_parts.append("Consider these past events. Do not state them as a list, but let them influence your tone, knowledge, and what you say.")
                    prompt_parts.append(memory_summary)
                    prompt_parts.append("---------------------------\n")

            if world_lore_summary:
                prompt_parts.append(f"Relevant World Lore: {world_lore_summary}")
            
            prompt_parts.append(f"\nCurrent Scene: {dialogue_request.scene_context}")
            if dialogue_request.active_pcs:
                prompt_parts.append(f"Player Characters present: {', '.join(dialogue_request.active_pcs)}")

            # --- ENHANCEMENT B: NPC-TO-NPC AWARENESS ---
            if dialogue_request.recent_dialogue_history:
                prompt_parts.append("\n--- Recent Conversation ---")
                prompt_parts.append("This is what was said just before now. You can react to other characters' statements if it's natural.")
                prompt_parts.append("\n".join(dialogue_request.recent_dialogue_history))
                prompt_parts.append("-------------------------\n")

            if dialogue_request.player_utterance:
                prompt_parts.append(f"\nThe player character says to you: \"{dialogue_request.player_utterance}\"")
                prompt_parts.append(f"\nWhat do you say in response? Be creative and stay in character.")
            else:
                prompt_parts.append(f"\nWhat do you say or do given the context? Be creative and stay in character.")
            prompt = "\n".join(prompt_parts)

            response = self.model.generate_content(prompt)

            if response.parts:
                if response.prompt_feedback and response.prompt_feedback.block_reason:
                    return f"AI generation blocked. Reason: {response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason}"
                return response.text.strip() if hasattr(response, 'text') and response.text else response.candidates[0].content.parts[0].text.strip()
            else: # No parts in response
                if response.prompt_feedback and response.prompt_feedback.block_reason:
                     return f"AI generation blocked. Reason: {response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason}"
                return "AI did not generate a response. The prompt might have been blocked or an issue occurred."
        except Exception as e:
            print(f"Error during AI dialogue generation: {e}")
            return f"Error: Exception during AI dialogue generation. {e}"


ai_service_instance = AIService()