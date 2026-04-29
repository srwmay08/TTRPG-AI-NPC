import discord
import re
import csv
import os
import aiohttp 
from dotenv import load_dotenv

load_dotenv() 
TOKEN = os.getenv('DISCORD_TOKEN')

intents = discord.Intents.default()
intents.message_content = True
client = discord.Client(intents=intents)

TARGET_CHANNEL_ID = 1493584378192728145 

ROLL_REGEX = re.compile(r'Action:\s*(.*?)\s*-\s*Roll:\s*(\d+)')
SCRIPTLY_REGEX = re.compile(r"\[\d+:\d+\s?[AP]M\]\s+APP\s+\[Scriptly\]\s+([\w\.]+)\s*:\s*(.+)")

if not os.path.exists('live_log.csv'):
    with open('live_log.csv', mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(['Timestamp', 'User', 'Action_Taken', 'Dice_Roll', 'Full_Raw_Text'])

@client.event
async def on_ready():
    print(f'🟢 {client.user.name} is online and listening!')
    print(f'Monitoring channel ID: {TARGET_CHANNEL_ID}')
    print('------')

@client.event
async def on_message(message):
    if message.author == client.user: 
        return
    if message.channel.id != TARGET_CHANNEL_ID: 
        return

    # 1. Determine Author and Content (Handling Scriptly overrides)
    author_name = message.author.name
    content = message.content

    scriptly_match = SCRIPTLY_REGEX.search(content)
    if scriptly_match:
        author_name = scriptly_match.group(1).strip()
        content = scriptly_match.group(2).strip()

    # DEBUG: Did Discord Bot see it?
    print(f"\n💬 [DEBUG - DISCORD BOT] Caught message from {author_name}: {content}")

    # 2. Send to Flask App
    async with aiohttp.ClientSession() as session:
        payload = {
            "author": author_name,
            "content": content,
            "timestamp": message.created_at.isoformat()
        }
        print(f"🚀 [DEBUG - DISCORD BOT] Sending POST payload to app.py: {payload}")
        try:
            async with session.post("http://127.0.0.1:5001/api/live_chat_ingest", json=payload) as resp:
                print(f"✅ [DEBUG - DISCORD BOT] Flask Responded with Status: {resp.status}")
                if resp.status != 200:
                    err_text = await resp.text()
                    print(f"⚠️ [DEBUG - DISCORD BOT] Error response body: {err_text}")
        except Exception as e:
            print(f"❌ [DEBUG - DISCORD BOT] Failed to forward message to Flask App. Is app.py running? Error: {e}")

    # 3. CSV Logging
    roll_match = ROLL_REGEX.search(content)
    if roll_match:
        clean_text = re.sub(r'\n+', ' ', content)
        with open('live_log.csv', mode='a', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow([
                message.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                author_name,
                roll_match.group(1),
                roll_match.group(2),
                clean_text
            ])
        print(f"✅ [DEBUG - DISCORD BOT] Logged roll to CSV from {author_name}")

if TOKEN is None:
    print("❌ Error: DISCORD_TOKEN not found.")
else:
    client.run(TOKEN)