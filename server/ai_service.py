# ai_service.py
import google.generativeai as genai
from config import config
from typing import Optional, List
from models import NPCProfile, DialogueRequest # Assuming NPCProfile is the one from models.py

GENERATIVE_MODEL_NAME = "gemini-1.5-flash" 
# For gemini-1.5-pro, use "gemini-1.5-pro-latest" if you have access and want more power

genai_configured_successfully = False

try:
    if config.GEMINI_API_KEY:
        genai.configure(api_key=config.GEMINI_API_KEY)
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
        self.model = None
        if genai_configured_successfully:
            try:
                self.model = genai.GenerativeModel(model_name)
                print(f"Generative AI model '{model_name}' initialized.")
            except Exception as e:
                print(f"Error initializing Generative AI model '{model_name}': {e}")
                self.model = None
        else:
            print(f"Skipping Generative AI model initialization because SDK configuration failed or was skipped.")
            
    def summarize_interaction_for_memory(self, player_utterance: str, npc_response: str) -> str:
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
            return response.text.strip() if hasattr(response, 'text') else response.candidates[0].content.parts[0].text.strip()
        except Exception as e:
            print(f"Error during memory summarization: {e}")
            return f"Player asked about '{player_utterance}', and I responded."

    def generate_npc_dialogue(self, 
                              npc: NPCProfile, 
                              dialogue_request: DialogueRequest, 
                              world_lore_summary: Optional[str] = None,
                              detailed_character_history: Optional[str] = None) -> str: # New parameter
        if self.model is None:
            print("AI Service Error: Model is not available for dialogue generation.")
            return "Error: AI model not available. Please check configuration and GEMINI_API_KEY."
        
        try:
            prompt_parts = [
                f"You are an AI assistant generating dialogue for an NPC named {npc.name} in a TTRPG.",
                f"Your core identity: {npc.description}",
                f"Your personality is: {', '.join(npc.personality_traits)}.",
            ]
            if npc.age: prompt_parts.append(f"Your age: {npc.age}.")
            if npc.race: prompt_parts.append(f"Your race: {npc.race}.")
            if npc.class_str: prompt_parts.append(f"Your class/role: {npc.class_str}.")
            if npc.alignment: prompt_parts.append(f"Your alignment: {npc.alignment}.")

            if npc.background_story: # General background from JSON
                prompt_parts.append(f"\n--- Your General Background ---")
                prompt_parts.append(npc.background_story)
                prompt_parts.append("---------------------------\n")

            # Incorporate detailed history from TXT files
            if detailed_character_history:
                prompt_parts.append("\n--- Your Detailed History & Lore ---")
                prompt_parts.append("This is detailed information from your past and lore relevant to you. Use this to inform your knowledge, how you speak, and your reactions. Do not simply repeat this information; integrate it naturally into your persona.")
                prompt_parts.append(detailed_character_history)
                prompt_parts.append("----------------------------------\n")

            if npc.motivations:
                prompt_parts.append(f"Your motivations: {', '.join(npc.motivations)}")
            
            if npc.memories:
                relevant_memories = npc.memories[-5:] 
                if relevant_memories:
                    memory_summary = "\n".join([f"- ({mem.type}): {mem.content}" for mem in relevant_memories])
                    prompt_parts.append("\n--- Your Recent Memories ---")
                    prompt_parts.append("Consider these recent events. Let them influence your tone, knowledge, and what you say.")
                    prompt_parts.append(memory_summary)
                    prompt_parts.append("---------------------------\n")

            if world_lore_summary: # General world lore not specific to character history files
                prompt_parts.append(f"General World Lore Context: {world_lore_summary}")
            
            prompt_parts.append(f"\nCurrent Scene: {dialogue_request.scene_context}")
            if dialogue_request.active_pcs:
                prompt_parts.append(f"Player Characters present: {', '.join(dialogue_request.active_pcs)}")

            if dialogue_request.recent_dialogue_history:
                prompt_parts.append("\n--- Recent Conversation ---")
                prompt_parts.append("This is what was said just before now. React naturally.")
                prompt_parts.append("\n".join(dialogue_request.recent_dialogue_history))
                prompt_parts.append("-------------------------\n")

            if dialogue_request.player_utterance:
                prompt_parts.append(f"\nThe player character says to you: \"{dialogue_request.player_utterance}\"")
                prompt_parts.append(f"\nWhat do you say in response? Be creative and stay in character, drawing upon your history, memories, and personality.")
            else:
                prompt_parts.append(f"\nWhat do you say or do given the context? Be creative and stay in character, drawing upon your history, memories, and personality.")
            
            prompt_parts.append("\nYour response should be only your dialogue, without any out-of-character narration or descriptions of your actions unless explicitly part of your speech (e.g., 'I sigh...').")

            prompt = "\n".join(prompt_parts)
            # print(f"\n--- AI PROMPT for {npc.name} ---\n{prompt}\n-------------------------\n") # For debugging

            # Configuration for the generation
            generation_config = genai.types.GenerationConfig(
                temperature=0.7, # Adjust for creativity vs. predictability
                top_p=0.95,
                top_k=40,
                max_output_tokens=250 # Adjust as needed
            )

            response = self.model.generate_content(prompt, generation_config=generation_config)

            if response.parts:
                if response.prompt_feedback and response.prompt_feedback.block_reason:
                    block_reason_msg = response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason
                    print(f"AI generation blocked for {npc.name}. Reason: {block_reason_msg}")
                    return f"AI generation blocked. Reason: {block_reason_msg}"
                # Accessing text from the first candidate's content part
                return response.candidates[0].content.parts[0].text.strip()
            else: 
                block_reason_msg = "Unknown reason"
                if response.prompt_feedback and response.prompt_feedback.block_reason:
                     block_reason_msg = response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason
                print(f"AI did not generate parts for {npc.name}. Block reason: {block_reason_msg}")
                return f"AI did not generate a response. Possible block reason: {block_reason_msg}"
        except Exception as e:
            print(f"Error during AI dialogue generation for {npc.name}: {e}")
            return f"Error: Exception during AI dialogue generation. {e}"

ai_service_instance = AIService()
