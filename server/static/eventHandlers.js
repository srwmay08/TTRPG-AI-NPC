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
     * Populates the Scene Configuration dropdown menu dynamically by reading 
     * unique scene/location metadata from loaded character profiles.
     */
    setupSceneSelectorDropdown: function() {
        const contextFilterSelect = document.getElementById('context-filter') || document.querySelector("select[name='context_filter']");
        if (!contextFilterSelect) return;

        // Gather unique scenes and locations from loaded characters in appState
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
                if (char.location && typeof char.location === 'string') {
                    uniqueScenes.add(char.location.trim());
                }
            });
        }

        // Retain original first placeholder option if it exists
        const firstOption = contextFilterSelect.options[0];
        contextFilterSelect.innerHTML = '';
        if (firstOption) {
            contextFilterSelect.appendChild(firstOption);
        } else {
            const defaultOpt = document.createElement('option');
            defaultOpt.value = "";
            defaultOpt.textContent = "-- Select Scene / Location --";
            contextFilterSelect.appendChild(defaultOpt);
        }

        // Append sorted scene options
        Array.from(uniqueScenes).sort().forEach(sceneName => {
            const option = document.createElement('option');
            option.value = sceneName;
            option.textContent = sceneName;
            contextFilterSelect.appendChild(option);
        });

        // Bind change event to auto-populate the scene with matching NPCs and trigger roleplay
        contextFilterSelect.onchange = function(e) {
            const selectedScene = e.target.value;
            if (!selectedScene) return;

            console.log(`[Scene Selector] Loading scene: ${selectedScene}`);
            
            // Clear current active scene characters
            if (typeof appState !== 'undefined' && appState.activeSceneNpcIds) {
                appState.activeSceneNpcIds.clear();

                // Find and activate NPCs matching this scene or location
                appState.getAllCharacters().forEach(char => {
                    const charScenes = Array.isArray(char.scenes) ? char.scenes : [char.scenes, char.location];
                    const matches = charScenes.some(s => s && s.toLowerCase() === selectedScene.toLowerCase());
                    
                    if (matches && char.character_type !== 'PC') {
                        appState.addActiveNpc(char._id);
                    }
                });
            }

            // Refresh UI components and scene renderers
            if (typeof MainView !== 'undefined' && MainView.update) {
                MainView.update();
            }
            if (typeof App !== 'undefined' && App.renderActiveSceneNpcs) {
                App.renderActiveSceneNpcs();
            }

            // Automatically trigger dialogue generation / AI roleplay initiation for active scene NPCs if App exposes it
            if (typeof App !== 'undefined' && typeof App.handleGenerateDialogue === 'function' && appState.getActiveNpcCount() > 0) {
                console.log("[Scene Selector] Automatically starting AI roleplay for newly populated scene...");
                App.handleGenerateDialogue();
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

        // Initialize dynamic scene dropdown population after button bindings
        this.setupSceneSelectorDropdown();
    }
};