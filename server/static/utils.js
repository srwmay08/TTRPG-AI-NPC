// static/utils.js
// Responsibility: General-purpose utility functions.

var Utils = {
    getElem: function(id) {
        return document.getElementById(id);
    },

    updateText: function(id, text) {
        const elem = this.getElem(id); // Use 'this' for internal calls
        if (elem) {
            elem.textContent = text;
        } else {
            console.warn(`Utils.updateText: Element with ID '${id}' not found.`);
        }
    },

    disableBtn: function(id, disabled) {
        const elem = this.getElem(id); // Use 'this'
        if (elem) {
            elem.disabled = disabled;
        } else {
            console.warn(`Utils.disableBtn: Element with ID '${id}' not found.`);
        }
    },

    slugify: function(text) {
        if (text === null || typeof text === 'undefined') return '';
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    },

    escapeHtml: function(unsafe) {
        if (typeof unsafe !== 'string') {
            if (unsafe === null || typeof unsafe === 'undefined') return '';
            try {
                unsafe = String(unsafe);
            } catch (e) {
                console.error("Utils.escapeHtml: Could not convert to string for escaping:", unsafe, e);
                return '';
            }
        }
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
};
