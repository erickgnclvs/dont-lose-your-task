// Store data per tab (tabId -> attemptId mapping)
const tabData = {};
const MAX_HISTORY_ITEMS = 10;
// Extract attemptId from Outlier URLs
const attemptIdRegex = /[?&](attemptId|assignmentId)=([^&]+)/;

// Keep-alive mechanism to prevent service worker from being terminated
function setupKeepAlive() {
  setInterval(() => {
    // Perform minimal action to keep service worker alive
    chrome.storage.local.get('lastActive', () => {
      chrome.storage.local.set({ lastActive: Date.now() });
    });
  }, 25000);
}

// Start keep-alive as soon as background script loads
setupKeepAlive();

// Monitor network requests to capture attemptId automatically
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (details.method === 'GET' && details.tabId > 0) {
      const attemptIdMatch = details.url.match(attemptIdRegex);
      if (attemptIdMatch && attemptIdMatch[2]) {
        updateTabData(details.tabId, { attemptId: attemptIdMatch[2] });
      }
    }
    return { cancel: false };
  },
  { urls: ['https://app.outlier.ai/*'] }
);

// Update tab data and notify UI of changes
function updateTabData(tabId, data) {
  if (!tabData[tabId]) {
    tabData[tabId] = {};
  }
  Object.assign(tabData[tabId], data);

  // Save to history if we have an attemptId
  if (tabData[tabId].attemptId) {
    addToHistory(tabData[tabId]);
  }

  // Notify any open popup about the data update
  chrome.runtime.sendMessage({ type: 'UPDATE_IDS', ids: tabData[tabId] }).catch(() => {});
}

// Add task to persistent history
function addToHistory(data) {
  if (!data.attemptId) return;
  
  chrome.storage.local.get(['taskHistory'], (result) => {
    let history = result.taskHistory || [];
    const exists = history.some(item => item.attemptId === data.attemptId);
    
    if (!exists) {
      // Add new entry with timestamp
      const newEntry = {
        attemptId: data.attemptId,
        timestamp: new Date().toISOString()
      };
      
      // Add to beginning of history array
      history.unshift(newEntry);
      
      // Limit history size
      if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
      }
      
      chrome.storage.local.set({ taskHistory: history });
    }
  });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let tabId = sender.tab?.id;

  // Handle different message types
  if (message.type === 'GET_IDS') {
     // Provide IDs to popup for current active tab
     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
       const currentTabId = tabs[0]?.id;
       if (currentTabId && tabData[currentTabId]) {
         sendResponse({ ids: tabData[currentTabId] });
       } else {
         sendResponse({ ids: { attemptId: null } });
       }
     });
     return true; // async response
  } else if (message.type === 'GET_HISTORY') {
     // Provide saved task history to popup
     chrome.storage.local.get(['taskHistory'], (result) => {
       const history = result.taskHistory || [];
       sendResponse({ history });
     });
     return true; // async response

  } else if (message.type === 'FORCE_CLAIM') {
    // Navigate to force claim URL for the specified task
    if (message.attemptId) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
           const currentTabId = tabs[0]?.id;
           if(currentTabId){
               const newUrl = `https://app.outlier.ai/en/expert/tasks?forceClaim=1&pipelineV3HumanNodeId=${message.attemptId}`;
               chrome.tabs.update(currentTabId, { url: newUrl });
               sendResponse({status: "Navigated to force claim"});
           } else {
               sendResponse({status: "Error: could not get current tab"});
           }
       });
       return true; // async response
    } else {
        sendResponse({status: "Error: Missing attemptId"});
    }
  }
 });

// Clean up tab data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabData[tabId]) {
    delete tabData[tabId];
  }
});

// Clean up data when tab navigates away from Outlier tasks page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && tabData[tabId]) {
    if (!changeInfo.url.startsWith("https://app.outlier.ai/en/expert/tasks")) {
        delete tabData[tabId];
        chrome.runtime.sendMessage({ type: 'UPDATE_IDS', ids: { attemptId: null } }).catch(() => {});
    }
  }
});

 