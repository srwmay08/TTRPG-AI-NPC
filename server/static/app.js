/**
 * server/static/app.js
 * 
 * Responsibility: Main application logic and event orchestration.
 * This file serves as the core controller. It initializes the app, 
 * binds layout events, sets up the polling for the live Discord feed, 
 * and handles the complex dynamic DOM generation for the Party Inbox.
 */

// Compatibility helper: Ensure AppState/appState are interchangeable
// This prevents errors if different modules use varying capitalizations.
if (typeof AppState === 'undefined' && typeof appState !== 'undefined') {
    window.AppState = appState;
} else if (typeof appState === 'undefined' && typeof AppState !== 'undefined') {
    window.appState = AppState;
}

var App = {
    /**
     * Bootstraps the frontend application. 
     * Fires immediately after the DOM is fully loaded.
     */
    initializeApp: async function() {
        console.log("App.js: DOMContentLoaded event fired. Initializing App...");
        try {
            // Initialize State defaults if not already set
            if (!AppState.currentView) {
                AppState.currentView = 'scene';
            }

            // Fetch the core character dataset from the backend database
            await CharacterService.initializeAppCharacters();

            // Setup Layout & Global Handlers (resizer dragging, expanding menus)
            this.setupResizer(); 
            if (window.EventHandlers && EventHandlers.setupCollapsibleSections) {
                EventHandlers.setupCollapsibleSections();
            }
            if (window.EventHandlers && EventHandlers.assignButtonEventHandlers) {
                EventHandlers.assignButtonEventHandlers();
            }

            // Initialize navigation and contextual filters
            this.setupTabControls(); 
            this.setupSceneContextSelector();
            this.setupDashboardClickHandlers();

            // Bind event listeners specific to the PC Dashboard (DPR calculator inputs)
            const dashboardView = document.getElementById('pc-dashboard-view');
            if (dashboardView) {
                dashboardView.addEventListener('change', (event) => {
                    // Check if the user is toggling a specific attack on/off for calculations
                    if (event.target.classList.contains('attack-selector')) {
                        const pcId = event.target.dataset.pcId;
                        const attackName = event.target.dataset.attackName;
                        if (AppState.toggleAttackSelection) {
                            AppState.toggleAttackSelection(pcId, attackName);
                        }
                        this.updateMainView();
                    } 
                    // Update global target AC or round count for all DPR charts simultaneously
                    else if (event.target.id === 'round-count-input') {
                        AppState.estimatedRounds = parseInt(event.target.value, 10) || 1;
                        this.updateMainView();
                    } else if (event.target.id === 'dpr-ac-input') {
                        const newAC = parseInt(event.target.value, 10);
                        if (!isNaN(newAC)) {
                            AppState.targetAC = newAC;
                            this.updateMainView();
                        }
                    }
                });
            }

            // --- INBOX INITIALIZATION ---
            // Construct the dynamic flex row for individual PC and GM inputs
            this.renderPartyInboxUI();

            // Start polling the backend for new Discord messages every 3 seconds
            this.startLiveChatPolling();

            // Force an initial view update to ensure the UI matches the loaded state
            setTimeout(() => this.updateMainView(), 0); 

        } catch (e) {
            console.error("App.js: Error during initial app setup:", e);
        }
        console.log("App.js: DOMContentLoaded finished.");
    },

    /**
     * Builds and renders the dynamic "Party Inbox" UI.
     * Replaces the old single 'player-utterance' text area with a responsive 
     * flex row containing individual input cards for the GM and every active PC.
     */
    renderPartyInboxUI: function() {
        let container = document.getElementById('party-inbox-container');
        
        // If the dedicated container doesn't exist yet, we must dynamically inject it
        // directly above the legacy input field to preserve layout order.
        if (!container) {
            const oldInput = document.getElementById('player-utterance');
            if (oldInput && oldInput.parentElement) {
                container = document.createElement('div');
                container.id = 'party-inbox-container';
                
                // Style the container as a strict horizontal flex row
                container.style.display = 'flex';
                container.style.flexDirection = 'row';
                container.style.flexWrap = 'wrap';
                container.style.gap = '15px';
                container.style.width = '100%';
                container.style.alignItems = 'stretch';

                oldInput.parentElement.insertBefore(container, oldInput);
                
                // Hide legacy elements to replace them smoothly without breaking older scripts that might look for them
                oldInput.style.display = 'none';
                const oldSelect = document.getElementById('speaking-pc-select');
                if (oldSelect) {
                    oldSelect.style.display = 'none';
                }
                const oldBtn = document.getElementById('generate-dialogue-btn');
                if (oldBtn) {
                    oldBtn.style.display = 'none';
                }
            } else {
                return; // DOM is not ready or structured differently
            }
        } else {
            // Apply flex row layout if container already exists
            container.style.display = 'flex';
            container.style.flexDirection = 'row';
            container.style.flexWrap = 'wrap';
            container.style.gap = '15px';
            container.style.width = '100%';
            container.style.alignItems = 'stretch';
        }

        // Wipe the container clean before rebuilding to prevent duplicates
        container.innerHTML = ''; 
        
        // Determine button states. If no NPCs are in the scene, disable generation.
        const isNpcActive = window.AppState ? window.AppState.getActiveNpcCount() > 0 : false;
        const btnDisabledAttr = isNpcActive ? '' : 'disabled="true"';
        const btnOpacity = isNpcActive ? '1' : '0.5';
        const btnCursor = isNpcActive ? 'pointer' : 'not-allowed';

        // 1. GM / Scene Input (Constructed first to anchor the left side of the row)
        const gmDiv = document.createElement('div');
        gmDiv.className = 'inbox-group gm-inbox';
        gmDiv.style.cssText = 'flex: 1 1 0; min-width: 250px; display: flex; flex-direction: column; background: #2a2a2a; padding: 10px; border-radius: 6px; border: 1px solid #444;';
        gmDiv.innerHTML = `
            <label style="display:block; font-weight:bold; margin-bottom:5px; color: #e0e0e0;">GM / Scene Input</label>
            <textarea id="gm-utterance" class="party-inbox-textarea full-width-textarea" placeholder="Describe the scene or GM actions..." style="flex-grow: 1; min-height: 80px; margin-bottom: 10px; background: #1a1a1a; color: #eee; border: 1px solid #555; padding: 8px; border-radius: 4px; resize: vertical;"></textarea>
            <div style="display: flex; gap: 5px;">
                <button onclick="document.getElementById('gm-utterance').value=''" style="padding: 8px 12px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Clear</button>
                <button class="dynamic-generate-btn" onclick="App.handleGenerateDialogueForInput('gm-utterance', null)" ${btnDisabledAttr} style="padding: 8px 12px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: ${btnCursor}; opacity: ${btnOpacity}; font-weight: bold; flex-grow: 1;">Send GM Event</button>
            </div>
        `;
        container.appendChild(gmDiv);

        // 2. PC Inputs (Iterate through active PCs and flow them alongside the GM box)
        if (window.AppState) {
            window.AppState.getActivePcIds().forEach(pcId => {
                const pc = window.AppState.getCharacterById(pcId);
                if (pc) {
                    const safeName = window.Utils ? window.Utils.escapeHtml(pc.name) : pc.name;
                    const pcDiv = document.createElement('div');
                    pcDiv.className = 'inbox-group pc-inbox';
                    // We use flex: 1 1 0 to ensure all boxes share the row width equally
                    pcDiv.style.cssText = 'flex: 1 1 0; min-width: 250px; display: flex; flex-direction: column; background: #222b36; padding: 10px; border-radius: 6px; border: 1px solid #2c3e50;';
                    pcDiv.innerHTML = `
                        <label style="display:block; font-weight:bold; margin-bottom:5px; color: #4aa0d5;">${safeName} Input</label>
                        <textarea id="pc-utterance-${pcId}" class="party-inbox-textarea full-width-textarea" placeholder="What does ${safeName} say or do?" style="flex-grow: 1; min-height: 80px; margin-bottom: 10px; background: #1a1a1a; color: #eee; border: 1px solid #555; padding: 8px; border-radius: 4px; resize: vertical;"></textarea>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="document.getElementById('pc-utterance-${pcId}').value=''" style="padding: 8px 12px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Clear</button>
                            <button class="dynamic-generate-btn" onclick="App.handleGenerateDialogueForInput('pc-utterance-${pcId}', '${pcId}')" ${btnDisabledAttr} style="padding: 8px 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: ${btnCursor}; opacity: ${btnOpacity}; font-weight: bold; flex-grow: 1;">Send as ${safeName}</button>
                        </div>
                    `;
                    container.appendChild(pcDiv);
                }
            });
        }
    },

    /** Initiates the interval that repeatedly fetches new Discord messages. */
    startLiveChatPolling: function() {
        console.log("App.js: [DEBUG - UI] Starting Live Discord Chat polling interval...");
        setInterval(() => this.pollLiveChat(), 3000);
        this.pollLiveChat();
    },

    /** Fetches the latest session history from the backend and updates the visual feed. */
    pollLiveChat: async function() {
        try {
            const response = await fetch('/api/live_chat');
            
            if (!response.ok) {
                console.error(`App.js: [DEBUG - UI] Fetch failed with status ${response.status}. Payload:`, await response.text());
                return;
            }
            
            const messages = await response.json();
            
            const container = document.getElementById('live-discord-messages');
            if (!container) {
                console.error("App.js: [DEBUG - UI] Could not find 'live-discord-messages' div in the DOM!");
                return;
            }

            container.innerHTML = ''; // Wipe existing visual feed to rewrite
            
            if (messages.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.style.color = '#888';
                emptyMsg.style.fontStyle = 'italic';
                emptyMsg.textContent = 'Waiting for live session messages...';
                container.appendChild(emptyMsg);
                return;
            }

            // Iterate over fetched messages and build clickable DOM elements
            messages.forEach(msg => {
                const p = document.createElement('p');
                p.className = 'discord-msg';
                p.style.margin = '4px 0';
                p.style.padding = '6px';
                p.style.backgroundColor = '#333';
                p.style.borderRadius = '4px';
                p.style.cursor = 'pointer'; 
                p.style.transition = 'background-color 0.2s ease';
                
                // Add hover states for better UX indicating clickability
                p.onmouseover = () => { p.style.backgroundColor = '#444'; };
                p.onmouseout = () => { p.style.backgroundColor = '#333'; };
                
                p.textContent = msg;
                p.title = "Click to load into Player Input";
                
                // When a log entry is clicked, route its text to the appropriate text area
                p.addEventListener('click', () => {
                    const match = msg.match(/^([^:]+):\s*(.*)$/);
                    if (match) {
                        const speakerName = match[1].trim();
                        const utterance = match[2].trim();

                        let targetTextAreaId = 'gm-utterance'; 
                        
                        // Check if the speaker is a PC
                        if (!speakerName.includes("DM") && !speakerName.includes("SRWM")) {
                            const allChars = window.AppState ? window.AppState.getAllCharacters() : [];
                            const pc = allChars.find(c => c.name === speakerName && (c.character_type === 'PC' || c.character_type === 'Player Character'));
                            
                            if (pc) {
                                // If the PC exists but isn't "active" in the scene yet, add them and rebuild the row
                                if (window.AppState && !window.AppState.hasActivePc(pc._id)) {
                                    window.AppState.addActivePc(pc._id);
                                    if (window.PCRenderers) {
                                        const activePcs = window.AppState.getAllCharacters().filter(c => c.character_type === 'PC');
                                        PCRenderers.renderPcListUI(activePcs);
                                    }
                                    App.renderPartyInboxUI(); 
                                }
                                targetTextAreaId = `pc-utterance-${pc._id}`;
                            }
                        }

                        // Target the calculated text area and append the utterance
                        const dynamicUtteranceArea = document.getElementById(targetTextAreaId);
                        if (dynamicUtteranceArea) {
                            dynamicUtteranceArea.value = utterance;
                            // Visual feedback flash
                            const originalBg = dynamicUtteranceArea.style.backgroundColor;
                            dynamicUtteranceArea.style.backgroundColor = '#2c4a2c'; 
                            setTimeout(() => {
                                dynamicUtteranceArea.style.backgroundColor = originalBg;
                            }, 300);
                        } else {
                            // Fallback to legacy structure if dynamic area is missing
                            const oldUtteranceArea = document.getElementById('player-utterance');
                            if (oldUtteranceArea) {
                                oldUtteranceArea.value = utterance;
                                const originalBg = oldUtteranceArea.style.backgroundColor;
                                oldUtteranceArea.style.backgroundColor = '#2c4a2c';
                                setTimeout(() => {
                                    oldUtteranceArea.style.backgroundColor = originalBg;
                                }, 300);
                            }
                        }
                    }
                });
                
                container.appendChild(p);
            });
            
            // Keep the feed scrolled to the most recent message
            container.scrollTop = container.scrollHeight;
            
        } catch (error) {
            console.error("App.js: [DEBUG - UI] Error during fetch call to /api/live_chat:", error);
        }
    },

    /** Connects the DOM drag event to resize the left-hand sidebar width. */
    setupResizer: function() {
        const resizer = document.getElementById('resizer');
        const leftCol = document.getElementById('left-column');
        if (!resizer || !leftCol) {
            return;
        }

        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            resizer.classList.add('active');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) {
                return;
            }
            let newWidth = e.clientX;
            // Establish minimum and maximum boundaries for the resizable sidebar
            if (newWidth < 200) { newWidth = 200; }
            if (newWidth > window.innerWidth * 0.6) { newWidth = window.innerWidth * 0.6; }
            leftCol.style.width = `${newWidth}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                resizer.classList.remove('active');
            }
        });
    },

    /** 
     * Handles switching between primary application tabs (Scene, NPCs, Lore).
     * @param {Event} event - The click event that triggered the tab change.
     * @param {string} tabName - The ID of the target tab to display.
     */
    openTab: function(event, tabName) { 
        if (window.openTab) {
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(tab => {
                tab.style.display = 'none';
                tab.classList.remove('active-tab');
            });
            
            const tabLinks = document.querySelectorAll('.tab-link');
            tabLinks.forEach(link => {
                link.classList.remove('active');
            });

            const target = document.getElementById(tabName);
            if (target) {
                target.style.display = 'block';
                target.classList.add('active-tab');
            }
            if (event && event.currentTarget) {
                event.currentTarget.classList.add('active');
            }
        }

        // Logic routing depending on which tab was actively clicked
        if (tabName === 'tab-npcs') {
            const currentProfileId = AppState.getCurrentProfileCharId();
            if (currentProfileId) {
                AppState.currentView = 'npc';
                this.updateMainView();
            }
        }
        if (tabName === 'tab-lore') {
            if (AppState.getCurrentLoreEntryId()) {
                AppState.currentView = 'lore';
                this.updateMainView();
            }
        }
        if (tabName === 'tab-scene') {
            AppState.currentView = 'scene';
            this.updateMainView();
            
            // Re-render the NPC selection list specific to the current context filter
            if (window.NPCRenderers) {
                NPCRenderers.renderNpcListForContextUI(
                    document.getElementById('character-list-scene-tab'),
                    AppState.getAllCharacters(),
                    AppState.activeSceneNpcIds,
                    this.handleToggleNpcInScene, 
                    CharacterService.handleSelectCharacterForDetails,
                    AppState.getCurrentSceneContextFilter()
                );
            }
        }
    },

    /** Programmatically selects the default tab (Scene) on application load. */
    setupTabControls: function() {
        const tabLinks = document.querySelectorAll('#left-column-header .tabs .tab-link');
        if (tabLinks.length > 0) {
            const sceneTabButton = Array.from(tabLinks).find(link => {
                const onclickAttr = link.getAttribute('onclick');
                return onclickAttr && onclickAttr.includes("'tab-scene'");
            });
            if (sceneTabButton) {
                sceneTabButton.click(); 
            } else {
                tabLinks[0].click(); 
            }
        }
    },

    /** Binds event listeners to the scene context filter drop-downs. */
    setupSceneContextSelector: function() {
        const typeSelector = document.getElementById('scene-context-type-filter');
        const entrySelector = document.getElementById('scene-context-selector');

        if (typeSelector) {
            typeSelector.addEventListener('change', () => { 
                if (window.LoreRenderers) {
                    LoreRenderers.populateSceneContextSelectorUI();
                }
                if (entrySelector) {
                    entrySelector.value = ""; 
                }
                AppState.setCurrentSceneContextFilter(null); 
                
                if (window.NPCRenderers) {
                    NPCRenderers.renderNpcListForContextUI(
                        document.getElementById('character-list-scene-tab'),
                        AppState.getAllCharacters(),
                        AppState.activeSceneNpcIds,
                        App.handleToggleNpcInScene, 
                        CharacterService.handleSelectCharacterForDetails,
                        null 
                    );
                }
                this.updateMainView();
            });
        }

        if (entrySelector) {
            entrySelector.addEventListener('change', (event) => { 
                const selectedLoreId = event.target.value;
                if (selectedLoreId) {
                    AppState.setCurrentSceneContextFilter({ type: 'lore', id: selectedLoreId });
                } else {
                    AppState.setCurrentSceneContextFilter(null);
                }
                
                if (window.NPCRenderers) {
                    NPCRenderers.renderNpcListForContextUI(
                        document.getElementById('character-list-scene-tab'),
                        AppState.getAllCharacters(),
                        AppState.activeSceneNpcIds,
                        App.handleToggleNpcInScene, 
                        CharacterService.handleSelectCharacterForDetails,
                        AppState.getCurrentSceneContextFilter()
                    );
                }
                this.updateMainView();
            });
        }
    },

    setupDashboardClickHandlers: function() {
        const dashboard = document.getElementById('pc-dashboard-view');
        if (dashboard) {
            dashboard.addEventListener('click', (e) => {
                 // Additional dashboard click logic can be extended here
            });
        }
    },
    
    /** Calls MainView.update() to sync UI visibility states with the AppState. */
    updateMainView: function() {
        console.log("App.js: App.updateMainView called.");
        if (window.MainView && MainView.update) {
            MainView.update(); 
        } else {
            console.error("MainView.update is missing!");
        }
        console.log("App.js: App.updateMainView finished.");
    },

    /** Modifies state and UI when a specific lore entry is selected. */
    handleSelectLoreEntry: function(loreIdStr) {
        console.log("App.js: handleSelectLoreEntry", loreIdStr);
        AppState.setCurrentLoreEntryId(loreIdStr);
        AppState.currentView = 'lore';
        
        if (window.LoreRenderers) {
            LoreRenderers.renderLoreEntryListUI(AppState.getAllLoreEntries());
        }
        
        App.updateMainView();
    },

    /** 
     * Adds or removes an NPC from the active conversation scene.
     * @param {string} npcIdStr - Target NPC Database ID
     * @param {string} npcName - Name of target NPC
     */
    handleToggleNpcInScene: async function(npcIdStr, npcName) {
        AppState.currentView = 'scene';

        const multiNpcContainer = document.getElementById('multi-npc-dialogue-container');
        if (!multiNpcContainer) { return; }
    
        const isAdding = !AppState.hasActiveNpc(npcIdStr);
    
        if (isAdding) {
            // NPC is joining the scene
            AppState.addActiveNpc(npcIdStr);
            const toggledNpc = AppState.getCharacterById(npcIdStr);
            if (!toggledNpc) {
                AppState.removeActiveNpc(npcIdStr);
                return;
            }
    
            if (window.NPCRenderers) {
                NPCRenderers.createNpcDialogueAreaUI(toggledNpc, multiNpcContainer);
            }
            AppState.initDialogueHistory(npcIdStr);
            
            const intro = toggledNpc.canned_conversations?.introduction;
            const sceneContext = document.getElementById('scene-context') ? document.getElementById('scene-context').value.trim() : "";
            const activePcNames = AppState.getActivePcIds().map(pcId => AppState.getCharacterById(pcId)?.name || "a PC");
            
            const currentSpeakingPcId = null; // Automated introductions don't strictly have a PC speaker yet

            // Send automated initialization prompt to GenAI
            if (intro) {
                // If a hardcoded intro exists, force the AI to only output the metadata using that intro
                const payload = {
                    scene_context: sceneContext || `${activePcNames.join(', ')} are present.`,
                    player_utterance: `(System Directive: Canned Response Used) The response was: "${intro}"`,
                    active_pcs: activePcNames,
                    speaking_pc_id: currentSpeakingPcId,
                    recent_dialogue_history: []
                };
                setTimeout(() => App.triggerNpcInteraction(npcIdStr, toggledNpc.name, payload, true, `thinking-${npcIdStr}-greeting`), 100);

            } else {
                // Otherwise ask the AI to formulate an initial reaction based on the scene context
                const greetingPayload = {
                    scene_context: sceneContext || `${activePcNames.join(', ')} ${activePcNames.length > 1 ? 'are' : 'is'} present.`,
                    player_utterance: `(System Directive: You are ${toggledNpc.name}. You have just become aware of ${activePcNames.join(', ')} in the scene. Greet them or offer an initial reaction in character.)`,
                    active_pcs: activePcNames,
                    speaking_pc_id: currentSpeakingPcId,
                    recent_dialogue_history: []
                };
                setTimeout(() => App.triggerNpcInteraction(npcIdStr, toggledNpc.name, greetingPayload, true, `thinking-${npcIdStr}-greeting`), 100);
            }
        } else {
            // NPC is leaving the scene
            AppState.removeActiveNpc(npcIdStr);
            if (window.NPCRenderers) {
                NPCRenderers.removeNpcDialogueAreaUI(npcIdStr, multiNpcContainer);
            }
            AppState.deleteDialogueHistory(npcIdStr);
        }
    
        // Cleanup placeholders
        const placeholderEvent = multiNpcContainer.querySelector('p.scene-event');
        if (AppState.getActiveNpcCount() > 0 && placeholderEvent) {
            placeholderEvent.remove();
        } else if (AppState.getActiveNpcCount() === 0 && !placeholderEvent) {
            multiNpcContainer.innerHTML = '<p class="scene-event">Select NPCs from the SCENE tab to add them to the interaction.</p>';
        }
    
        // Refresh UI list to show updated checkmarks
        if (window.NPCRenderers) {
            NPCRenderers.renderNpcListForContextUI(
                document.getElementById('character-list-scene-tab'),
                AppState.getAllCharacters(),
                AppState.activeSceneNpcIds,
                App.handleToggleNpcInScene,
                CharacterService.handleSelectCharacterForDetails,
                AppState.getCurrentSceneContextFilter()
            );
        }
        App.updateMainView();
    },

    /**
     * Reaches out to the ApiService to generate dialogue. Displays "thinking" states, 
     * handles errors, and applies the result to the DOM.
     */
    triggerNpcInteraction: async function(npcIdStr, npcName, payload, isGreeting = false, thinkingMessageId = null) {
        const transcriptArea = document.getElementById(`transcript-${npcIdStr}`);
        if (!transcriptArea) { return; }

        let thinkingMessageElement = thinkingMessageId ? document.getElementById(thinkingMessageId) : null;

        // Visual indicator that the AI is processing
        if (!thinkingMessageElement && isGreeting) {
            const sceneEventP = document.createElement('p');
            sceneEventP.className = 'scene-event';
            sceneEventP.id = `thinking-${npcIdStr}-greeting`;
            sceneEventP.textContent = `${npcName} is formulating a response...`;
            transcriptArea.appendChild(sceneEventP);
            transcriptArea.scrollTop = transcriptArea.scrollHeight;
            thinkingMessageElement = sceneEventP;
        }

        try {
            // Issue the core API call
            const result = await ApiService.generateNpcDialogue(npcIdStr, payload);
            
            // Remove the thinking indicator upon success
            if (thinkingMessageElement && thinkingMessageElement.parentNode) {
                thinkingMessageElement.remove();
            }

            // Append response text and render AI metadata suggestions (checks, actions, etc)
            if (window.NPCRenderers) {
                NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${npcName}: ${result.npc_dialogue}`, 'dialogue-entry npc-response');
                NPCRenderers.renderSuggestionsArea(result, npcIdStr);
            }
            AppState.addDialogueToHistory(npcIdStr, `${npcName}: ${result.npc_dialogue}`);
            
            // Set context so Canned Responses map to this specific NPC
            AppState.setCurrentProfileCharId(npcIdStr); 
            const interactingChar = AppState.getCharacterById(npcIdStr);
            if (interactingChar) {
                AppState.setCannedResponsesForProfiledChar(interactingChar.canned_conversations || {});
            }
            AppState.lastAiResultForProfiledChar = result;

        } catch (error) {
            // Handle HTTP or Python backend errors gracefully
            console.error(`Error generating dialogue for ${npcName}:`, error);
            if (thinkingMessageElement && thinkingMessageElement.parentNode) {
                thinkingMessageElement.remove();
            }
            if (window.NPCRenderers) {
                NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${npcName}: (Error: ${error.message})`, 'dialogue-entry npc-response');
            }
            AppState.addDialogueToHistory(npcIdStr, `${npcName}: (Error generating dialogue)`);
        }
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    },

    /**
     * Legacy handler kept for fallback safety. Uses the old monolithic inputs.
     */
    handleGenerateDialogue: async function() {
        const input = document.getElementById('player-utterance');
        const select = document.getElementById('speaking-pc-select');
        if (input && select) {
            App.handleGenerateDialogueForInput('player-utterance', select.value);
        }
    },

    /**
     * The core action trigger for sending text from the new dynamic text areas.
     * Initiates parallel API calls to every active NPC in the scene based on the input text.
     * @param {string} textareaId - The HTML ID of the box that was submitted.
     * @param {string|null} speakerId - The target character ID, or null if it was the GM.
     */
    handleGenerateDialogueForInput: async function(textareaId, speakerId) {
        const inputElem = document.getElementById(textareaId);
        if (!inputElem) return;
        
        const playerUtterance = inputElem.value.trim();
        const sceneContextElem = document.getElementById('scene-context');
        const sceneContext = sceneContextElem ? sceneContextElem.value.trim() : "";

        if (!playerUtterance) {
            alert("Please enter dialogue or actions to send.");
            return;
        }

        // Disable all dynamic buttons simultaneously to prevent spam-clicking while awaiting responses
        const buttons = document.querySelectorAll('.dynamic-generate-btn');
        buttons.forEach(b => b.disabled = true);
        if (window.Utils) {
            Utils.disableBtn('generate-dialogue-btn', true);
        }

        const speaker = AppState.getCharacterById(speakerId);
        const speakerDisplayName = speaker ? speaker.name : "DM/Scene Event";
        
        // If an NPC is currently selected as the speaker, flag it to style their input accordingly
        const isSpeakerAnNpc = speaker && speaker.character_type === 'NPC';

        const activeNpcIds = AppState.getActiveNpcIds();
        const activePcsNames = AppState.getActivePcIds().map(id => AppState.getCharacterById(id)?.name).filter(name => name);

        // All NPCs listen, unless the NPC is speaking to themselves
        const listeningNpcIds = activeNpcIds.filter(id => id !== speakerId);

        // 1. Visually append the User's input to the transcript window immediately
        activeNpcIds.forEach(npcId => {
            const transcriptArea = document.getElementById(`transcript-${npcId}`);
            if (transcriptArea && window.NPCRenderers) {
                const messageClass = (isSpeakerAnNpc && speakerId === npcId) ? 'dialogue-entry npc-response' : 'dialogue-entry player-utterance';
                NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${speakerDisplayName}: ${playerUtterance}`, messageClass);
                AppState.addDialogueToHistory(npcId, `${speakerDisplayName}: ${playerUtterance}`);
            }
        });

        // 2. Append thinking descriptors for all listening NPCs
        listeningNpcIds.forEach(npcId => {
            const npc = AppState.getCharacterById(npcId);
            const transcriptArea = document.getElementById(`transcript-${npcId}`);
            if (transcriptArea && npc) {
                const thinkingEntry = document.createElement('p');
                thinkingEntry.className = 'scene-event';
                thinkingEntry.id = `thinking-${npcId}-main`;
                thinkingEntry.textContent = `${npc.name} is formulating a response...`;
                transcriptArea.appendChild(thinkingEntry);
                transcriptArea.scrollTop = transcriptArea.scrollHeight;
            }
        });

        // 3. Initiate parallel generation requests
        const dialoguePromises = listeningNpcIds.map(npcId => {
            const npc = AppState.getCharacterById(npcId);
            if (!npc) return Promise.resolve();

            const payload = {
                scene_context: sceneContext,
                player_utterance: playerUtterance,
                active_pcs: activePcsNames,
                speaking_pc_id: speakerId,
                recent_dialogue_history: AppState.getRecentDialogueHistory(npcId, 10)
            };
            return App.triggerNpcInteraction(npcId, npc.name, payload, false, `thinking-${npcId}-main`);
        });

        // Await all parallel requests to finish
        await Promise.all(dialoguePromises);

        inputElem.value = ''; // Clear only the specific input box used
        
        // Re-enable buttons once generation has concluded
        buttons.forEach(b => b.disabled = false);
        if (window.Utils) {
            Utils.disableBtn('generate-dialogue-btn', false);
        }
    },

    /** Adds or removes a PC from the active tracking sets and rebuilds the inbox row. */
    handleTogglePcSelection: function(pcIdStr) {
        AppState.toggleActivePc(pcIdStr);
        AppState.currentView = 'pc'; 
        
        if (window.PCRenderers) {
            const allPcs = AppState.getAllCharacters().filter(c => 
                c.character_type === 'Player Character' || 
                c.character_type === 'PC' || 
                c.type === 'Player Character'
            );
            PCRenderers.renderPcListUI(allPcs);
        }

        // Re-render the Party Inbox Flex Row to spawn a new text area for the toggled PC!
        App.renderPartyInboxUI();

        const select = document.getElementById('speaking-pc-select');
        if (select) {
            const currentVal = select.value;
            select.innerHTML = '<option value="">-- DM/Scene Event --</option>';
            AppState.activePcIds.forEach(id => {
                const pc = AppState.getCharacterById(id);
                if (pc) {
                    const opt = document.createElement('option');
                    opt.value = pc.id;
                    opt.textContent = pc.name;
                    select.appendChild(opt);
                }
            });
            if (AppState.activePcIds.has(currentVal)) {
                select.value = currentVal;
            }
        }

        App.updateMainView();

        const currentProfileChar = AppState.getCurrentProfileChar();
        if (currentProfileChar && currentProfileChar.character_type === 'NPC' && window.NPCRenderers) {
            const standingsContainer = document.getElementById('npc-faction-standings-content');
            if (standingsContainer) {
                 NPCRenderers.renderNpcFactionStandingsUI(currentProfileChar, AppState.activePcIds, AppState.getAllCharacters(), standingsContainer, CharacterService.handleSaveFactionStanding);
            }
        }
    },

    /** Closes detailed PC sheets to return to the broad grid view. */
    handleBackToDashboardOverview: function() {
        if (AppState.activePc) {
             AppState.activePc = null; 
        }
        
        const dashboardContent = document.getElementById('pc-dashboard-content');
        if (dashboardContent) {
            const detailedSheet = dashboardContent.querySelector('.detailed-pc-sheet');
            if (detailedSheet) {
                detailedSheet.remove();
            }
        }
        AppState.setExpandedAbility(null);
        App.updateMainView();
    },

    /** Opens/Closes the comparative UI bar charts for ability scores. */
    toggleAbilityExpansion: function(ablKey) {
        const currentAbility = AppState.getExpandedAbility();
        if (currentAbility === ablKey) {
            AppState.setExpandedAbility(null);
        } else {
            AppState.setExpandedAbility(ablKey);
        }
        if (window.PCRenderers) {
            PCRenderers.updatePcDashboardUI(document.getElementById('pc-dashboard-content'), AppState.getAllCharacters(), AppState.activePcIds, AppState.getExpandedAbility());
        }
    },

    /** Converts a temporary AI memory suggestion into a permanent database record. */
    addSuggestedMemoryAsActual: async function(npcId, memoryContent) {
        if (!npcId || !memoryContent) { return; }
        const character = AppState.getCharacterById(npcId);
        if (!character || character.character_type !== 'NPC') {
            alert("Cannot add memory: Invalid NPC ID or character is not an NPC.");
            return;
        }
        try {
            const memoryData = { content: memoryContent, type: "AI_suggestion", source: "AI suggestion" };
            const response = await ApiService.addMemoryToNpc(npcId, memoryData);
            const charToUpdate = AppState.getCharacterById(npcId);
            if (charToUpdate && response.updated_memories) {
                charToUpdate.memories = response.updated_memories;
                AppState.updateCharacterInList(charToUpdate);
                if (AppState.getCurrentProfileCharId() === npcId && window.NPCRenderers) {
                    NPCRenderers.renderMemoriesUI(charToUpdate.memories, document.getElementById('character-memories-list'), CharacterService.handleDeleteMemory);
                }
            }
            alert(`Suggested memory added to ${character.name}.`);
        } catch (error) {
            console.error("App.js: Error adding suggested memory:", error);
            alert("Error adding suggested memory: " + error.message);
        }
    },

    /** Approves an AI suggestion to alter a PC's standing with an NPC. */
    acceptFactionStandingChange: async function(npcIdToUpdate, pcTargetId, newStanding) {
        if (!npcIdToUpdate || !pcTargetId || !newStanding) {
            alert("Missing information to update faction standing.");
            return;
        }
        const npc = AppState.getCharacterById(npcIdToUpdate);
        const pc = AppState.getCharacterById(pcTargetId);
        if (!npc || !pc) {
            alert("NPC or PC not found for faction standing update.");
            return;
        }

        if (confirm(`Change ${npc.name}'s standing towards ${pc.name} to ${newStanding}?`)) {
            await CharacterService.handleSaveFactionStanding(npcIdToUpdate, pcTargetId, newStanding);
        }
    },

    /** Forces the NPC to bypass AI generation and use a specific scripted response string. */
    useSpecificCannedResponse: function(topic) {
        const profiledCharId = AppState.getCurrentProfileCharId();
        if (!profiledCharId) { return; }

        if (!AppState.hasActiveNpc(profiledCharId)) {
            alert("The profiled NPC must be in the current scene to use a canned response.");
            return;
        }

        const profiledChar = AppState.getCharacterById(profiledCharId);
        if (!profiledChar) { return; }

        const cannedResponses = AppState.cannedResponsesForProfiledChar || {};
        const cannedResponseText = cannedResponses[topic];
        if (!cannedResponseText) {
            console.error(`Canned response for topic "${topic}" not found.`);
            return;
        }

        const transcriptArea = document.getElementById(`transcript-${profiledCharId}`);
        if (transcriptArea && window.NPCRenderers) {
            NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${profiledChar.name}: ${cannedResponseText}`, 'dialogue-entry npc-response');
            AppState.addDialogueToHistory(profiledCharId, `${profiledChar.name}: ${cannedResponseText}`);
        }
    },
    
    /** Autofills a generated topic into the text box for rapid communication. */
    sendTopicToChat: function(topic) {
        const gmUtteranceElem = document.getElementById('gm-utterance');
        if (gmUtteranceElem) {
            gmUtteranceElem.value = topic;
            gmUtteranceElem.focus();
        } else {
            const playerUtteranceElem = document.getElementById('player-utterance');
            if (playerUtteranceElem) {
                playerUtteranceElem.value = topic;
                playerUtteranceElem.focus();
            }
        }
    },

    /** Post-load hook used to push characters to UI renderers. */
    onCharactersLoaded: function() {
        console.log("App.js: Characters loaded.");
        if (AppState.characters) {
            const pcs = AppState.characters.filter(c => 
                c.character_type === 'Player Character' || 
                c.character_type === 'PC' ||
                c.type === 'Player Character'
            );
            PCRenderers.renderPcListUI(pcs);
        }
    },

    // --- Mappings to Service Functions ---
    // Defers handling logic directly to CharacterService
    handleSaveGmNotes: function(a, b) { return CharacterService.handleSaveGmNotes(a, b); },
    handleAddMemory: function(a, b, c) { return CharacterService.handleAddMemory(a, b, c); },
    handleDeleteMemory: function(a, b) { return CharacterService.handleDeleteMemory(a, b); },
    handleSaveFactionStanding: function(a, b, c) { return CharacterService.handleSaveFactionStanding(a, b, c); },
    handleAssociateHistoryFile: function(a, b) { return CharacterService.handleAssociateHistoryFile(a, b); },
    handleDissociateHistoryFile: function(a, b) { return CharacterService.handleDissociateHistoryFile(a, b); },
    handleCharacterCreation: function(e) { return CharacterService.handleCharacterCreation(e); },
    handleCreateLoreEntry: function(e) { return CharacterService.handleCreateLoreEntry(e); },
    handleSelectLoreEntryForDetails: function(id) { return CharacterService.handleSelectLoreEntryForDetails(id); },
    handleUpdateLoreEntryGmNotes: function(id, notes) { return CharacterService.handleUpdateLoreEntryGmNotes(id, notes); },
    handleDeleteLoreEntry: function(id) { return CharacterService.handleDeleteLoreEntry(id); },
    handleLinkLoreToCharacter: function(loreId, charId) { return CharacterService.handleLinkLoreToCharacter(loreId, charId); },
    handleUnlinkLoreFromCharacter: function(loreId, charId) { return CharacterService.handleUnlinkLoreFromCharacter(loreId, charId); }
};

// Bind initialization to standard page lifecycle events
document.addEventListener('DOMContentLoaded', App.initializeApp.bind(App));

// Map necessary functions to global window namespace to support inline HTML `onclick=""` attributes
window.App = App;
window.openTab = App.openTab.bind(App);
window.handleToggleNpcInScene = App.handleToggleNpcInScene.bind(App);
window.handleGenerateDialogue = App.handleGenerateDialogue.bind(App);
window.handleGenerateDialogueForInput = App.handleGenerateDialogueForInput.bind(App);
window.handleTogglePcSelection = App.handleTogglePcSelection.bind(App);
window.handleBackToDashboardOverview = App.handleBackToDashboardOverview.bind(App);
window.toggleAbilityExpansion = App.toggleAbilityExpansion.bind(App);
window.addSuggestedMemoryAsActual = App.addSuggestedMemoryAsActual.bind(App);
window.acceptFactionStandingChange = App.acceptFactionStandingChange.bind(App);
window.useSpecificCannedResponse = App.useSpecificCannedResponse.bind(App);
window.sendTopicToChat = App.sendTopicToChat.bind(App);

if (window.LoreRenderers) {
    window.closeLoreDetailViewUI = LoreRenderers.closeLoreDetailViewUI;
}