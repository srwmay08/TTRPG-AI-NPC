// utils.js
// Responsibility: General-purpose utility functions.

function getElem(id) {
    return document.getElementById(id);
}

function updateText(id, text) {
    const elem = getElem(id);
    if (elem) {
        elem.textContent = text;
    } else {
        console.warn(`updateText: Element with ID '${id}' not found.`);
    }
}

function disableBtn(id, disabled) {
    const elem = getElem(id);
    if (elem) {
        elem.disabled = disabled;
    } else {
        console.warn(`disableBtn: Element with ID '${id}' not found.`);
    }
}

// If using ES6 modules:
// export { getElem, updateText, disableBtn };