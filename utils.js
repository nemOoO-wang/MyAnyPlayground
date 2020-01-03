;(function() {
    const Utils = {};
    // Finds and returns the page element that currently has focus. Drills down into
    // iframes if necessary.
    // Finds and returns the page element that currently has focus. Drills down into
    // iframes if necessary.
    function findFocusedElem(document) {
        const focusedElem = document.activeElement;
    
        // Tests if it's possible to access the iframe contentDocument without throwing
        // an exception.
        function iframeAccessOkay(focusedElem) {
            // Fix #173: https://github.com/adam-p/markdown-here/issues/173
            // Fix #435: https://github.com/adam-p/markdown-here/issues/435
            // If the focus is in an iframe with a different origin, then attempting to
            // access focusedElem.contentDocument will fail with a `SecurityError`:
            // "Failed to read the 'contentDocument' property from 'HTMLIFrameElement': Blocked a frame with origin "http://jsbin.io" from accessing a cross-origin frame."
            // Rather than spam the console with exceptions, we'll treat this as an
            // unrenderable situation (which it is).
            try {
                var _ = focusedElem.contentDocument;
            }
            catch (e) {
                // TODO: Check that this is actually a SecurityError and re-throw if it's not?
                return false;
            }
        
            return true;
        }
    
        if (!iframeAccessOkay(focusedElem)) {
            return null;
        }
    
        // If the focus is within an iframe, we'll have to drill down to get to the
        // actual element.
        while (focusedElem && focusedElem.contentDocument) {
            focusedElem = focusedElem.contentDocument.activeElement;
    
            if (!iframeAccessOkay(focusedElem)) {
                return null;
            }
        }
    
        // There's a bug in Firefox/Thunderbird that we need to work around. For
        // details see https://github.com/adam-p/markdown-here/issues/31
        // The short version: Sometimes we'll get the <html> element instead of <body>.
        if (focusedElem instanceof document.defaultView.HTMLHtmlElement) {
            focusedElem = focusedElem.ownerDocument.body;
        }
    
        return focusedElem;
    }
    // Returns true if the given element can be properly rendered (i.e., if it's
    // a rich-edit compose element).
    function elementCanBeRendered(elem) {
        // See here for more info about what we're checking:
        // http://stackoverflow.com/a/3333679/729729
        return (elem.contentEditable === true || elem.contentEditable === 'true' ||
                elem.contenteditable === true || elem.contenteditable === 'true' ||
                (elem.ownerDocument && elem.ownerDocument.designMode === 'on'));
    }
 
    // Get the currectly selected range. If there is no selected range (i.e., it is
    // collapsed), then contents of the currently focused element will be selected.
    // Returns null if no range is selected nor can be selected.
    function getOperationalRange(focusedElem) {
        var selection;
    
        selection = focusedElem.ownerDocument.defaultView.getSelection();
    
        if (selection.rangeCount < 1) {
        return null;
        }
    
        return selection.getRangeAt(0).cloneRange();
    }
    
    /**
     * Replaces the contents of `range` with the HTML string in `html`.
     * Returns the element that is created from `html`.
     * @param {Range} range
     * @param {string} html
     * @returns {Element}
     */
    function replaceRange(range, html) {
        var documentFragment, newElement;
    
        range.deleteContents();
    
        // Create a DocumentFragment to insert and populate it with HTML
        documentFragment = range.createContextualFragment(html);
    
        documentFragment = sanitizeDocumentFragment(documentFragment);
    
        // After inserting the node contents, the node is empty. So we need to save a
        // reference to the element that we need to return.
        newElement = documentFragment.firstChild;
    
        range.insertNode(documentFragment);
    
        // In some clients (and maybe some versions of those clients), on some pages,
        // the newly inserted rendered Markdown will be selected. It looks better and
        // is slightly less annoying if the text is not selected, and consistency
        // across platforms is good. So we're going to collapse the selection.
        // Note that specifying the `toStart` argument to `true` seems to be necessary
        // in order to actually get a cursor in the editor.
        // Fixes #427: https://github.com/adam-p/markdown-here/issues/427
        range.collapse(true);
    
        return newElement;
    }

    // An approximate equivalent to outerHTML for document fragments.
    function getDocumentFragmentHTML(docFrag) {
        var html = '', i;
        for (i = 0; i < docFrag.childNodes.length; i++) {
        var node = docFrag.childNodes[i];
        if (node.nodeType === node.TEXT_NODE) {
            html += node.nodeValue.replace(/[&<>]/g, replaceChar);
        }
        else { // going to assume ELEMENT_NODE
            html += outerHTML(node, docFrag.ownerDocument);
        }
        }
    
        return html;
    }

    // Removes potentially harmful elements and attributes from `docFrag`.
    // Returns a santized copy.
    function sanitizeDocumentFragment(docFrag) {
        var i;
    
        // Don't modify the original
        docFrag = docFrag.cloneNode(true);
    
        var scriptTagElems = docFrag.querySelectorAll('script');
        for (i = 0; i < scriptTagElems.length; i++) {
        scriptTagElems[i].parentNode.removeChild(scriptTagElems[i]);
        }
    
        function cleanAttributes(node) {
        var i;
    
        if (typeof(node.removeAttribute) === 'undefined') {
            // We can't operate on this node
            return;
        }
    
        // Remove event handler attributes
        for (i = node.attributes.length-1; i >= 0; i--) {
            if (node.attributes[i].name.match(/^on/)) {
            node.removeAttribute(node.attributes[i].name);
            }
        }
        }
    
        walkDOM(docFrag.firstChild, cleanAttributes);
    
        return docFrag;
    }
    
    // Walk the DOM, executing `func` on each element.
    // From Crockford.
    function walkDOM(node, func) {
        func(node);
        node = node.firstChild;
        while(node) {
        walkDOM(node, func);
        node = node.nextSibling;
        }
    }

    function replaceChar(char) {
        return charsToReplace[char] || char;
    }
  
    // From: http://stackoverflow.com/a/3819589/729729
    // Postbox doesn't support `node.outerHTML`.
    function outerHTML(node, doc) {
        // if IE, Chrome take the internal method otherwise build one
        return node.outerHTML || (
        function(n){
            var div = doc.createElement('div'), h;
            div.appendChild(n.cloneNode(true));
            h = div.innerHTML;
            div = null;
            return h;
        })(node);
    }

    Utils.findFocusedElem = findFocusedElem;
    Utils.elementCanBeRendered = elementCanBeRendered;
    Utils.replaceRange = replaceRange;
    Utils.getOperationalRange = getOperationalRange;
    Utils.getDocumentFragmentHTML = getDocumentFragmentHTML;

    var EXPORTED_SYMBOLS = ['Utils'];
    if (typeof module !== 'undefined') {
    module.exports = Utils;
    } else {
    this.Utils = Utils;
    this.EXPORTED_SYMBOLS = EXPORTED_SYMBOLS;
    }
}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());
