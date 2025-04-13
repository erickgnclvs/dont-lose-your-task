const CONFIG = {
  MAX_HISTORY_ITEMS: 10,
  KEEP_ALIVE_INTERVAL: 25000,
  OUTLIER_BASE_URL: 'https://app.outlier.ai',
  OUTLIER_TASKS_PATH: '/en/expert/tasks',
  ATTEMPT_ID_REGEX: /[?&](attemptId|assignmentId)=([^&]+)/
};

const MESSAGE_TYPES = {
  GET_IDS: 'GET_IDS',
  GET_HISTORY: 'GET_HISTORY',
  FORCE_CLAIM: 'FORCE_CLAIM',
  UPDATE_IDS: 'UPDATE_IDS'
};

// Store data per tab (tabId -> attemptId mapping)
const tabData = {};

function setupKeepAlive() {
  setInterval(() => {
    chrome.storage.local.get('lastActive', () => {
      chrome.storage.local.set({ lastActive: Date.now() });
    });
  }, CONFIG.KEEP_ALIVE_INTERVAL);
}

setupKeepAlive();

// Monitor network requests to capture attemptId automatically
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (details.method === 'GET' && details.tabId > 0) {
      const attemptIdMatch = details.url.match(CONFIG.ATTEMPT_ID_REGEX);
      if (attemptIdMatch && attemptIdMatch[2]) {
        updateTabData(details.tabId, { attemptId: attemptIdMatch[2] });
      }
    }
    return { cancel: false };
  },
  { urls: [`${CONFIG.OUTLIER_BASE_URL}/*`] }
);

function updateTabData(tabId, data) {
  // Initialize tab data if it doesn't exist
  if (!tabData[tabId]) {
    tabData[tabId] = {};
  }
  
  // Update tab data with new values
  Object.assign(tabData[tabId], data);

  // Save to history if we have an attemptId
  if (tabData[tabId].attemptId) {
    addToHistory(tabData[tabId]);
  }

  // Notify any open popup about the data update
  notifyUiOfDataChange(tabData[tabId]);
}

function notifyUiOfDataChange(data) {
  chrome.runtime.sendMessage({ 
    type: MESSAGE_TYPES.UPDATE_IDS, 
    ids: data 
  }).catch(() => {
    // Ignore errors from no listeners
  });
}

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
      if (history.length > CONFIG.MAX_HISTORY_ITEMS) {
        history = history.slice(0, CONFIG.MAX_HISTORY_ITEMS);
      }
      
      chrome.storage.local.set({ taskHistory: history });
    }
  });
}

// Handle messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const messageHandlers = {
    [MESSAGE_TYPES.GET_IDS]: handleGetIds,
    [MESSAGE_TYPES.GET_HISTORY]: handleGetHistory,
    [MESSAGE_TYPES.FORCE_CLAIM]: handleForceClaim
  };
  
  const handler = messageHandlers[message.type];
  if (handler) {
    return handler(message, sender, sendResponse);
  }
  
  return false;
});

function handleGetIds(message, sender, sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTabId = tabs[0]?.id;
    if (currentTabId && tabData[currentTabId]) {
      sendResponse({ ids: tabData[currentTabId] });
    } else {
      sendResponse({ ids: { attemptId: null } });
    }
  });
  return true; // async response
}

function handleGetHistory(message, sender, sendResponse) {
  chrome.storage.local.get(['taskHistory'], (result) => {
    const history = result.taskHistory || [];
    sendResponse({ history });
  });
  return true; // async response
}

function handleForceClaim(message, sender, sendResponse) {
  if (!message.attemptId) {
    sendResponse({status: "Error: Missing attemptId"});
    return false;
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTabId = tabs[0]?.id;
    if(currentTabId) {
      const newUrl = `${CONFIG.OUTLIER_BASE_URL}${CONFIG.OUTLIER_TASKS_PATH}?forceClaim=1&pipelineV3HumanNodeId=${message.attemptId}`;
      chrome.tabs.update(currentTabId, { url: newUrl });
      sendResponse({status: "Navigated to force claim"});
    } else {
      sendResponse({status: "Error: could not get current tab"});
    }
  });
  return true; // async response
}

// Clean up tab data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabData[tabId]) {
    delete tabData[tabId];
  }
});

// Clean up data when tab navigates away from Outlier tasks page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && tabData[tabId]) {
    const fullTasksPath = `${CONFIG.OUTLIER_BASE_URL}${CONFIG.OUTLIER_TASKS_PATH}`;
    if (!changeInfo.url.startsWith(fullTasksPath)) {
      delete tabData[tabId];
      notifyUiOfDataChange({ attemptId: null });
    }
  }
});