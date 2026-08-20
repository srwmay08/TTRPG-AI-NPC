# TTRPG-AI-NPC(1) General Commands Manual

## NAME
**ttrpg-ai-npc** - A dynamic AI-driven Non-Player Character generator and management system for Tabletop Role-Playing Games.

## SYNOPSIS
**python app.py**
**python bot.py**

## DESCRIPTION
The **ttrpg-ai-npc** suite provides a localized ecosystem for generating context-aware, statistically grounded dialogue and behavioral responses for NPCs. Built primarily for Dungeons & Dragons 5th Edition environments, the application suite bridges Large Language Model outputs with structured campaign data.

The system is divided into two primary execution modules:
1.  **app.py**: A web-based API server designed to listen for webhooks and HTTP POST requests. It acts as the bridge between virtual tabletop environments (such as Foundry VTT) and the AI logic.
2.  **bot.py**: A Discord integration bot that allows asynchronous, text-based roleplay between players and campaign NPCs in dedicated server channels.

## OPTIONS & COMMANDS

### Discord Bot Commands (`bot.py`)
**!talk** *NPC_NAME* *MESSAGE*
> Initiates a dialogue with a specific NPC. The bot processes the *MESSAGE* against the internal lore file matching *NPC_NAME* and returns a formatted, in-character response to the channel.

### API Endpoints (`app.py`)
**POST /api/generate_response**
> Accepts a JSON payload containing `npc_id`, `player_message`, and an optional `context` string. Returns a generated dialogue string. Used for programmatic integrations with custom VTT macros or automated narrative scripts.

## ENVIRONMENT
The suite requires the following environment variables to function correctly:

**DISCORD_BOT_TOKEN**
> The authentication token provided by the Discord Developer Portal. Required for `bot.py` to authenticate and listen to server events.

**DEBUG**
> Set to `True` or `1` to enable verbose logging and Flask development mode. Defaults to `False`.

## FILES
**/server/data/**
> The primary directory for JSON and text files containing NPC lore, behavioral constraints, and historical transcripts. Models rely heavily on these files to maintain narrative consistency and accurate event recollection.

**/server/models.py**
> Contains the data structures and validation schemas for NPC objects, ensuring all AI generations adhere to the defined parameters before output.

## AUTHOR
Developed and maintained for custom D&D 5e campaigns and VTT integrations.

## BUGS
Ensure that NPC names passed to the Discord command exactly match the filenames in the `/server/data/` directory to avoid generic fallback responses. File encoding should strictly be UTF-8.