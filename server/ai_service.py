# ai_service.py
import google.generativeai as genai
from config import config # Assuming config.py is in the same directory or accessible
from typing import Optional, List, Dict, Any # Added Dict, Any
import traceback

# Assuming your models are defined in models.py
# from models import NPCProfile, DialogueRequest # NPCProfile used for type hinting

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
                # Model configuration for safety and generation
                self.generation_config = genai.types.GenerationConfig(
                    temperature=0.7,
                    top_p=0.95,
                    top_k=40,
                    max_output_tokens=300 # Increased slightly
                )
                self.safety_settings = [
                    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                ]
                self.model = genai.GenerativeModel(
                    model_name,
                    generation_config=self.generation_config,
                    safety_settings=self.safety_settings
                )
                print(f"Generative AI model '{model_name}' initialized.")
            except Exception as e:
                print(f"Error initializing Generative AI model '{model_name}': {e}")
                traceback.print_exc()
                self.model = None
        else:
            print(f"Skipping Generative AI model initialization because SDK configuration failed or was skipped.")
            
    def summarize_interaction_for_memory(self, player_utterance: str, npc_response: str) -> str:
        if self.model is None:
            print("AI Service Error: Model not available for memory summarization.")
            return f"Player: {player_utterance} / NPC: {npc_response}" # Fallback
        try:
            prompt = (
                "You are a summarization assistant for a TTRPG. "
                "Condense the following player-NPC interaction into a single, concise memory for the NPC. "
                "Focus on the key facts, entities, and the emotional tone of the exchange. "
                "Start with a verb. For example: 'Learned that...', 'Agreed to...', 'Became suspicious of...'.\n\n"
                f"Player's statement: \"{player_utterance}\"\n"
                f"NPC's response: \"{npc_response}\"\n\n"
                "Concise memory (third person perspective for the NPC, e.g., 'He learned that...' or 'She felt...'):"
            )
            response = self.model.generate_content(prompt)
            
            # Handle potential lack of 'text' attribute and check for blocking
            if response.prompt_feedback and response.prompt_feedback.block_reason:
                block_reason_msg = response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason
                print(f"Memory summarization blocked. Reason: {block_reason_msg}")
                return f"Interaction regarding '{player_utterance}' occurred."
            
            if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                return response.candidates[0].content.parts[0].text.strip()
            else:
                print(f"Warning: AI did not generate parts for memory summarization. Response: {response}")
                return f"Interaction regarding '{player_utterance}' occurred."

        except Exception as e:
            print(f"Error during memory summarization: {e}")
            traceback.print_exc()
            return f"Player asked about '{player_utterance}', and I responded."

    def generate_npc_dialogue(self, 
                              npc: 'NPCProfile', # Forward reference if NPCProfile is in models.py
                              dialogue_request: 'DialogueRequest', # Forward reference
                              world_lore_summary: Optional[str] = None,
                              detailed_character_history: Optional[str] = None) -> str:
        if self.model is None:
            print("AI Service Error: Model is not available for dialogue generation.")
            return "Error: AI model not available. Please check configuration and GEMINI_API_KEY."
        
        try:
            prompt_parts = [
                f"You are embodying the character of {npc.name} in a tabletop roleplaying game.",
                "--- Your Core Identity ---",
                f"Name: {npc.name}",
                f"Description: {npc.description}",
                f"Personality Traits: {', '.join(npc.personality_traits) if npc.personality_traits else 'Not specified'}.",
            ]
            if npc.age: prompt_parts.append(f"Age: {npc.age}.")
            if npc.race: prompt_parts.append(f"Race: {npc.race}.")
            if npc.class_str: prompt_parts.append(f"Class/Role: {npc.class_str}.")
            if npc.alignment: prompt_parts.append(f"Alignment: {npc.alignment}.")
            if npc.speech_patterns: prompt_parts.append(f"Typical Speech Style: {npc.speech_patterns}")
            if npc.mannerisms: prompt_parts.append(f"Common Mannerisms: {npc.mannerisms}")


            if npc.background_story:
                prompt_parts.append(f"\n--- Your General Background ---")
                prompt_parts.append(npc.background_story)
            
            # <<< MODIFICATION: Use detailed_character_history >>>
            if detailed_character_history and detailed_character_history.strip():
                prompt_parts.append("\n--- Your Detailed History & Relevant Lore (Draw upon this deeply) ---")
                prompt_parts.append(detailed_character_history.strip())
            else:
                prompt_parts.append(f"\n(No specific detailed history beyond your general background is provided for this interaction.)")

            if npc.motivations:
                prompt_parts.append(f"\nYour Motivations: {', '.join(npc.motivations)}")
            
            if npc.memories: # Use raw memories if present
                relevant_memories = npc.memories[-5:] 
                if relevant_memories:
                    memory_summary = "\n".join([f"- ({mem.type} on {mem.timestamp.strftime('%Y-%m-%d %H:%M')} from {mem.source}): {mem.content}" for mem in relevant_memories])
                    prompt_parts.append("\n--- Your Recent Memories (Most recent first) ---")
                    prompt_parts.append(memory_summary)
            
            if world_lore_summary:
                prompt_parts.append(f"\nGeneral World Lore Context: {world_lore_summary}")
            
            prompt_parts.append(f"\n--- Current Situation ---")
            prompt_parts.append(f"Scene: {dialogue_request.scene_context if dialogue_request.scene_context.strip() else 'A general setting.'}")
            if dialogue_request.active_pcs:
                prompt_parts.append(f"Player Characters present: {', '.join(dialogue_request.active_pcs)}")

            if dialogue_request.recent_dialogue_history:
                prompt_parts.append("\n--- Recent Conversation (Most recent line last) ---")
                prompt_parts.append("\n".join(dialogue_request.recent_dialogue_history))
            
            prompt_parts.append("\n--- Your Task ---")
            if dialogue_request.player_utterance and dialogue_request.player_utterance.strip():
                prompt_parts.append(f"A player character says to you, {npc.name}: \"{dialogue_request.player_utterance.strip()}\"")
                prompt_parts.append(f"\nRespond IN CHARACTER as {npc.name}. Your response should be ONLY your spoken dialogue. Do not narrate actions (unless minor parenthetical, e.g., '(chuckles)'). Do not break character. Directly address the player if appropriate. Consider all provided context about yourself and the situation.")
            else: # For ambient or initial NPC lines if player_utterance is empty
                prompt_parts.append(f"\nDescribe what you, {npc.name}, say or do in this situation. Be concise and in character. Your response should be primarily your spoken dialogue. Do not break character. Consider all provided context.")
            
            prompt = "\n".join(prompt_parts)
            
            # --- For Debugging: Print the full prompt ---
            print(f"\n----- AI PROMPT for {npc.name} -----")
            print(prompt)
            print("----- END PROMPT -----\n")

            response = self.model.generate_content(
                prompt,
                # generation_config and safety_settings are now part of model initialization
            )

            if response.prompt_feedback and response.prompt_feedback.block_reason:
                block_reason_msg = response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason
                detailed_error = f"AI generation blocked for {npc.name}. Reason: {block_reason_msg}."
                print(detailed_error)
                # Check for safety ratings if available
                if response.prompt_feedback.safety_ratings:
                    print("Safety Ratings:")
                    for rating in response.prompt_feedback.safety_ratings:
                        print(f"  Category: {rating.category}, Probability: {rating.probability.name}")
                return f"({npc.name} hesitates, unable to speak on that matter due to certain restrictions. [{block_reason_msg}])"


            if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                # Ensure all parts are text and join them if necessary
                npc_response_text = "".join(part.text for part in response.candidates[0].content.parts if hasattr(part, 'text')).strip()
                if not npc_response_text: # If text is empty after joining (e.g. if parts were not text)
                     print(f"Warning: AI response parts for {npc.name} were empty or not text. Full response: {response}")
                     return f"({npc.name} considers this but remains silent.)"
                return npc_response_text
            else: 
                print(f"Warning: AI did not generate response parts for {npc.name}. Full response: {response}")
                return f"({npc.name} seems lost in thought and doesn't respond.)"

        except Exception as e:
            print(f"Error during AI dialogue generation for {npc.name}: {e}")
            traceback.print_exc()
            return f"Error: Exception during AI dialogue generation - {type(e).__name__}. Check server logs."

ai_service_instance = AIService()