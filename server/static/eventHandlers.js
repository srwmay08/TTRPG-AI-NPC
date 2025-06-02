// static/eventHandlers.js
// Responsibility: Set up event listeners.

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
        const minColWidth = 300; // Adjusted
        const maxColWidth = window.innerWidth - 250; // Adjusted
        if (newLeftWidth < minColWidth) newLeftWidth = minColWidth;
        if (newLeftWidth > maxColWidth) newLeftWidth = maxColWidth;
        leftColumn.style.width = `${newLeftWidth}px`;
        const centerCol = getElem('center-column');
        if (centerCol) window.adjustNpcDialogueAreaWidthsUI(getElem('multi-npc-dialogue-container'));

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

        let arrow = header.querySelector('.arrow-indicator');
        if (!arrow) { // Create arrow if it doesn't exist for all collapsible headers
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
                content.style.display = isCollapsed ? 'none' : 'block';
                if (arrow) arrow.textContent = isCollapsed ? ' ►' : ' ▼';
            }
        });

        // Initial state based on IDs
        const contentToToggle = section.querySelector(':scope > .collapsible-content');
        const shouldBeOpen = ['pc-list-section', 'npc-list-section', 'character-profile-main-section'].includes(section.id);
        const isSubSectionOfProfile = section.parentElement?.parentElement?.id === 'character-profile-main-section';


        if (contentToToggle) {
            if (shouldBeOpen && !isSubSectionOfProfile) { // Main sections default open
                section.classList.remove('collapsed');
                contentToToggle.style.display = 'block';
                if (arrow) arrow.textContent = ' ▼';
            } else if (isSubSectionOfProfile && ['gm-notes-collapsible-section'].includes(section.id)){ // Specific sub-sections default open
                 section.classList.remove('collapsed');
                 contentToToggle.style.display = 'block';
                 if(arrow) arrow.textContent = ' ▼';
            }
            else { // All others (including other sub-sections) default collapsed
                section.classList.add('collapsed');
                contentToToggle.style.display = 'none';
                if (arrow) arrow.textContent = ' ►';
            }
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
                    // This will now call window.renderDetailedPcSheetUI via app.js logic
                    window.renderDetailedPcSheetUI(appState.getCharacterById(pcIdToRender), getElem('pc-dashboard-content'));
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
    if (saveGmNotesBtn) saveGmNotesBtn.onclick = window.handleSaveGmNotes;

    // Memories
    const addMemoryBtn = getElem('add-memory-btn');
    if (addMemoryBtn) addMemoryBtn.onclick = window.handleAddMemory;

    // History
    const associateHistoryBtn = getElem('associate-history-btn');
    if (associateHistoryBtn) associateHistoryBtn.onclick = window.handleAssociateHistoryFile;

    // Character Creation
    const createCharacterBtn = getElem('create-character-form')?.querySelector('button');
    if (createCharacterBtn) createCharacterBtn.onclick = window.handleCharacterCreation;

    // Dialogue
    const generateDialogueBtn = getElem('generate-dialogue-btn');
    if (generateDialogueBtn) generateDialogueBtn.onclick = window.handleGenerateDialogue;

    // Lore Management
    const createLoreBtn = getElem('create-lore-entry-form')?.querySelector('button');
    if (createLoreBtn) createLoreBtn.onclick = window.handleCreateLoreEntry;

    const saveLoreGmNotesBtn = getElem('save-lore-gm-notes-btn');
    if(saveLoreGmNotesBtn) saveLoreGmNotesBtn.onclick = window.handleUpdateLoreEntryGmNotes;

    const deleteLoreBtn = getElem('delete-lore-btn');
    if(deleteLoreBtn) deleteLoreBtn.onclick = window.handleDeleteLoreEntry;
    
    const closeLoreDetailBtn = getElem('lore-entry-profile-section')?.querySelector('button[onclick*="closeLoreDetailView"]');
    if(closeLoreDetailBtn) closeLoreDetailBtn.onclick = window.closeLoreDetailViewUI;


    // Character-Lore Linking
    const linkLoreToCharBtn = getElem('link-lore-to-char-btn');
    if (linkLoreToCharBtn) linkLoreToCharBtn.onclick = window.handleLinkLoreToCharacter;

}