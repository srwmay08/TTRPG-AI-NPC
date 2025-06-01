// eventHandlers.js
// Responsibility: Set up event listeners.
// Assumes utils.js and other relevant modules/functions are available.

function setupResizer() {
    const leftColumn = getElem('left-column');
    const resizer = getElem('resizer');
    if (!leftColumn || !resizer) {
        console.warn("Resizer or left column not found.");
        return;
    }

    let isResizing = false;
    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        document.body.style.cursor = 'col-resize';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        let newLeftWidth = e.clientX;
        const minColWidth = 200; // Consider moving to config.js
        const maxColWidth = window.innerWidth - 200; // Consider moving to config.js
        if (newLeftWidth < minColWidth) newLeftWidth = minColWidth;
        if (newLeftWidth > maxColWidth) newLeftWidth = maxColWidth;
        leftColumn.style.width = `${newLeftWidth}px`;
        // Potentially call adjustNpcDialogueAreaWidthsUI if center column width is affected
        const centerCol = getElem('center-column');
        if (centerCol) adjustNpcDialogueAreaWidthsUI(getElem('multi-npc-dialogue-container'));

    });
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
        }
    });
}

function setupCollapsibleSections() {
    document.querySelectorAll('#left-column .collapsible-section').forEach(section => {
        const header = section.querySelector('h3, h4');
        if (!header) return;

        // Ensure arrow indicator exists or create it
        let arrow = header.querySelector('.arrow-indicator');
        if (!arrow && (header.tagName === 'H3' || (header.tagName === 'H4' && section.id === 'npc-faction-standings-section'))) {
            arrow = document.createElement('span');
            arrow.className = 'arrow-indicator';
            // header.insertBefore(document.createTextNode(' '), header.firstChild); // Consider if space is needed
            header.appendChild(arrow); // Append to end for typical float:right styling
        }


        header.addEventListener('click', (e) => {
            if (e.target.closest('input, select, button, textarea')) {
                return; // Ignore clicks on interactive elements within header
            }
            const content = section.querySelector(':scope > .collapsible-content'); // Direct child
            if (content) {
                section.classList.toggle('collapsed');
                const isCollapsed = section.classList.contains('collapsed');
                content.style.display = isCollapsed ? 'none' : 'block';
                if(arrow) arrow.textContent = isCollapsed ? ' ►' : ' ▼';
            }
        });

        // Initial state based on IDs (as per original script logic)
        const contentToToggle = section.querySelector(':scope > .collapsible-content');
        const shouldBeOpen = ['pc-list-section', 'npc-list-section',
                              'character-profile-main-section', /*'gm-notes-collapsible-section', // These are sub-sections now
                              'npc-memories-collapsible-section', 'npc-faction-standings-section'*/
                             ].includes(section.id);

        if (contentToToggle) {
            if (shouldBeOpen) {
                section.classList.remove('collapsed');
                contentToToggle.style.display = 'block';
                if(arrow) arrow.textContent = ' ▼';
            } else {
                section.classList.add('collapsed');
                contentToToggle.style.display = 'none';
                if(arrow) arrow.textContent = ' ►';
            }
        }
         // Handle sub-collapsibles within character-profile-main-section if it's initially open
        if (section.id === 'character-profile-main-section' && !section.classList.contains('collapsed')) {
            section.querySelectorAll(':scope > .collapsible-content > .collapsible-section').forEach(subSection => {
                const subHeader = subSection.querySelector('h3, h4');
                const subArrow = subHeader ? subHeader.querySelector('.arrow-indicator') : null;
                const subContent = subSection.querySelector(':scope > .collapsible-content');

                if(subHeader && subArrow && subContent){ // Ensure all elements exist
                    // Default these to collapsed unless explicitly set to open
                    const subShouldBeOpen = ['gm-notes-collapsible-section', 'npc-memories-collapsible-section', 'npc-faction-standings-section'].includes(subSection.id);
                    if (subShouldBeOpen) {
                        subSection.classList.remove('collapsed');
                        subContent.style.display = 'block';
                        subArrow.textContent = ' ▼';
                    } else {
                        subSection.classList.add('collapsed');
                        subContent.style.display = 'none';
                        subArrow.textContent = ' ►';
                    }
                }
            });
        }
    });

    // Event delegation for PC Dashboard cards
    const pcDashboardContent = getElem('pc-dashboard-content');
    if (pcDashboardContent) {
        pcDashboardContent.addEventListener('click', function(event) {
            const clickedCard = event.target.closest('.clickable-pc-card');
            if (clickedCard) {
                const pcIdToRender = clickedCard.dataset.pcId;
                if (pcIdToRender) {
                    // This should call a function in app.js or characterService.js
                    // For now, directly calling a conceptual render function:
                    const pcData = appState.getCharacterById(pcIdToRender);
                    if (pcData) {
                        // Assuming renderDetailedPcSheetUI is globally available or imported
                        renderDetailedPcSheetUI(pcData, getElem('pc-dashboard-content'));
                    }
                } else {
                    console.error("Delegated Listener: Clicked card, but data-pc-id missing.");
                }
            }
        });
    }
}

function assignButtonEventHandlers() {
    // GM Notes
    const saveGmNotesBtn = getElem('save-gm-notes-btn');
    if (saveGmNotesBtn) saveGmNotesBtn.onclick = handleSaveGmNotes; // from characterService.js

    // Memories
    const addMemoryBtn = getElem('add-memory-btn');
    if (addMemoryBtn) addMemoryBtn.onclick = handleAddMemory; // from characterService.js

    // History
    const associateHistoryBtn = getElem('associate-history-btn');
    if (associateHistoryBtn) associateHistoryBtn.onclick = handleAssociateHistoryFile; // from characterService.js

    // Character Creation
    const createCharacterBtn = getElem('create-character-form')?.querySelector('button'); // More specific
    if (createCharacterBtn) createCharacterBtn.onclick = handleCharacterCreation; // from characterService.js

    // Dialogue
    const generateDialogueBtn = getElem('generate-dialogue-btn');
    if (generateDialogueBtn) generateDialogueBtn.onclick = handleGenerateDialogue; // from app.js
}


// If using ES6 modules:
// export { setupResizer, setupCollapsibleSections, assignButtonEventHandlers };