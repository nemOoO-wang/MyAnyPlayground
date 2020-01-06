let isAddKeyPressListenerToEditor = false;
// requestHandler
function requestHandler (request, sender, sendResponse) {
    if (request && (request.action === 'button-click')) {

        // Check if the focused element is a valid render target
        focusedElem = Utils.findFocusedElem(window.document);
        if (!focusedElem) {
        // Shouldn't happen. But if it does, just silently abort.
            return false
        }

        if (!Utils.elementCanBeRendered(focusedElem)) {
            return false
        }

        function getRangeTableAndTr() {
            const range = focusedElem.ownerDocument.defaultView.getSelection().getRangeAt(0);
            const rangeCommonElement = getClosestElement(range.commonAncestorContainer);
            // gmail will change id
            const tableElement = rangeCommonElement.closest('table[id*=weekly-report-table]');
            const trElement = rangeCommonElement.closest('tr');

            if (tableElement && trElement && tableElement.contains(trElement)) {
                return [tableElement, trElement];
            }

            return [tableElement, null];
        }

        // add listener to editor
        if (!isAddKeyPressListenerToEditor) {
            focusedElem.addEventListener('keypress', (e) => {
                if (e.ctrlKey && e.keyCode === 61) {
                    // ctrl +
                    const [tableElement, trElement] = getRangeTableAndTr();
                    
                    if (tableElement && trElement) {
                        const tableBodyElement =tableElement.getElementsByTagName('tbody')[0];
                        const tableTrFragment = fragmentFromString(tableItemString(null, 0));
                        tableBodyElement.insertBefore(tableTrFragment, trElement);
                    }
                } else if (e.ctrlKey && e.keyCode === 31) {
                    // ctrl -
                    const range = focusedElem.ownerDocument.defaultView.getSelection().getRangeAt(0);
                    const rangeCommonElement = range.commonAncestorContainer.parentElement;
                    // gmail will change id
                    const tableElement = rangeCommonElement.closest('table[id*=weekly-report-table]');
                    const isInTable = tableElement !== null;
                    if (isInTable) {
                        const trElement = rangeCommonElement.closest('tr');
                        const tableBodyElement =tableElement.getElementsByTagName('tbody')[0];
                        if (tableBodyElement && tableBodyElement.children.length <= 1) {
                            // when tr less than 1, delete table element
                            tableElement.remove();
                        } else {
                            trElement.remove();
                        }
                    }
                }
            })
            isAddKeyPressListenerToEditor = true
        }
        

        const selectedRange = Utils.getOperationalRange(focusedElem)
        const originalHtml = Utils.getDocumentFragmentHTML(selectedRange.cloneContents());

        chrome.runtime.sendMessage(sender.id, { action: 'request-format', selectedHtml: originalHtml }, function (list) {
            if (list && list.length > 0) {
                // chrome bug? if not call sendResponse function
                const [tableElement, trElement] = getRangeTableAndTr();
                if (tableElement && trElement) {
                    // 👉parse jira list within table 
                    const tableBodyElement =tableElement.getElementsByTagName('tbody')[0];
                    list.reverse().forEach((item) => {
                        const tableTrFragment = fragmentFromString(tableItemString(item, 0));
                        tableBodyElement.insertBefore(tableTrFragment, trElement);
                    })
                } else {
                    // 👉parse jira list with default format
                    Utils.replaceRange(selectedRange, makeHtmlTemplete(list));
                }
            }
        })
    }
}


chrome.runtime.onMessage.addListener(requestHandler)

// customfield_10100

function tableItemString(item, index = 0) {
    const order = index + 1;
    const title = item ? `${item.fields.summary} [${makeJiraHref(item.key)}]` : '';
    const point = item ? `${item.fields.customfield_10100 / 5 * 100}%` : '';
    const comment = item ? `${item.fields.comment.comments.map(item => (`${item.body} -${item.author.emailAddress}`)).join('\n')}` : '';
    return (
        `<tr style="height: 21px;">
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);">${order}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; border: 1px solid rgb(204, 204, 204);" rowspan="1" colspan="2">${title}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);">${point}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);">100%</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; border: 1px solid rgb(204, 204, 204);" rowspan="1" colspan="2">${comment}</td>
        </tr>`
    )
}

function makeHtmlTemplete (list) {
    return `<table
        cellspacing="0"
        cellpadding="0"
        dir="ltr"
        border="1"
        id="weekly-report-table"
        style="table-layout: fixed; font-size: 10pt; font-family: arial, sans, sans-serif; width: 0px; border-collapse: collapse; border: none;"
    >
        <colgroup>
            <col width="100">
            <col width="100">
            <col width="403">
            <col width="100">
            <col width="100">
            <col width="100">
            <col width="100">
        </colgroup>
        <tbody>
            <tr style="height: 21px;">
                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);">序号</td>
                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);" rowspan="1" colspan="2">工作内容描述</td>
                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);">工作时间占比</td>
                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);">进度</td>
                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);" rowspan="1" colspan="2">备注</td>
            </tr>
            ${list.map((item, index) => (`
                <tr style="height: 21px;">
                    <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);">${index + 1}</td>
                    <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; border: 1px solid rgb(204, 204, 204);" rowspan="1" colspan="2">${item.fields.summary} [${makeJiraHref(item.key)}]</td>
                    <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);">${item.fields.customfield_10100 / 5 * 100}%</td>
                    <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; text-align: center; border: 1px solid rgb(204, 204, 204);">100%</td>
                    <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; border: 1px solid rgb(204, 204, 204);" rowspan="1" colspan="2">${item.fields.comment.comments.map(item => (`${item.body} -${item.author.emailAddress}`)).join('\n')}</td>
                </tr>
            `)).join('')}
        </tbody>
    </table>`
}

function fragmentFromString(strHTML) {
    const temp = document.createElement('template');
    temp.innerHTML = strHTML;
    return temp.content;
}

function makeJiraHref (jiraId) {
    return `<a href="https://jira.shopee.io/browse/${jiraId}">${jiraId}</a>`
}

function getClosestElement (node) {
    let currentNode = node;
    while (currentNode !== null && currentNode.nodeType !== 1) {
        currentNode = currentNode.parentNode;
    }
    return currentNode;
}
