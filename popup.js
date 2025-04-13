document.addEventListener('DOMContentLoaded', () => {

  const MESSAGE_TYPES = {
    GET_IDS: 'GET_IDS',
    GET_HISTORY: 'GET_HISTORY',
    FORCE_CLAIM: 'FORCE_CLAIM',
    UPDATE_IDS: 'UPDATE_IDS'
  };

  const ERROR_MESSAGES = {
    NO_TASK_DATA: 'No task data found yet. Interact with the page or refresh.',
    NO_ATTEMPT_ID: 'No attempt ID found yet. Interact with the page or refresh.'
  };

  const elements = {
    attemptId: document.getElementById('attemptId'),
    buttons: {
      forceClaim: document.getElementById('forceClaimBtn'),
      reload: document.getElementById('reloadBtn')
    },
    error: {
      container: document.getElementById('error-container'),
      message: document.getElementById('error-message')
    },
    history: {
      toggle: document.getElementById('historyToggle'),
      dropdown: document.getElementById('historyDropdown'),
      list: document.getElementById('historyList'),
      empty: document.getElementById('historyEmpty')
    }
  };

  // App state
  let currentAttemptId = null;

  function showError(message) {
    elements.attemptId.textContent = 'N/A';
    elements.error.message.textContent = message;
    elements.error.container.style.display = 'block';
    elements.buttons.forceClaim.disabled = true;
  }

  function updatePopup(data) {
    elements.error.container.style.display = 'none';
    
    if (data.attemptId) {
      currentAttemptId = data.attemptId;
      elements.attemptId.textContent = data.attemptId;
      elements.buttons.forceClaim.disabled = false;
    } else {
      elements.attemptId.textContent = 'Not found';
      elements.buttons.forceClaim.disabled = true;
      showError(ERROR_MESSAGES.NO_ATTEMPT_ID);
    }
  }

  function loadTaskHistory() {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_HISTORY }, (response) => {
      if (chrome.runtime.lastError) return;
      updateHistoryDisplay(response.history || []);
    });
  }
  
  function updateHistoryDisplay(history) {
    const historyList = elements.history.list;
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      elements.history.empty.style.display = 'block';
      return;
    }
    
    elements.history.empty.style.display = 'none';
    
    const uniqueHistory = filterToUniqueAttemptIds(history);
    
    uniqueHistory.forEach(createAndAppendHistoryItem);
  }

  function filterToUniqueAttemptIds(history) {
    const uniqueAttemptIds = new Set();
    return history.filter(item => {
      if (uniqueAttemptIds.has(item.attemptId)) return false;
      uniqueAttemptIds.add(item.attemptId);
      return true;
    });
  }

  function createAndAppendHistoryItem(item) {
    const timestamp = new Date(item.timestamp);
    const formattedDate = timestamp.toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    
    const listItem = document.createElement('li');
    listItem.className = 'history-item';
    listItem.innerHTML = `
      <div class="history-time">${formattedDate}</div>
      <div class="history-item-row">
        <div class="history-ids">
          <span class="history-id-value">${item.attemptId}</span>
        </div>
        <div class="history-actions">
          <button class="history-claim-btn" data-attempt-id="${item.attemptId}">Claim</button>
        </div>
      </div>
    `;
    
    elements.history.list.appendChild(listItem);
    
    // Add click handler to claim button
    listItem.querySelector('.history-claim-btn').addEventListener('click', (e) => {
      const attemptId = e.target.getAttribute('data-attempt-id');
      chrome.runtime.sendMessage({ 
        type: MESSAGE_TYPES.FORCE_CLAIM, 
        attemptId 
      }, () => window.close());
    });
  }

  function setupEventListeners() {
    // Force Claim button
    elements.buttons.forceClaim.addEventListener('click', () => {
      if (currentAttemptId) {
        chrome.runtime.sendMessage({ 
          type: MESSAGE_TYPES.FORCE_CLAIM, 
          attemptId: currentAttemptId 
        }, () => window.close());
      }
    });

    // Reload button
    elements.buttons.reload.addEventListener('click', () => {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.reload(tabs[0].id);
          window.close();
        }
      });
    });

    // History toggle
    elements.history.toggle.addEventListener('click', () => {
      const isVisible = elements.history.dropdown.style.display !== 'none';
      elements.history.dropdown.style.display = isVisible ? 'none' : 'block';
      elements.history.toggle.querySelector('.history-toggle-icon').innerHTML = 
        isVisible ? '&darr;' : '&uarr;';
    });

    // Listen for background updates
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === MESSAGE_TYPES.UPDATE_IDS) {
        updatePopup(message.ids);
        loadTaskHistory();
      }
    });
  }

  function initialize() {
    setupEventListeners();
    
    // Load initial data
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_IDS }, (response) => {
      if (chrome.runtime.lastError || !response || !response.ids) {
        showError(ERROR_MESSAGES.NO_TASK_DATA);
        return;
      }
      updatePopup(response.ids);
    });
    
    loadTaskHistory();
  }

  initialize();
}); 