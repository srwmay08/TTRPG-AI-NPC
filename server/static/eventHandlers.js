// static/eventHandlers.js
// Responsibility: Set up event listeners.

var EventHandlers = {
    setupResizer: function() {
    const leftColumn = Utils.getElem('left-column');
    const resizer = Utils.getElem('resizer');
    if (!leftColumn || !resizer) {
        console.warn("EventHandlers.setupResizer: Resizer or left column not found.");
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
        const minColWidth = 300;
        const maxColWidth = window.innerWidth - 250;
        if (newLeftWidth < minColWidth) newLeftWidth = minColWidth;
        if (newLeftWidth > maxColWidth) newLeftWidth = maxColWidth;
        leftColumn.style.width = `${newLeftWidth}px`;
    });
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
        }
    });
},

    setupCollapsibleSections: function() {
    document.querySelectorAll('#left-column .collapsible-section').forEach(section => {
        // Do not make #scene-context-filters-direct collapsible
        if (section.id === 'scene-context-filters-direct') return;

        const header = section.querySelector('h3, h4');
        if (!header) return;

        let arrow = header.querySelector('.arrow-indicator');
        if (!arrow) {
            arrow = document.createElement('span');
            arrow.className = 'arrow-indicator';
            header.appendChild(arrow);
        }

        header.addEventListener('click', (e) => {
            if (e.target.closest('input, select, button, textarea')) return;

            const content = section.querySelector(':scope > .collapsible-content');
            if (content) {
                section.classList.toggle('collapsed');
                const isCollapsed = section.classList.contains('collapsed');
                if (arrow) arrow.textContent = isCollapsed ? ' ►' : ' ▼';
            }
        });

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
             // Explicitly keep 'npc-list-for-scene-section' open if it's in the scene tab
            if (section.id === 'npc-list-for-scene-section') {
                shouldBeOpen = true;
            }


            if (shouldBeOpen) {
                section.classList.remove('collapsed');
                if (arrow) arrow.textContent = ' ▼';
            } else {
                section.classList.add('collapsed');
                if (arrow) arrow.textContent = ' ►';
            }
        }
    });

    const pcDashboardContent = Utils.getElem('pc-dashboard-content');
    if (pcDashboardContent) {
        pcDashboardContent.addEventListener('click', function(event) {
            const clickedCard = event.target.closest('.clickable-pc-card');
            if (clickedCard) {
                const pcIdToRender = clickedCard.dataset.pcId;
                if (pcIdToRender) {
                    const pcData = appState.getCharacterById(pcIdToRender);
                    if (pcData) {
                         // Updated to use PCRenderers
                         PCRenderers.renderDetailedPcSheetUI(pcData, Utils.getElem('pc-dashboard-content'));
                    }
                } else {
                    console.error("EventHandlers: Clicked card in dashboard, but data-pc-id missing.");
                }
            }
        });
    }
},

    assignButtonEventHandlers: function() {
        const saveGmNotesBtn = Utils.getElem('save-gm-notes-btn');
        if (saveGmNotesBtn) saveGmNotesBtn.onclick = CharacterService.handleSaveGmNotes;

        const addMemoryBtn = Utils.getElem('add-memory-btn');
        if (addMemoryBtn) addMemoryBtn.onclick = CharacterService.handleAddMemory;

        const associateHistoryBtn = Utils.getElem('associate-history-btn');
        if (associateHistoryBtn) associateHistoryBtn.onclick = CharacterService.handleAssociateHistoryFile;

        const createCharacterBtn = Utils.getElem('create-character-form')?.querySelector('button');
        if (createCharacterBtn) createCharacterBtn.onclick = CharacterService.handleCharacterCreation;

        // App is assumed to be globally available
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
    }
};