// static/eventHandlers.js
// Responsibility: Set up event listeners.

function setupResizer() {
    const leftColumn = window.getElem('left-column'); // Use window.getElem
    const resizer = window.getElem('resizer');
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
        const minColWidth = 300;
        const maxColWidth = window.innerWidth - 250;
        if (newLeftWidth < minColWidth) newLeftWidth = minColWidth;
        if (newLeftWidth > maxColWidth) newLeftWidth = maxColWidth;
        leftColumn.style.width = `${newLeftWidth}px`;
        const centerCol = window.getElem('center-column');
        if (centerCol) window.adjustNpcDialogueAreaWidthsUI(window.getElem('multi-npc-dialogue-container')); // Use window.

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
                content.style.display = isCollapsed ? 'none' : 'block';
                if (arrow) arrow.textContent = isCollapsed ? ' ►' : ' ▼';
            }
        });

        const contentToToggle = section.querySelector(':scope > .collapsible-content');
        const shouldBeOpen = ['pc-list-section-outer', 'npc-list-for-scene-section', 'all-npc-list-management-section', 'character-profile-main-section', 'create-lore-entry-form-section'].includes(section.id);
        const isSubSectionOfProfile = section.parentElement?.parentElement?.id === 'character-profile-main-section';


        if (contentToToggle) {
            if (shouldBeOpen && !isSubSectionOfProfile) {
                section.classList.remove('collapsed');
                contentToToggle.style.display = 'block';
                if (arrow) arrow.textContent = ' ▼';
            } else if (isSubSectionOfProfile && ['gm-notes-collapsible-section'].includes(section.id)){
                 section.classList.remove('collapsed');
                 contentToToggle.style.display = 'block';
                 if(arrow) arrow.textContent = ' ▼';
            }
            else {
                section.classList.add('collapsed');
                contentToToggle.style.display = 'none';
                if (arrow) arrow.textContent = ' ►';
            }
        }
    });

    const pcDashboardContent = window.getElem('pc-dashboard-content');
    if (pcDashboardContent) {
        pcDashboardContent.addEventListener('click', function(event) {
            const clickedCard = event.target.closest('.clickable-pc-card');
            if (clickedCard) {
                const pcIdToRender = clickedCard.dataset.pcId;
                if (pcIdToRender) {
                    const pcData = appState.getCharacterById(pcIdToRender);
                    if (pcData) {
                         window.renderDetailedPcSheetUI(pcData, window.getElem('pc-dashboard-content'));
                    }
                } else {
                    console.error("Delegated Listener: Clicked card, but data-pc-id missing.");
                }
            }
        });
    }
}


function assignButtonEventHandlers() {
    const saveGmNotesBtn = window.getElem('save-gm-notes-btn');
    if (saveGmNotesBtn) saveGmNotesBtn.onclick = window.handleSaveGmNotes;

    const addMemoryBtn = window.getElem('add-memory-btn');
    if (addMemoryBtn) addMemoryBtn.onclick = window.handleAddMemory;

    const associateHistoryBtn = window.getElem('associate-history-btn');
    if (associateHistoryBtn) associateHistoryBtn.onclick = window.handleAssociateHistoryFile;

    const createCharacterBtn = window.getElem('create-character-form')?.querySelector('button');
    if (createCharacterBtn) createCharacterBtn.onclick = window.handleCharacterCreation;

    const generateDialogueBtn = window.getElem('generate-dialogue-btn');
    if (generateDialogueBtn) generateDialogueBtn.onclick = window.handleGenerateDialogue;

    const createLoreBtn = window.getElem('create-lore-entry-form')?.querySelector('button');
    if (createLoreBtn) createLoreBtn.onclick = window.handleCreateLoreEntry;

    const saveLoreGmNotesBtn = window.getElem('save-lore-gm-notes-btn');
    if(saveLoreGmNotesBtn) saveLoreGmNotesBtn.onclick = window.handleUpdateLoreEntryGmNotes;

    const deleteLoreBtn = window.getElem('delete-lore-btn');
    if(deleteLoreBtn) deleteLoreBtn.onclick = window.handleDeleteLoreEntry;

    const closeLoreDetailBtn = window.getElem('lore-entry-profile-section')?.querySelector('button[onclick*="closeLoreDetailViewUI"]');
    if(closeLoreDetailBtn) closeLoreDetailBtn.onclick = window.closeLoreDetailViewUI;


    const linkLoreToCharBtn = window.getElem('link-lore-to-char-btn');
    if (linkLoreToCharBtn) linkLoreToCharBtn.onclick = window.handleLinkLoreToCharacter;
}