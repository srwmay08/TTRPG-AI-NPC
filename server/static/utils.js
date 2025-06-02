// static/utils.js
// Responsibility: General-purpose utility functions.

window.getElem = function(id) {
    return document.getElementById(id);
};

window.updateText = function(id, text) {
    const elem = window.getElem(id);
    if (elem) {
        elem.textContent = text;
    } else {
        console.warn(`updateText: Element with ID '${id}' not found.`);
    }
};

window.disableBtn = function(id, disabled) {
    const elem = window.getElem(id);
    if (elem) {
        elem.disabled = disabled;
    } else {
        console.warn(`disableBtn: Element with ID '${id}' not found.`);
    }
};

window.slugify = function(text) {
    if (text === null || typeof text === 'undefined') return '';
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w-]+/g, '')       // Remove all non-word chars
        .replace(/--+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
};

window.escapeHtml = function(unsafe) {
    if (typeof unsafe !== 'string') {
        if (unsafe === null || typeof unsafe === 'undefined') return '';
        try {
            unsafe = String(unsafe);
        } catch (e) {
            console.error("Could not convert to string for escaping:", unsafe, e);
            return '';
        }
    }
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};
