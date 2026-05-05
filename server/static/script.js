/* server/static/script.js */
console.log("script.js: Loaded Live Discord Log Testing Utility with Action Parsing & Undo.");

const discordToPcMap = {
    "seiper192": "Xander",
    "zenchaser": "Sel'zen",
    "silencedscreaming": "Vilis",
    "clumpycoyotes": "Sudara",
    "ortizalehammer": "Garrett",
    "srwm": "DM"
};

let messageQueue = [];
const undoHistory = {}; // Stores the last cleared state per PC/DM

// Extrapolates Actions (asterisks) and Speech (quotes) from a raw message
function formatDiscordMessage(msg) {
    let lines = [];
    const actionRegex = /\*([^*]+)\*/g;
    let actionMatch;
    let speechText = msg;
    
    // Parse actions
    while ((actionMatch = actionRegex.exec(msg)) !== null) {
        lines.push(`Action: ${actionMatch[1].trim()}`);
        speechText = speechText.replace(actionMatch[0], ''); 
    }
    
    // Parse speech
    speechText = speechText.trim();
    if (speechText) {
        // Strip outer quotes if they exist to prevent double quoting
        speechText = speechText.replace(/^"([^"]+)"$/, '$1').trim(); 
        lines.push(`Speech: "${speechText}"`);
    }
    
    return lines.join('\n');
}

function parseLogToQueue(rawLog) {
    const regex = /\[.*?\] \[Scriptly\] (.*?)\n(.*?)(?=\n\[|$)/gs;
    let match;
    const queue = [];

    while ((match = regex.exec(rawLog)) !== null) {
        const discordName = match[1].trim();
        const rawMessage = match[2].trim();
        
        if (!rawMessage) continue;

        const characterName = discordToPcMap[discordName] || discordName;
        
        queue.push({
            discordName: discordName,
            characterName: characterName,
            rawMessage: rawMessage
        });
    }
    return queue;
}

function saveUndoState(key, text) {
    if (text && text.trim() !== "") {
        undoHistory[key] = text;
    }
}

function restoreUndoState(key, textareaElem) {
    if (undoHistory[key]) {
        // Append restored text so we don't accidentally overwrite new incoming chat
        textareaElem.value = (textareaElem.value ? textareaElem.value + "\n" : "") + undoHistory[key];
        delete undoHistory[key]; // Clear history once consumed
    }
}

function getOrCreatePcCard(pcName) {
    const container = document.getElementById('active-party-inputs-container');
    if (!container) return null;

    const placeholder = document.getElementById('active-party-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    let card = container.querySelector(`.pc-input-card[data-pc-name="${pcName}"]`);
    if (card) return card;

    card = document.createElement('div');
    card.className = 'pc-input-card';
    card.dataset.pcName = pcName;

    const header = document.createElement('h4');
    header.textContent = pcName;
    
    const textarea = document.createElement('textarea');
    textarea.className = 'pc-input-textarea';
    textarea.placeholder = `Accumulating text for ${pcName}...`;

    // Buttons Container
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '5px';

    const undoBtn = document.createElement('button');
    undoBtn.className = 'pc-undo-btn';
    undoBtn.textContent = 'Undo';
    undoBtn.style.flex = '0 0 50px';
    undoBtn.onclick = () => restoreUndoState(pcName, textarea);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'pc-clear-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.style.flex = '0 0 50px';
    clearBtn.onclick = () => { 
        saveUndoState(pcName, textarea.value);
        textarea.value = ''; 
    };

    const genBtn = document.createElement('button');
    genBtn.className = 'pc-input-btn';
    genBtn.textContent = `Generate (${pcName})`;
    genBtn.style.flex = '1';
    genBtn.onclick = () => generateForPC(pcName);

    btnContainer.appendChild(undoBtn);
    btnContainer.appendChild(clearBtn);
    btnContainer.appendChild(genBtn);

    card.appendChild(header);
    card.appendChild(textarea);
    card.appendChild(btnContainer);
    
    container.appendChild(card);
    return card;
}

function gatherFullTranscript(targetPcName = null) {
    let transcript = "=== RECENT SCENE TRANSCRIPT ===\n";
    let hasContent = false;

    // Gather DM Box
    const dmBox = document.getElementById('player-utterance');
    if (dmBox && dmBox.value.trim()) {
        transcript += `DM / Scene Action: ${dmBox.value.trim()}\n`;
        hasContent = true;
    }

    // Gather All PC Boxes
    document.querySelectorAll('.pc-input-card').forEach(card => {
        const name = card.dataset.pcName;
        const text = card.querySelector('textarea').value.trim();
        if (text) {
            transcript += `${name}:\n${text}\n`;
            hasContent = true;
        }
    });

    if (!hasContent) return null;

    // Append Focus Directive
    transcript += "\n=== GM INSTRUCTION ===\n";
    if (targetPcName) {
        transcript += `Factor in the entire transcript above, but the NPC must respond PRIMARILY to ${targetPcName}'s dialogue and actions.`;
    } else {
        transcript += `Address the scene descriptors and multiple characters simultaneously to advance the scene.`;
    }

    return transcript;
}

function clearAllInputBoxes() {
    const dmBox = document.getElementById('player-utterance');
    if (dmBox && dmBox.value.trim() !== "") {
        saveUndoState('DM', dmBox.value);
        dmBox.value = "";
    }
    
    document.querySelectorAll('.pc-input-card').forEach(card => {
        const ta = card.querySelector('textarea');
        const name = card.dataset.pcName;
        if (ta.value.trim() !== "") {
            saveUndoState(name, ta.value);
            ta.value = "";
        }
    });
}

function generateForPC(pcName) {
    const fullPrompt = gatherFullTranscript(pcName);
    if (!fullPrompt) {
        console.warn("No text to generate.");
        return;
    }

    const dmBox = document.getElementById('player-utterance');
    const generateBtn = document.getElementById('generate-dialogue-btn');
    const speakingSelect = document.getElementById('speaking-pc-select');

    // Dump compiled transcript into the main DM box for API
    dmBox.value = fullPrompt;
    
    // Reset speaker to DM
    if (speakingSelect) speakingSelect.value = ""; 

    console.log(`[Testing Tool] Triggering generation focused on ${pcName}`);
    
    if (generateBtn) generateBtn.click();
    setTimeout(clearAllInputBoxes, 100);
}

function attachMainGenerateOverride() {
    const generateBtn = document.getElementById('generate-dialogue-btn');
    if (!generateBtn) return;

    generateBtn.addEventListener('mousedown', () => {
        const anyPcText = Array.from(document.querySelectorAll('.pc-input-card textarea')).some(ta => ta.value.trim() !== "");
        if (anyPcText) {
            const dmBox = document.getElementById('player-utterance');
            const fullPrompt = gatherFullTranscript(null); 
            if (fullPrompt && dmBox) {
                dmBox.value = fullPrompt;
                setTimeout(clearAllInputBoxes, 100);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    attachMainGenerateOverride();

    const stepBtn = document.getElementById('step-discord-log-btn');
    const pasteArea = document.getElementById('discord-log-paste');
    const liveMessagesDiv = document.getElementById('live-discord-messages');
    
    const dmBox = document.getElementById('player-utterance');
    const clearDmBtn = document.getElementById('clear-dm-btn');
    const undoDmBtn = document.getElementById('undo-dm-btn');

    if (clearDmBtn && dmBox) {
        clearDmBtn.addEventListener('click', () => {
            saveUndoState('DM', dmBox.value);
            dmBox.value = '';
        });
    }

    if (undoDmBtn && dmBox) {
        undoDmBtn.addEventListener('click', () => restoreUndoState('DM', dmBox));
    }

    if (stepBtn && pasteArea) {
        stepBtn.addEventListener('click', () => {
            
            if (messageQueue.length === 0 && pasteArea.value.trim() !== '') {
                messageQueue = parseLogToQueue(pasteArea.value);
                if (messageQueue.length > 0) liveMessagesDiv.innerHTML = '';
            }

            if (messageQueue.length > 0) {
                const nextMsg = messageQueue.shift();
                
                // Format the text specifically for Actions vs Speech
                const parsedContent = formatDiscordMessage(nextMsg.rawMessage);
                
                // Print to visual feed
                const msgElem = document.createElement('p');
                msgElem.style.margin = '4px 0';
                msgElem.innerHTML = `<strong style="color: #4da6ff;">[${nextMsg.discordName} / ${nextMsg.characterName}]</strong> ${nextMsg.rawMessage}`;
                liveMessagesDiv.appendChild(msgElem);
                liveMessagesDiv.scrollTop = liveMessagesDiv.scrollHeight;

                // Route parsed text to appropriate inbox
                if (nextMsg.characterName === "DM") {
                    if (dmBox) dmBox.value += (dmBox.value ? "\n" : "") + parsedContent;
                } else {
                    const card = getOrCreatePcCard(nextMsg.characterName);
                    if (card) {
                        const ta = card.querySelector('textarea');
                        ta.value += (ta.value ? "\n" : "") + parsedContent;
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