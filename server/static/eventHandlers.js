/**
 * static/eventHandlers.js
 * 
 * Responsibility: Assigns global event listeners for static DOM elements upon initialization.
 * Handles the logic for UI resizability, accordion-style collapsible menus, and dynamic scene configuration.
 */

var EventHandlers = {
    /**
     * Binds mouse events to the 'resizer' div, allowing the user to drag 
     * and alter the width of the left-hand navigation column dynamically.
     */
    setupResizer: function() {
        const leftColumn = Utils.getElem('left-column');
        const resizer = Utils.getElem('resizer');
        
        if (!leftColumn || !resizer) {
            console.warn("EventHandlers.setupResizer: Resizer or left column not found.");
            return;
        }

        let isResizing = false;
        
        // Start dragging
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            document.body.style.cursor = 'col-resize';
        });
        
        // Calculate width during drag
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            let newLeftWidth = e.clientX;
            
            // Hard clamp boundaries to prevent breaking the flexbox layout
            const minColWidth = 300;
            const maxColWidth = window.innerWidth - 250;
            
            if (newLeftWidth < minColWidth) newLeftWidth = minColWidth;
            if (newLeftWidth > maxColWidth) newLeftWidth = maxColWidth;
            
            leftColumn.style.width = `${newLeftWidth}px`;
        });
        
        // Release lock
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
            }
        });
    },

    /**
     * Scans the DOM for elements with the 'collapsible-section' class and injects
     * the chevron click-logic to hide/show their child '.collapsible-content' container.
     */
    setupCollapsibleSections: function() {
        document.querySelectorAll('#left-column .collapsible-section').forEach(section => {
            // Hardcoded exclusion: We want the direct context filters always visible
            if (section.id === 'scene-context-filters-direct') return;

            const header = section.querySelector('h3, h4');
            if (!header) return;

            // Inject the rotating chevron span if it doesn't already exist in the HTML
            let arrow = header.querySelector('.arrow-indicator');
            if (!arrow) {
                arrow = document.createElement('span');
                arrow.className = 'arrow-indicator';
                header.appendChild(arrow);
            }

            // Click delegator for the header bar
            header.addEventListener('click', (e) => {
                // Prevent collapse if clicking an input field nested inside the header itself
                if (e.target.closest('input, select, button, textarea')) return;

                const content = section.querySelector(':scope > .collapsible-content');
                if (content) {
                    section.classList.toggle('collapsed');
                    const isCollapsed = section.classList.contains('collapsed');
                    if (arrow) arrow.textContent = isCollapsed ? ' ►' : ' ▼';
                }
            });

            // Initial State Configuration: Open specific high-value sections by default
            const contentToToggle = section.querySelector(':scope > .collapsible-content');
            const initiallyOpenIds = ['pc-list-section-outer', 'npc-list-for-scene-section', 'all-npc-list-management-section', 'create-lore-entry-form-section'];
            const profileSubSectionOpenIds = ['gm-notes-collapsible-section']; 

            const isProfileSection = section.id === 'character-profile-main-section';
            const isSubSectionOfProfile = section.parentElement?.parentElement?.id === 'character-profile-main-section';

            if (contentToToggle) {
                let shouldBeOpen = initiallyOpenIds.includes(section.id) || (isProfileSection && !section.classList.contains('collapsed'));
                
                if (isSubSectionOfProfile) {
                    shouldBeOpen = profileSubSectionOpenIds.includes(section.id);
                }
                 // Explicitly keep the specific active Scene-List open to avoid UX frustration
                if (section.id === 'npc-list-for-scene-section') {
                    shouldBeOpen = true;
                }

                // Apply initial class states
                if (shouldBeOpen) {
                    section.classList.remove('collapsed');
                    if (arrow) arrow.textContent = ' ▼';
                } else {
                    section.classList.add('collapsed');
                    if (arrow) arrow.textContent = ' ►';
                }
            }
        });

        // Delegate clicks from the dashboard container to catch clicks on individual PC cards
        const pcDashboardContent = Utils.getElem('pc-dashboard-content');
        if (pcDashboardContent) {
            pcDashboardContent.addEventListener('click', function(event) {
                const clickedCard = event.target.closest('.clickable-pc-card');
                if (clickedCard) {
                    const pcIdToRender = clickedCard.dataset.pcId;
                    console.log("[DEBUG] Clicked PC Card for ID:", pcIdToRender);
                    if (pcIdToRender) {
                        const pcData = appState.getCharacterById(pcIdToRender);
                        if (pcData) {
                             // Route the selected data to the detailed sheet renderer
                             PCRenderers.renderDetailedPcSheetUI(pcData, Utils.getElem('pc-dashboard-content'));
                        } else {
                            console.error("[DEBUG] PC Data not found in appState for ID:", pcIdToRender);
                        }
                    } else {
                        console.error("EventHandlers: Clicked card in dashboard, but data-pc-id missing.");
                    }
                }
            });
        }
    },

    /**
     * Dynamically populates the JSON scene picker dropdown under Scene Configuration
     * by parsing the "scenes" array tag from loaded character JSON profiles.
     */
    setupSceneDropdownSelector: function() {
        const sceneDropdown = document.getElementById('json-scene-dropdown');
        if (!sceneDropdown) return;

        // Gather unique scene strings from the character "scenes" arrays
        const uniqueScenes = new Set();
        if (typeof appState !== 'undefined' && appState.getAllCharacters) {
            appState.getAllCharacters().forEach(char => {
                if (char.scenes) {
                    if (Array.isArray(char.scenes)) {
                        char.scenes.forEach(s => { if (s) uniqueScenes.add(s.trim()); });
                    } else if (typeof char.scenes === 'string') {
                        uniqueScenes.add(char.scenes.trim());
                    }
                }
            });
        }

        // Rebuild dropdown options cleanly
        sceneDropdown.innerHTML = '<option value="">-- Select Scene Tag --</option>';
        Array.from(uniqueScenes).sort().forEach(sceneName => {
            const opt = document.createElement('option');
            opt.value = sceneName;
            opt.textContent = sceneName;
            sceneDropdown.appendChild(opt);
        });

        // Bind change handler to load all NPCs matching the selected scene tag instantly
        sceneDropdown.onchange = function(e) {
            const selectedSceneTag = e.target.value;
            if (!selectedSceneTag) return;

            console.log(`[JSON Scene Picker] Loading and rendering all characters tagged with scene: ${selectedSceneTag}`);

            const multiNpcContainer = document.getElementById('multi-npc-dialogue-container');
            if (multiNpcContainer) {
                multiNpcContainer.innerHTML = ''; // Clear existing dialogue cards
            }

            if (typeof appState !== 'undefined' && appState.activeSceneNpcIds) {
                // Clear existing active scene list
                appState.activeSceneNpcIds.clear();

                // Select, activate, and render all NPCs matching this scene tag
                appState.getAllCharacters().forEach(char => {
                    const charScenes = Array.isArray(char.scenes) ? char.scenes : [];
                    const matches = charScenes.some(s => s && s.trim().toLowerCase() === selectedSceneTag.toLowerCase());

                    if (matches && char.character_type !== 'PC') {
                        appState.addActiveNpc(char._id);
                        AppState.initDialogueHistory(char._id);

                        // Render their conversation UI card on the right
                        if (multiNpcContainer && window.NPCRenderers) {
                            NPCRenderers.createNpcDialogueAreaUI(char, multiNpcContainer);
                        }

                        // Trigger initial entrance / greeting prompt automatically
                        const activePcNames = appState.getActivePcIds().map(pcId => appState.getCharacterById(pcId)?.name || "a PC");
                        const greetingPayload = {
                            scene_context: `${selectedSceneTag}. Active PCs present: ${activePcNames.join(', ')}`,
                            player_utterance: `(System Directive: You are ${char.name}. You are currently at ${selectedSceneTag}. You have just become aware of ${activePcNames.join(', ')} in the scene. Greet them or offer an initial reaction in character.)`,
                            active_pcs: activePcNames,
                            speaking_pc_id: null,
                            recent_dialogue_history: []
                        };
                        
                        setTimeout(() => {
                            if (typeof App !== 'undefined' && App.triggerNpcInteraction) {
                                App.triggerNpcInteraction(char._id, char.name, greetingPayload, true, `thinking-${char._id}-greeting`);
                            }
                        }, 200);
                    }
                });
            }

            // Refresh UI components and layout rendering
            if (typeof MainView !== 'undefined' && MainView.update) {
                MainView.update();
            }
            if (typeof App !== 'undefined' && App.renderPartyInboxUI) {
                App.renderPartyInboxUI();
            }

            // Refresh sidebar list checkmarks
            if (window.NPCRenderers && AppState) {
                NPCRenderers.renderNpcListForContextUI(
                    document.getElementById('character-list-scene-tab'),
                    AppState.getAllCharacters(),
                    AppState.activeSceneNpcIds,
                    App.handleToggleNpcInScene,
                    CharacterService.handleSelectCharacterForDetails,
                    AppState.getCurrentSceneContextFilter()
                );
            }
        };
    },

    /**
     * Binds HTML button elements to their respective business logic functions.
     * Prevents reliance on inline `onclick=""` HTML attributes where possible.
     */
    assignButtonEventHandlers: function() {
        const saveGmNotesBtn = Utils.getElem('save-gm-notes-btn');
        if (saveGmNotesBtn) saveGmNotesBtn.onclick = CharacterService.handleSaveGmNotes;

        const addMemoryBtn = Utils.getElem('add-memory-btn');
        if (addMemoryBtn) addMemoryBtn.onclick = CharacterService.handleAddMemory;

        const associateHistoryBtn = Utils.getElem('associate-history-btn');
        if (associateHistoryBtn) associateHistoryBtn.onclick = CharacterService.handleAssociateHistoryFile;

        const createCharacterBtn = Utils.getElem('create-character-form')?.querySelector('button');
        if (createCharacterBtn) createCharacterBtn.onclick = CharacterService.handleCharacterCreation;

        // Note: App is assumed to be bound to the global window namespace before this runs
        const generateDialogueBtn = Utils.getElem('generate-dialogue-btn');
        if (generateDialogueBtn) generateDialogueBtn.onclick = App.handleGenerateDialogue;

        const createLoreBtn = Utils.getElem('create-lore-entry-form')?.querySelector('button');
        if (createLoreBtn) createLoreBtn.onclick = CharacterService.handleCreateLoreEntry;

        const saveLoreGmNotesBtn = Utils.getElem('save-lore-gm-notes-btn');
        if(saveLoreGmNotesBtn) saveLoreGmNotesBtn.onclick = CharacterService.handleUpdateLoreEntryGmNotes;

        const deleteLoreBtn = Utils.getElem('delete-lore-btn');
        if(deleteLoreBtn) deleteLoreBtn.onclick = CharacterService.handleDeleteLoreEntry;

        const linkLoreToCharBtn = Utils.getElem('link-lore-to-char-btn');
        if (linkLoreToCharBtn) linkLoreToCharBtn.onclick = CharacterService.handleLinkLoreToCharacter;

        // Initialize the dedicated JSON scene dropdown picker
        this.setupSceneDropdownSelector();
    }
};