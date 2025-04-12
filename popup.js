// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const taskIdElement = document.getElementById('taskId');
  const attemptIdElement = document.getElementById('attemptId');
  const forceClaimBtn = document.getElementById('forceClaimBtn');
  const increaseTimerBtn = document.getElementById('increaseTimerBtn');
  const errorMessageElement = document.getElementById('error-message');

  let currentTaskId = null;
  let currentAttemptId = null;

  function showError(message) {
    taskIdElement.textContent = 'N/A';
    attemptIdElement.textContent = 'N/A';
    errorMessageElement.textContent = message;
    errorMessageElement.style.display = 'block';
    forceClaimBtn.disabled = true;
    increaseTimerBtn.disabled = true;
  }

  function updatePopup(data) {
    errorMessageElement.style.display = 'none'; // Hide error if data is found
    if (data.taskId) {
      currentTaskId = data.taskId;
      taskIdElement.textContent = data.taskId;
      forceClaimBtn.disabled = false;
    } else {
      taskIdElement.textContent = 'Not found';
      forceClaimBtn.disabled = true;
    }

    if (data.attemptId) {
      currentAttemptId = data.attemptId;
      attemptIdElement.textContent = data.attemptId;
      increaseTimerBtn.disabled = false;
    } else {
      attemptIdElement.textContent = 'Not found';
      increaseTimerBtn.disabled = true;
    }

    if (!data.taskId && !data.attemptId) {
      showError('Could not find Task or Attempt ID. Please refresh the page or navigate to a task.');
    }
  }

  // Request the IDs from the background script when the popup opens
  chrome.runtime.sendMessage({ type: 'GET_IDS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      showError('Error communicating with background script.');
      return;
    }
    if (response && response.ids) {
      console.log('Received IDs from background:', response.ids);
      updatePopup(response.ids);
    } else {
        console.log('No IDs received from background yet.');
        showError('No task data found yet. Interact with the page or refresh.');
    }
  });

  forceClaimBtn.addEventListener('click', () => {
    if (currentTaskId) {
      chrome.runtime.sendMessage({ type: 'FORCE_CLAIM', taskId: currentTaskId }, (response) => {
         if (chrome.runtime.lastError) {
             console.error("Error sending FORCE_CLAIM message:", chrome.runtime.lastError);
         }
         window.close(); // Close popup after action
      });
    } else {
        console.error("Force Claim clicked but no Task ID available.");
    }
  });

  increaseTimerBtn.addEventListener('click', () => {
    if (currentAttemptId) {
      chrome.runtime.sendMessage({ type: 'INCREASE_TIMER', attemptId: currentAttemptId }, (response) => {
         if (chrome.runtime.lastError) {
             console.error("Error sending INCREASE_TIMER message:", chrome.runtime.lastError);
         }
          window.close(); // Close popup after action
      });
    } else {
        console.error("Increase Timer clicked but no Attempt ID available.");
    }
  });

  // Optional: Listen for updates from the background script while popup is open
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_IDS') {
      console.log('Popup received ID update:', message.ids);
      updatePopup(message.ids);
    }
  });
}); 