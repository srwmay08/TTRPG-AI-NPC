/* server/static/script.js */
// This file is now largely superseded by the more modular JS files (app.js, appState.js, etc.)
// For clarity and to avoid conflicts, its previous content (global variables and functions)
// has been integrated into those more specific files.
// It is currently being used to house the Live Discord Log Testing Utility.

console.log("script.js: Loaded Live Discord Log Testing Utility.");

const discordToPcMap = {
    "seiper192": "Xander",
    "zenchaser": "Sel'zen",
    "silencedscreaming": "Vilis",
    "clumpycoyotes": "Sudara",
    "ortizalehammer": "Garrett",
    "srwm": "DM"
};

let messageQueue = [];

function parseLogToQueue(rawLog) {
    const regex = /\[.*?\] \[Scriptly\] (.*?)\n(.*?)(?=\n\[|$)/gs;
    let match;
    const queue = [];

    while ((match = regex.exec(rawLog)) !== null) {
        const discordName = match[1].trim();
        const rawMessage = match[2].trim();
        
        if (!rawMessage) {
            continue;
        }

        const characterName = discordToPcMap[discordName] || discordName;
        
        queue.push({
            discordName: discordName,
            characterName: characterName,
            message: rawMessage
        });
    }
    return queue;
}

document.addEventListener('DOMContentLoaded', () => {
    const stepBtn = document.getElementById('step-discord-log-btn');
    const pasteArea = document.getElementById('discord-log-paste');
    const liveMessagesDiv = document.getElementById('live-discord-messages');
    const dialogueInput = document.getElementById('player-utterance');
    const speakingSelect = document.getElementById('speaking-pc-select');

    if (stepBtn && pasteArea) {
        stepBtn.addEventListener('click', () => {
            
            if (messageQueue.length === 0 && pasteArea.value.trim() !== '') {
                messageQueue = parseLogToQueue(pasteArea.value);
                if (messageQueue.length > 0) {
                    liveMessagesDiv.innerHTML = '';
                }
            }

            if (messageQueue.length > 0) {
                const nextMsg = messageQueue.shift();
                
                const msgElem = document.createElement('p');
                msgElem.style.margin = '4px 0';
                msgElem.innerHTML = `<strong style="color: #4da6ff;">[${nextMsg.discordName} / ${nextMsg.characterName}]</strong> ${nextMsg.message}`;
                
                liveMessagesDiv.appendChild(msgElem);
                liveMessagesDiv.scrollTop = liveMessagesDiv.scrollHeight;

                dialogueInput.value = nextMsg.message;

                if (speakingSelect) {
                    let found = false;
                    for (let i = 0; i < speakingSelect.options.length; i++) {
                        const optionText = speakingSelect.options[i].text;
                        if (optionText.includes(nextMsg.characterName)) {
                            speakingSelect.selectedIndex = i;
                            found = true;
                            break;
                        }
                    }
                    if (!found && nextMsg.characterName === "DM") {
                        speakingSelect.value = "";
                    }
                }
            } else {
                console.log("End of log reached or no text pasted.");
                const endElem = document.createElement('p');
                endElem.style.color = '#ff9999';
                endElem.style.marginTop = '10px';
                endElem.textContent = "--- End of pasted log or waiting for new messages ---";
                liveMessagesDiv.appendChild(endElem);
                liveMessagesDiv.scrollTop = liveMessagesDiv.scrollHeight;
            }
        });
    }
});