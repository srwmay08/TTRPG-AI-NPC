"""
server/ai_service.py
Responsibility: Handles interactions with the Google Generative AI API (Gemini).
"""
import os
import google.generativeai as genai
from google.api_core import exceptions
import logging
from config import config  # Import the configuration object

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIService:
    def __init__(self, api_key, model_name='gemini-1.5-flash-latest'):
        self.api_key = api_key
        self.model_name = model_name
        self.model = None
        self._configure_genai()

    def _configure_genai(self):
        if not self.api_key:
            logger.warning("Google API Key not provided. AI features will be disabled.")
            return

        try:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(self.model_name)
            logger.info(f"Generative AI model '{self.model_name}' initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize Generative AI model: {e}")
            self.model = None

    def generate_npc_dialogue(self, npc, dialogue_request, current_pc_standing, speaking_pc_name, world_lore_summary, detailed_character_history, canned_conversations):
        """
        Generates dialogue for an NPC based on their profile, the scene, and conversation history.
        Arguments match the calling signature in app.py.
        """
        if not self.model:
            return "Error: AI Service not initialized or API key missing."

        # Extract data from Pydantic models or dicts
        player_utterance = dialogue_request.player_utterance
        scene_context = dialogue_request.scene_context
        recent_history = dialogue_request.recent_dialogue_history
        active_pcs = dialogue_request.active_pcs

        # 1. Construct the Prompt
        prompt = self._construct_system_prompt(npc, scene_context, active_pcs, detailed_character_history, world_lore_summary, current_pc_standing)
        
        # Add History
        if recent_history:
            prompt += "\n--- Recent Conversation History ---\n"
            for entry in recent_history:
                # Handle history items whether they are strings or dicts
                if isinstance(entry, dict):
                    prompt += f"{entry.get('speaker', 'Unknown')}: {entry.get('text', '')}\n"
                else:
                    prompt += f"{entry}\n"
        
        prompt += f"\n--- Your Task ---\nPlayer ({speaking_pc_name}) says: \"{player_utterance}\"\n"
        
        # Add Output Structure Instruction
        prompt += """
--- Additional Suggestions (Required Output) ---
After your dialogue, you MUST provide the following suggestions in the exact format below. Do not omit any section. Use 'None' if not applicable.
NPC_ACTION: [Suggest three brief, distinct non-verbal actions or internal thoughts for the NPC, separated by semicolons.]
PLAYER_CHECK: [Suggest one skill check a player might reasonably attempt in response.]
GENERATED_TOPICS: [Suggest two brief, interesting follow-up questions the player could ask you, separated by a semicolon.]
STANDING_CHANGE_SUGGESTION_FOR_PLAYER: [Suggest a new standing level (Ally, Warmly, Kindly, Amiable, Indifferent, Apprehensive, Dubious, Threatening) for the speaker OR 'No change']
JUSTIFICATION: [Briefly explain why the standing should change or why it remains the same]
----- END PROMPT -----
"""

        # 2. Call the API
        try:
            print(f"----- AI PROMPT for {npc.name} -----\n{prompt}\n----- END PROMPT -----")
            
            response = self.model.generate_content(prompt)
            return response.text

        except exceptions.NotFound:
            logger.warning(f"Model '{self.model_name}' not found. Attempting fallback to 'gemini-pro'.")
            try:
                fallback_model = genai.GenerativeModel('gemini-pro')
                response = fallback_model.generate_content(prompt)
                return response.text
            except Exception as e:
                logger.error(f"Fallback model failed: {e}")
                return f"Error: Exception during AI dialogue generation (Fallback failed): {str(e)}"

        except Exception as e:
            logger.error(f"Error during AI dialogue generation for {npc.name}: {e}")
            import traceback
            traceback.print_exc()
            return f"Error: Exception during AI dialogue generation - {type(e).__name__}. Check server logs."

    def summarize_interaction_for_memory(self, player_input, npc_response):
        """Generates a short memory summary."""
        if not self.model: return "Interaction occurred (AI Summary Unavailable)."
        
        prompt = f"""Summarize the following interaction into a single concise sentence to be stored as a memory for the NPC. Focus on factual events or new information revealed.
        Player: {player_input}
        NPC: {npc_response}
        Summary:"""
        
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception:
            return "Interaction occurred."

    def _construct_system_prompt(self, npc, scene_context, active_pcs, history, lore, standing):
        """Builds the comprehensive system prompt."""
        # Handle both Pydantic models and dictionaries
        def get_attr(obj, attr, default):
            if hasattr(obj, attr): return getattr(obj, attr)
            if isinstance(obj, dict): return obj.get(attr, default)
            return default

        name = get_attr(npc, 'name', 'Unknown NPC')
        desc = get_attr(npc, 'description', 'A generic NPC.')
        traits = ", ".join(get_attr(npc, 'personality_traits', []))
        
        # Faction Standings
        standings_text = f"Your current standing towards the speaker is: {standing}." if standing else "You currently have no specific established standing towards the speaker."

        pcs_present = ", ".join(active_pcs) if active_pcs else "No specific PCs identified."

        prompt = f"""You are embodying the character of {name} in a tabletop roleplaying game.
--- Your Core Identity ---
Name: {name}
Description: {desc}
Personality Traits: {traits}
Age: {get_attr(npc, 'age', 'Unknown')}.
Race: {get_attr(npc, 'race', 'Unknown')}.
Class/Role: {get_attr(npc, 'class_role', 'Unknown')}.
Alignment: {get_attr(npc, 'alignment', 'Unknown')}.

--- Your Detailed History ---
{history}

--- World Lore Knowledge ---
{lore}

--- Your Current Disposition ---
{standings_text} Assume a neutral or initial reaction based on the context unless specified otherwise.

--- Current Situation ---
Scene: {scene_context}
Other Player Characters present: {pcs_present}
"""
        return prompt

# --- INSTANTIATE GLOBAL SERVICE ---
# This is the line that was missing and causing the ImportError
ai_service_instance = AIService(
    api_key=config.GOOGLE_API_KEY, 
    model_name=config.GENERATIVE_AI_MODEL_NAME
)