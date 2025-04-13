document.addEventListener('DOMContentLoaded', () => {

  const attemptIdElement = document.getElementById('attemptId');
  const forceClaimBtn = document.getElementById('forceClaimBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const errorContainer = document.getElementById('error-container');
  const errorMessageElement = document.getElementById('error-message');
  const historyToggle = document.getElementById('historyToggle');
  const historyDropdown = document.getElementById('historyDropdown');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');

  let currentAttemptId = null;

  function showError(message) {
    attemptIdElement.textContent = 'N/A';
    errorMessageElement.textContent = message;
    errorContainer.style.display = 'block';
    forceClaimBtn.disabled = true;
  }

  function updatePopup(data) {
    errorContainer.style.display = 'none';
    
    if (data.attemptId) {
      currentAttemptId = data.attemptId;
      attemptIdElement.textContent = data.attemptId;
      forceClaimBtn.disabled = false;
    } else {
      attemptIdElement.textContent = 'Not found';
      forceClaimBtn.disabled = true;
      showError('No attempt ID found yet. Interact with the page or refresh.');
    }
  }

  // Initialize popup
  chrome.runtime.sendMessage({ type: 'GET_IDS' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ids) {
      showError('No task data found yet. Interact with the page or refresh.');
      return;
    }
    updatePopup(response.ids);
  });
  
  loadTaskHistory();

  // Setup event handlers
  forceClaimBtn.addEventListener('click', () => {
    if (currentAttemptId) {
      chrome.runtime.sendMessage({ 
        type: 'FORCE_CLAIM', 
        attemptId: currentAttemptId 
      }, () => window.close());
    }
  });

  reloadBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
        window.close();
      }
    });
  });

  // Toggle history dropdown
  historyToggle.addEventListener('click', () => {
    const isVisible = historyDropdown.style.display !== 'none';
    historyDropdown.style.display = isVisible ? 'none' : 'block';
    historyToggle.querySelector('.history-toggle-icon').innerHTML = isVisible ? '&darr;' : '&uarr;';
  });
  
  function loadTaskHistory() {
    chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (response) => {
      if (chrome.runtime.lastError) return;
      updateHistoryDisplay(response.history || []);
    });
  }
  
  function updateHistoryDisplay(history) {
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      historyEmpty.style.display = 'block';
      return;
    }
    
    historyEmpty.style.display = 'none';
    
    // Keep only the most recent entry for each attemptId
    const uniqueAttemptIds = new Set();
    const filteredHistory = history.filter(item => {
      if (uniqueAttemptIds.has(item.attemptId)) return false;
      uniqueAttemptIds.add(item.attemptId);
      return true;
    });
    
    filteredHistory.forEach(item => {
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
      
      historyList.appendChild(listItem);
      
      listItem.querySelector('.history-claim-btn').addEventListener('click', (e) => {
        const attemptId = e.target.getAttribute('data-attempt-id');
        chrome.runtime.sendMessage({ type: 'FORCE_CLAIM', attemptId }, () => window.close());
      });
    });
  }

  // Listen for background updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE_IDS') {
      updatePopup(message.ids);
      loadTaskHistory();
    }
  });
}); 