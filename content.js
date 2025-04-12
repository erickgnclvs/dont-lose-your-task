// content.js

console.log("Outlier Helper Content Script Loaded");

// Inject the interceptor script into the main page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injector.js');
(document.head || document.documentElement).appendChild(script);

script.onload = () => {
    console.log("Interceptor script injected.");
    // Optional: Remove the script tag after injection
    // script.remove();
};

// Listen for messages from the injected script (via window.postMessage)
window.addEventListener("message", (event) => {
    // We only accept messages from ourselves
    if (event.source !== window || !event.data || !event.data.type) {
        return;
    }

    // console.log("Content script received message from injector:", event.data);

    if (event.data.type === "OUTLIER_TASK_ID") {
        console.log("Content script received Task ID:", event.data.taskId);
        chrome.runtime.sendMessage({ type: 'FOUND_TASK_ID', taskId: event.data.taskId }, (response) => {
             if (chrome.runtime.lastError) {
                console.error("Error sending Task ID to background:", chrome.runtime.lastError);
            } else {
                // console.log("Task ID sent to background:", response);
            }
        });
    }

    if (event.data.type === "OUTLIER_ATTEMPT_ID") {
        console.log("Content script received Attempt ID:", event.data.attemptId);
        chrome.runtime.sendMessage({ type: 'FOUND_ATTEMPT_ID', attemptId: event.data.attemptId }, (response) => {
             if (chrome.runtime.lastError) {
                console.error("Error sending Attempt ID to background:", chrome.runtime.lastError);
            } else {
                // console.log("Attempt ID sent to background:", response);
            }
        });
    }
}, false);

console.log("Outlier Helper Content Script Initialized Communication Bridge");

// ---- Keepalive for Service Worker ----
// If the content script is active, it implies the user is on the target page.
// We can send periodic messages to keep the background service worker alive
// if needed, especially if network events are infrequent.

let keepAliveInterval;

function startKeepAlive() {
    stopKeepAlive(); // Ensure no duplicates
    console.log("Starting SW keepalive ping from content script");
    keepAliveInterval = setInterval(() => {
        chrome.runtime.sendMessage({ type: 'KEEP_ALIVE' }).catch(err => {
            // If the SW is inactive, this might error, which is fine.
            // It might wake up or stay awake from other events.
            // console.warn("Keep alive ping failed (might be expected):", err);
            stopKeepAlive(); // Stop pinging if context is invalidated
        });
    }, 20000); // Send a ping every 20 seconds
}

function stopKeepAlive() {
    if (keepAliveInterval) {
        console.log("Stopping SW keepalive ping from content script");
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

// Start keepalive when the script loads
startKeepAlive();

// Stop keepalive when the page is unloaded
window.addEventListener('unload', stopKeepAlive); 