# server/ai_service.py
import google.generativeai as genai
from config import config
from typing import Optional, List, Dict, Any
import traceback

from models import NPCProfile, DialogueRequest, FactionStandingLevel

GENERATIVE_MODEL_NAME = "gemini-1.5-flash"
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
                self.generation_config = genai.types.GenerationConfig(
                    temperature=0.75,
                    top_p=0.95,
                    top_k=40,
                    max_output_tokens=450
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
            response = self.model.generate_content(prompt)

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
                              npc: NPCProfile,
                              dialogue_request: DialogueRequest,
                              current_pc_standing: Optional[FactionStandingLevel] = None,
                              speaking_pc_name: Optional[str] = "the player",
                              world_lore_summary: Optional[str] = None,
                              detailed_character_history: Optional[str] = None,
                              canned_conversations: Optional[Dict[str, str]] = None) -> str:
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

            if detailed_character_history and detailed_character_history.strip():
                prompt_parts.append("\n--- Your Detailed History (Draw upon this deeply) ---")
                prompt_parts.append(detailed_character_history.strip())

            if world_lore_summary and world_lore_summary.strip() and world_lore_summary.lower() != "no specific linked lore." and world_lore_summary.lower() != "no specific linked lore found or summaries generated.":
                prompt_parts.append("\n--- Relevant World Lore & Context (Refer to this) ---")
                prompt_parts.append(world_lore_summary.strip())
            else:
                 prompt_parts.append(f"\n(No specific detailed history or linked world lore beyond your general background is provided for this interaction.)")

            if canned_conversations:
                prompt_parts.append("\n--- Pre-defined Conversation Topics ---")
                prompt_parts.append("If the player's utterance is a direct match or clear inquiry about one of the following topics, you MUST use the provided response verbatim. This is a directive.")
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
                prompt_parts.append("This standing has consequences:")
                prompt_parts.append("  Ally: Required for Rank 5 Faction Missions.")
                prompt_parts.append("  Warmly: You are friendly and helpful.")
                prompt_parts.append("  Kindly: You are polite and might offer minor aid.")
                prompt_parts.append("  Amiable: You are generally pleasant and open to interaction.")
                prompt_parts.append("  Indifferent: You are neutral and business-like.")
                prompt_parts.append("  Apprehensive: You are wary and might be uncooperative.")
                prompt_parts.append("  Dubious: You are suspicious and likely to be unhelpful or deceitful.")
                prompt_parts.append("  Threatening: Kill-on-sight.")
                prompt_parts.append(f"Let your {current_pc_standing.value} standing heavily influence your tone, willingness to share information, and general demeanor towards {speaking_pc_name}.")
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
                canned_response_text = dialogue_request.player_utterance.split('The response was: "')[1].rsplit('"', 1)[0]
                prompt_parts.append(f"A system event or directive has occurred.")
                prompt_parts.append(f"Your character has already spoken the following pre-determined line: \"{canned_response_text}\"")
                main_instruction = f"Based on what you just said, your ONLY task is to generate the suggestions that follow. Do NOT repeat or generate new dialogue. Your output MUST start with 'NPC_ACTION:' and contain all the suggestion fields."
            elif dialogue_request.player_utterance and dialogue_request.player_utterance.strip():
                player_utterance_is_system_directive = dialogue_request.player_utterance.strip().startswith("(System Directive:")
                if player_utterance_is_system_directive:
                    prompt_parts.append(f"A system event or directive has occurred: \"{dialogue_request.player_utterance.strip()}\"")
                    main_instruction = f"Respond IN CHARACTER as {npc.name} to this event/directive. Your response should be ONLY your spoken dialogue or a brief description of your reaction. Do not narrate actions (unless minor parenthetical, e.g., '(chuckles)'). Do not break character. Consider all provided context, especially any linked lore and your history."
                else:
                    prompt_parts.append(f"{speaking_pc_name} says to you, {npc.name}: \"{dialogue_request.player_utterance.strip()}\"")
                    main_instruction = f"Respond IN CHARACTER as {npc.name}. Your response should be ONLY your spoken dialogue. Do not narrate actions (unless minor parenthetical, e.g., '(chuckles)'). Do not break character. Directly address {speaking_pc_name} if appropriate. Consider all provided context, especially any linked lore and your history."
            else:
                main_instruction = f"Describe what you, {npc.name}, say or do in this situation. Be concise and in character. Your response should be primarily your spoken dialogue. Do not break character. Consider all provided context, especially any linked lore and your history."
            
            prompt_parts.append(main_instruction)

            prompt_parts.append("\n--- Additional Suggestions (Required Output) ---")
            prompt_parts.append(f"After your dialogue, you MUST provide the following suggestions in the exact format below. Do not omit any section. Use 'None' if not applicable.")
            prompt_parts.append(f"NPC_ACTION: [Suggest three brief, distinct non-verbal actions or internal thoughts for {npc.name}, separated by semicolons. Example: Scratches chin thoughtfully; Decides to offer a quest if they seem trustworthy; Glances towards the door]")
            prompt_parts.append(f"PLAYER_CHECK: [Suggest one skill check a player might reasonably attempt in response, e.g., 'Insight to detect deception', 'Persuasion to ask for a discount', 'History to recall the mentioned battle.']")
            prompt_parts.append(f"GENERATED_TOPICS: [Suggest two brief, interesting follow-up questions the player could ask you, based on what you said, separated by a semicolon. Example: Ask about my lost friend; Ask why the Zhentarim are involved]")
            prompt_parts.append(f"STANDING_CHANGE_SUGGESTION_FOR_{dialogue_request.speaking_pc_id if dialogue_request.speaking_pc_id else 'PLAYER'}: [Suggest a new standing level ({', '.join([s.value for s in FactionStandingLevel])}) for {speaking_pc_name} OR 'No change']")
            prompt_parts.append(f"JUSTIFICATION: [Briefly explain why the standing should change or why it remains the same, based on the interaction]")

            prompt = "\n".join(prompt_parts)

            print(f"\n----- AI PROMPT for {npc.name} -----")
            print(prompt)
            print("----- END PROMPT -----\n")

            response = self.model.generate_content(prompt)

            if response.prompt_feedback and response.prompt_feedback.block_reason:
                block_reason_msg = response.prompt_feedback.block_reason_message or response.prompt_feedback.block_reason
                detailed_error = f"AI generation blocked for {npc.name}. Reason: {block_reason_msg}."
                print(detailed_error)
                return f"({npc.name} hesitates, unable to speak on that matter due to certain restrictions. [{block_reason_msg}])\nNPC_ACTION: None\nPLAYER_CHECK: None\nGENERATED_TOPICS: None\nSTANDING_CHANGE_SUGGESTION_FOR_{dialogue_request.speaking_pc_id if dialogue_request.speaking_pc_id else 'PLAYER'}: No change\nJUSTIFICATION: AI content blocked."

            if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                full_ai_output = "".join(part.text for part in response.candidates[0].content.parts if hasattr(part, 'text')).strip()
                
                if is_canned_response_directive:
                    canned_response_text = dialogue_request.player_utterance.split('The response was: "')[1].rsplit('"', 1)[0]
                    return f"{canned_response_text}\n{full_ai_output}"
                else:
                    return full_ai_output
            else:
                error_message = f"AI did not generate a response for {npc.name}. Candidates: {response.candidates}"
                print(f"Warning: {error_message}")
                return f"({npc.name} seems lost in thought and doesn't respond.)\nNPC_ACTION: None\nPLAYER_CHECK: None\nGENERATED_TOPICS: None\nSTANDING_CHANGE_SUGGESTION_FOR_{dialogue_request.speaking_pc_id if dialogue_request.speaking_pc_id else 'PLAYER'}: No change\nJUSTIFICATION: No response generated."

        except Exception as e:
            error_details = f"Error during AI dialogue generation for {npc.name}: {e}"
            print(error_details)
            traceback.print_exc()
            return f"Error: Exception during AI dialogue generation - {type(e).__name__}. Check server logs.\nNPC_ACTION: None\nPLAYER_CHECK: None\nGENERATED_TOPICS: None\nSTANDING_CHANGE_SUGGESTION_FOR_{dialogue_request.speaking_pc_id if dialogue_request.speaking_pc_id else 'PLAYER'}: No change\nJUSTIFICATION: Internal server error."

ai_service_instance = AIService()