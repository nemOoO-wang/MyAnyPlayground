// Add the browserAction (the button in the browser toolbar) listener.
chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.sendMessage(tab.id, { action: 'button-click' })
})

async function fetchJira(jiraId) {
    return fetch(`https://jira.shopee.io/rest/api/latest/issue/${jiraId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
          },
    })
    .then(async (response) => {
        // const errorResponse = response
        if (response.status === 200) {
            const json = await response.json()
            return [null, json]
        }
        return [{ message: `fetch jira ${jiraId} occur error, network error ${response.status}`}];
    })
}

function getSuitableStartDayOffset(...args) {
    const now = new Date(...args);
    const dayNow = now.getDay();
    // const dateNow = now.getDate();
    // const monthNow = now.getMonth();
    // const yearNow = now.getFullYear();
    // const dayMS = 24 * 60 * 60 * 1000;
    if (dayNow >= 1 && dayNow <=3) {
        // 星期一到星期三 统计上周
        return 1 - dayNow - 7
    } else {
        return (7 - dayNow) % 7 + 1 - 7
    } 
}

function getDefaultJql() {
    let startTimeTs, endTimeTs;
    const now = new Date();
    const startDayOffset = getSuitableStartDayOffset(now);

    const dateNow = now.getDate();
    const monthNow = now.getMonth();
    const yearNow = now.getFullYear();
    const dayMS = 24 * 60 * 60 * 1000;
    startTimeTs = new Date(yearNow, monthNow, dateNow).getTime() + startDayOffset * dayMS;
    endTimeTs = new Date(yearNow, monthNow, dateNow).getTime() + (startDayOffset + 7) *dayMS;

    const startTime = new Date(startTimeTs);
    const endTime = new Date(endTimeTs);
    // const startTimeFullYear = startTime.getFullYear();
    // const startTimeMonth = startTime.getMonth();
    // const startTimeDate = startTime.getDate();
    const startTimeString = startTime.toISOString().split('T')[0];
    const endTimeString = endTime.toISOString().split('T')[0];
    return `issuetype%20in%20subTaskIssueTypes()%20AND%20status%20in%20(Doing%2C%20Done)%20AND%20updated%20%3E%3D%20${startTimeString}%20AND%20updated%20%3C%3D%20${endTimeString}%20AND%20assignee%20in%20(currentUser())%20ORDER%20BY%20priority%20DESC%2C%20created%20ASC`
}

function getPlanJql () {
    return `issuetype%20in%20subTaskIssueTypes()%20AND%20status%20in%20(Waiting%2C%20"To%20Do"%2C%20Developing)%20AND%20assignee%20in%20(currentUser())%20ORDER%20BY%20priority%20DESC%2C%20created%20ASC`
}
async function fetchFilterList(jql) {
    return fetch(`https://jira.shopee.io/rest/api/2/search?jql=${jql}&fields=*all`)
    .then(async (response) => {
        // const errorResponse = response
        if (response.status === 200) {
            const json = await response.json()
            return [null, json]
        }
        return [{ message: `fetch jira list occur error, network error ${response.status}`}];
    })
}

function getJiraId(selectedHtml) {
    const regexArr = selectedHtml.match(/\bjira:([A-Z]{1,}-\d{1,5}),\s?([A-Z]{1,}-\d{1,5})*/)
    return regexArr ? regexArr[1] : null
}


function requestFormatHandler(request, sender, sendResponse) {
    if (request && request.action === 'request-format') {
        const selectedHtml = request.selectedHtml.replace(/(<([^>]+)>)/ig, '');
        console.log("d", request.selectedHtml)
        console.log("sel", selectedHtml)

        if (/jira:.*/.test(selectedHtml)) {

            console.log("Enter Jira format handle");
            const re = /[A-Z]{1,}-\d{1,5}|#work|#plan|#jql=[^\s]+/g;
            const matches = [];
            while (true) {
                const match = re.exec(selectedHtml)
                if (match) {
                    matches.push(match[0]);
                } else {
                    break;
                }
            }



            // const jiraIds = selectedHtml.match(/([A-Z]{1,}-\d{1,5})+/g)
            const jiraInfos = matches.map(item => {
                if (/^#.*/.test(item)) {
                    let jql;
                    if (/^#work$/.test(item)) {
                        jql = getDefaultJql();
                    } else if (/^#plan$/.test(item)) {
                        jql = getPlanJql();
                    } else if (/^#jql=[^\s]+/.test(item)) {
                        const matchArr = /^#jql=([^\s]+)/.exec(item);
                        if (matchArr && matchArr[1]) {
                            jql = matchArr[1];
                        }
                    }
                    if (jql) {
                        return {
                            type: '#',
                            fetch: fetchFilterList(jql)
                        };
                    }
                } else if (/^[A-Z]{1,}-\d{1,5}$/.test(item)) {
                    const jiraId = item;
                    return {
                        type: 'jira',
                        fetch: fetchJira(jiraId)
                    };
                }
                return null;
            });
            const filterInfos = jiraInfos.filter(item => item !== null);
            Promise.all(filterInfos.map(item => item.fetch))
                .then((arr) => {
                    const errors = arr.filter(item => item[0]).map((item) => (item[0].message));
                    if (errors.length > 0) {
                        const errorMessage = errors.join('\n');
                        chrome.tabs.executeScript(sender.tab.id, { code: `alert(\`${errorMessage}\`)` });
                    }

                    const vaildJiraIssues = [];
                    arr.forEach((item, index) => {
                        if (item[0] === null) {
                            if (filterInfos[index].type === '#') {
                                const issues = item[1] && item[1].issues;
                                if (issues) {
                                    vaildJiraIssues.push(...issues);
                                }
                            } else if (filterInfos[index].type === 'jira') {
                                const issue = item[1];
                                if (issue) {
                                    vaildJiraIssues.push(item[1]);
                                }
                            }
                        }
                    });
                    // format infos
                    // info.fields.summary
                    // info.key
                    // info.fields.comment.comments [body, emailAddress, avatarUrls.[48x48]]
                    // info.fields.customfield_10100 / 5
                    if (vaildJiraIssues.length > 0) {
                        sendResponse(vaildJiraIssues);
                    }
                })
        }
    }
    return true;
}

chrome.runtime.onMessage.addListener(requestFormatHandler)