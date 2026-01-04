# server/ai_service.py
from google import genai
from google.genai import types
from config import config
from typing import Optional, List, Dict, Any
import traceback

from models import NPCProfile, DialogueRequest, FactionStandingLevel

# The new SDK handles model names robustly. 
# "gemini-1.5-flash" is the recommended model for speed/cost.
GENERATIVE_MODEL_NAME = "gemini-2.5-flash"

class AIService:
    def __init__(self, model_name: str = GENERATIVE_MODEL_NAME):
        self.client = None
        self.model_name = model_name
        
        if config.GEMINI_API_KEY:
            try:
                # NEW SDK INITIALIZATION
                self.client = genai.Client(api_key=config.GEMINI_API_KEY)
                print(f"Google GenAI Client initialized for model '{model_name}'.")
            except Exception as e:
                print(f"Error initializing Google GenAI Client: {e}")
                traceback.print_exc()
        else:
            print("Warning: GEMINI_API_KEY not found in config. AI features will be disabled.")

        # Configuration for generation (temperature, safety settings, etc.)
        self.generation_config = types.GenerateContentConfig(
            temperature=0.75,
            top_p=0.95,
            top_k=40,
            max_output_tokens=1000,
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_MEDIUM_AND_ABOVE"
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_MEDIUM_AND_ABOVE"
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_MEDIUM_AND_ABOVE"
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_MEDIUM_AND_ABOVE"
                ),
            ]
        )

    def summarize_interaction_for_memory(self, player_utterance: str, npc_response: str) -> str:
        if not self.client:
            print("AI Service Error: Client not initialized.")
            return f"Player: {player_utterance} / NPC: {npc_response}"
        
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
            
            # NEW GENERATION CALL
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=self.generation_config
            )

            if response.text:
                return response.text.strip()
            else:
                print(f"Warning: AI response empty. Reason: {response.candidates[0].finish_reason if response.candidates else 'Unknown'}")
                return f"Interaction regarding '{player_utterance}' occurred."

        except Exception as e:
            print(f"Error during memory summarization: {e}")
            traceback.print_exc()
            return f"Player asked about '{player_utterance}', and I responded."

    def generate_npc_dialogue(self,
                              npc: NPCProfile,
                              dialogue_request: DialogueRequest,
                              current_pc_standing: Optional[FactionStandingLevel] = None,
                              speaking_pc_name: Optional[str] = "the player",
                              world_lore_summary: Optional[str] = None,
                              detailed_character_history: Optional[str] = None,
                              canned_conversations: Optional[Dict[str, str]] = None) -> str:
        if not self.client:
            print("AI Service Error: Client not initialized.")
            return "Error: AI model not available. Please check configuration and GEMINI_API_KEY."

        try:
            # --- PROMPT CONSTRUCTION (Same as before) ---
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

            if detailed_character_history and detailed_character_history.strip():
                prompt_parts.append("\n--- Your Detailed History (Draw upon this deeply) ---")
                prompt_parts.append(detailed_character_history.strip())

            if world_lore_summary and world_lore_summary.strip() and "no specific linked lore" not in world_lore_summary.lower():
                prompt_parts.append("\n--- Relevant World Lore & Context (Refer to this) ---")
                prompt_parts.append(world_lore_summary.strip())
            else:
                 prompt_parts.append(f"\n(No specific detailed history or linked world lore beyond your general background is provided for this interaction.)")

            if canned_conversations:
                prompt_parts.append("\n--- Pre-defined Conversation Topics ---")
                prompt_parts.append("If the player's utterance is a direct match or clear inquiry about one of the following topics, you MUST use the provided response verbatim.")
                for topic, response in canned_conversations.items():
                    prompt_parts.append(f"Topic Keyword: '{topic}'")
                    prompt_parts.append(f"Your Canned Response: \"{response}\"")

            if npc.motivations:
                prompt_parts.append(f"\nYour Motivations: {', '.join(npc.motivations)}")

            if npc.memories:
                relevant_memories = npc.memories[-5:]
                if relevant_memories:
                    memory_summary = "\n".join([f"- ({mem.type} on {mem.timestamp.strftime('%Y-%m-%d %H:%M')} from {mem.source}): {mem.content}" for mem in relevant_memories])
                    prompt_parts.append("\n--- Your Recent Memories (Most recent first) ---")
                    prompt_parts.append(memory_summary)


            prompt_parts.append(f"\n--- Your Current Disposition towards {speaking_pc_name} ---")
            if current_pc_standing:
                prompt_parts.append(f"Your current standing towards {speaking_pc_name} is: {current_pc_standing.value}.")
                prompt_parts.append("Standing Levels: Ally > Warmly > Kindly > Amiable > Indifferent > Apprehensive > Dubious > Threatening.")
                prompt_parts.append(f"Let your {current_pc_standing.value} standing heavily influence your tone and willingness to help.")
            else:
                prompt_parts.append(f"You currently have no specific established standing towards {speaking_pc_name}. Assume a neutral or initial reaction based on the context.")

            prompt_parts.append(f"\n--- Current Situation ---")
            prompt_parts.append(f"Scene: {dialogue_request.scene_context if dialogue_request.scene_context.strip() else 'A general setting.'}")
            if dialogue_request.active_pcs:
                prompt_parts.append(f"Other Player Characters present: {', '.join(dialogue_request.active_pcs)}")

            if dialogue_request.recent_dialogue_history:
                prompt_parts.append("\n--- Recent Conversation (Most recent line last) ---")
                prompt_parts.append("\n".join(dialogue_request.recent_dialogue_history))

            prompt_parts.append("\n--- Your Task ---")
            
            is_canned_response_directive = dialogue_request.player_utterance and dialogue_request.player_utterance.strip().startswith("(System Directive: Canned Response Used)")

            if is_canned_response_directive:
                # Logic for handling system directive for canned response
                try:
                    canned_response_text = dialogue_request.player_utterance.split('The response was: "')[1].rsplit('"', 1)[0]
                    prompt_parts.append(f"A system event has occurred. You have already spoken: \"{canned_response_text}\"")
                    main_instruction = f"Based on what you just said, generate the suggestions (Action, Check, Topics, Standing) ONLY. Do NOT generate dialogue."
                except IndexError:
                     # Fallback if parsing fails
                     main_instruction = "Generate actions and suggestions based on the previous canned response."
            elif dialogue_request.player_utterance and dialogue_request.player_utterance.strip():
                if dialogue_request.player_utterance.strip().startswith("(System Directive:"):
                    prompt_parts.append(f"System Directive: \"{dialogue_request.player_utterance.strip()}\"")
                    main_instruction = f"Respond IN CHARACTER as {npc.name}. Only speak dialogue or brief reaction descriptions."
                else:
                    prompt_parts.append(f"{speaking_pc_name} says: \"{dialogue_request.player_utterance.strip()}\"")
                    main_instruction = f"Respond IN CHARACTER as {npc.name}. Only speak dialogue. Do not narrate actions unless minor parentheticals."
            else:
                main_instruction = f"Describe what you, {npc.name}, say or do. Be concise and in character."
            
            prompt_parts.append(main_instruction)

            prompt_parts.append("\n--- Additional Suggestions (Required Output) ---")
            prompt_parts.append(f"After your dialogue, you MUST provide the following suggestions in the exact format below.")
            prompt_parts.append(f"NPC_ACTION: [Three brief non-verbal actions, separated by semicolons]")
            prompt_parts.append(f"PLAYER_CHECK: [One relevant skill check suggestion]")
            prompt_parts.append(f"GENERATED_TOPICS: [Two brief follow-up questions, separated by semicolons]")
            prompt_parts.append(f"STANDING_CHANGE_SUGGESTION_FOR_{dialogue_request.speaking_pc_id if dialogue_request.speaking_pc_id else 'PLAYER'}: [New standing level OR 'No change']")
            prompt_parts.append(f"JUSTIFICATION: [Brief explanation]")

            prompt = "\n".join(prompt_parts)

            print(f"\n----- AI PROMPT for {npc.name} -----")
            # print(prompt) # Uncomment to debug full prompt
            print("----- END PROMPT -----\n")

            # NEW GENERATION CALL
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=self.generation_config
            )

            # Accessing text in the new SDK
            if response.text:
                full_ai_output = response.text.strip()
                
                if is_canned_response_directive:
                    try:
                        canned_response_text = dialogue_request.player_utterance.split('The response was: "')[1].rsplit('"', 1)[0]
                        return f"{canned_response_text}\n{full_ai_output}"
                    except:
                        return full_ai_output
                else:
                    return full_ai_output
            else:
                # Handle blocked or empty responses
                error_msg = "AI output blocked or empty."
                if response.candidates and response.candidates[0].finish_reason:
                     error_msg += f" Reason: {response.candidates[0].finish_reason}"
                print(f"Warning: {error_msg}")
                return f"({npc.name} seems lost in thought.)\nNPC_ACTION: None\nPLAYER_CHECK: None\nGENERATED_TOPICS: None\nSTANDING_CHANGE_SUGGESTION_FOR_PLAYER: No change\nJUSTIFICATION: {error_msg}"

        except Exception as e:
            error_details = f"Error during AI dialogue generation for {npc.name}: {e}"
            print(error_details)
            traceback.print_exc()
            return f"Error: Exception during AI dialogue generation - {type(e).__name__}.\nNPC_ACTION: None\nPLAYER_CHECK: None\nGENERATED_TOPICS: None\nSTANDING_CHANGE_SUGGESTION_FOR_PLAYER: No change\nJUSTIFICATION: Internal server error."

ai_service_instance = AIService()