// background.js

// Store IDs per tab
const tabData = {}; // { tabId: { taskId: '...', attemptId: '...' } }

// Function to update tab data and notify popup if open
function updateTabData(tabId, data) {
  if (!tabData[tabId]) {
    tabData[tabId] = {};
  }
  Object.assign(tabData[tabId], data);
  console.log(`Updated data for tab ${tabId}:`, tabData[tabId]);

  // Notify popup if it's open (we don't know which popup belongs to which tab directly,
  // so we broadcast. Popup should check if the update is relevant if needed,
  // but in this simple case, any open popup showing will likely want the latest data).
  chrome.runtime.sendMessage({ type: 'UPDATE_IDS', ids: tabData[tabId] }).catch(error => {
      // Ignore errors, popup might not be open
      if (!error.message.includes("Receiving end does not exist")) {
          console.warn("Error sending message to popup:", error);
      }
  });
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let tabId = sender.tab?.id;

  console.log(`Background received message: ${message.type} from tab: ${tabId || 'popup/unknown'}`);

  if (message.type === 'FOUND_TASK_ID') {
    if (tabId) {
      updateTabData(tabId, { taskId: message.taskId });
      sendResponse({ status: "TaskId received" });
    } else {
      console.error('Received FOUND_TASK_ID without tabId');
      sendResponse({ status: "Error: Missing tabId" });
    }
  } else if (message.type === 'FOUND_ATTEMPT_ID') {
    if (tabId) {
      updateTabData(tabId, { attemptId: message.attemptId });
      sendResponse({ status: "AttemptId received" });
    } else {
      console.error('Received FOUND_ATTEMPT_ID without tabId');
      sendResponse({ status: "Error: Missing tabId" });
    }
  } else if (message.type === 'GET_IDS') {
     // Message likely from popup, which doesn't have a tabId in sender
     // We need to get the *current* active tab to provide its IDs
     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
       const currentTabId = tabs[0]?.id;
       if (currentTabId && tabData[currentTabId]) {
         console.log(`Sending IDs for active tab ${currentTabId} to popup:`, tabData[currentTabId]);
         sendResponse({ ids: tabData[currentTabId] });
       } else {
         console.log(`No data found for active tab ${currentTabId || 'N/A'}`);
         sendResponse({ ids: { taskId: null, attemptId: null } }); // Send empty object if no data
       }
     });
     return true; // Indicates we will send a response asynchronously
  } else if (message.type === 'FORCE_CLAIM') {
    if (message.taskId) {
       chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
           const currentTabId = tabs[0]?.id;
           if(currentTabId){
               const newUrl = `https://app.outlier.ai/en/expert/tasks?forceClaim=1&taskId=${message.taskId}`;
               chrome.tabs.update(currentTabId, { url: newUrl });
               console.log(`Tab ${currentTabId} updated to Force Claim URL for task ${message.taskId}`);
               sendResponse({status: "Navigated to Force Claim"});
           } else {
               console.error("Could not get current tab to Force Claim");
               sendResponse({status: "Error: could not get current tab"});
           }
       });
        return true; // Async response
    } else {
      console.error("FORCE_CLAIM message missing taskId");
      sendResponse({status: "Error: Missing taskId"});
    }
  } else if (message.type === 'INCREASE_TIMER') {
    if (message.attemptId) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
           const currentTabId = tabs[0]?.id;
           if(currentTabId){
               const newUrl = `https://app.outlier.ai/en/expert/tasks?forceClaim=1&pipelineV3HumanNodeId=${message.attemptId}`;
               chrome.tabs.update(currentTabId, { url: newUrl });
               console.log(`Tab ${currentTabId} updated to Increase Timer URL for attempt ${message.attemptId}`);
               sendResponse({status: "Navigated to Increase Timer"});
           } else {
               console.error("Could not get current tab to Increase Timer");
               sendResponse({status: "Error: could not get current tab"});
           }
       });
       return true; // Async response
    } else {
        console.error("INCREASE_TIMER message missing attemptId");
        sendResponse({status: "Error: Missing attemptId"});
    }
  }

  // Return true to indicate you wish to send a response asynchronously
  // This is important for responses sent within async operations like chrome.tabs.query
  // We already returned true for GET_IDS, FORCE_CLAIM, INCREASE_TIMER
  // For the sync ones, it's okay not to return true.
 });

// Clean up tab data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabData[tabId]) {
    delete tabData[tabId];
    console.log(`Cleaned up data for closed tab ${tabId}`);
  }
});

// Optional: Clean up tab data when a tab is updated (e.g., navigated away)
// This prevents stale data if the user navigates away from the target page
// within the same tab without closing it.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the URL changed and it's no longer the target URL
  if (changeInfo.url && tabData[tabId]) {
    if (!changeInfo.url.startsWith("https://app.outlier.ai/en/expert/tasks")) {
        delete tabData[tabId];
        console.log(`Cleaned up data for tab ${tabId} due to navigation away from target URL`);
         // Optionally notify popup to clear its display if it's open and related to this tab
         chrome.runtime.sendMessage({ type: 'UPDATE_IDS', ids: { taskId: null, attemptId: null } }).catch(error => {
            if (!error.message.includes("Receiving end does not exist")) {
                console.warn("Error sending clear message to popup:", error);
            }
         });
    }
  }
});

console.log("Background service worker started."); 