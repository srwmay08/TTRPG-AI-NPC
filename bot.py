import discord
import re
import csv
import os

# 1. Setup Intents (Critical for reading message content)
intents = discord.Intents.default()
intents.message_content = True

# 2. Initialize the Client
client = discord.Client(intents=intents)

# 3. Configuration
# RIGHT-CLICK YOUR TARGET CHANNEL AND COPY ID HERE
TARGET_CHANNEL_ID = 123456789101112 

# Example Regex: Let's say you want to capture log entries like "Action: Attack - Roll: 18"
# Change this pattern to match the specific data you need from your campaigns or logs.
REGEX_PATTERN = re.compile(r'Action:\s*(.*?)\s*-\s*Roll:\s*(\d+)')

# 4. Create the CSV with headers if it doesn't exist yet
if not os.path.exists('live_log.csv'):
    with open('live_log.csv', mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        # Adjust these headers based on your regex groups
        writer.writerow(['Timestamp', 'User', 'Action_Taken', 'Dice_Roll', 'Full_Raw_Text'])

@client.event
async def on_ready():
    print(f'🟢 {client.user.name} is online and listening!')
    print(f'Monitoring channel ID: {TARGET_CHANNEL_ID}')
    print('------')

@client.event
async def on_message(message):
    # Ignore messages from the bot itself to prevent infinite loops
    if message.author == client.user:
        return

    # Ignore messages from any other channel
    if message.channel.id != TARGET_CHANNEL_ID:
        return

    # 1. Apply your Regex to the incoming message
    match = REGEX_PATTERN.search(message.content)
    
    # 2. Clean the raw text (strip newlines so it doesn't break CSV formatting)
    clean_text = re.sub(r'\n+', ' ', message.content)

    # 3. If the regex finds a match, log it to the CSV
    if match:
        # Open the file in 'a' (append) mode to add to the bottom
        with open('live_log.csv', mode='a', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            
            # Write the new row
            writer.writerow([
                message.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                message.author.name,
                match.group(1), # The "Action" from our example regex
                match.group(2), # The "Roll" from our example regex
                clean_text
            ])
            
        print(f"✅ Logged new entry from {message.author.name}")

# Run the bot
client.run('TOKEN')