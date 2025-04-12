console.log("Outlier Helper Injector Script Running in Page Context");

const originalFetch = window.fetch;
const originalXHROpen = window.XMLHttpRequest.prototype.open;
const originalXHRSend = window.XMLHttpRequest.prototype.send;

const assignmentDetailsUrlRegex = /\/internal\/genai\/getAssignmentDetails\//;
const attemptIdUrlRegex = /[?&]attemptId=([^&]+)/;

// --- Fetch Interceptor ---
window.fetch = async function(...args) {
    const url = args[0] instanceof Request ? args[0].url : args[0];
    const method = args[0] instanceof Request ? args[0].method : (args[1]?.method || 'GET');

    // console.log(`Injector Fetch: ${method} ${url}`);

    // Check for Attempt ID in URL
    if (typeof url === 'string') {
        const attemptIdMatch = url.match(attemptIdUrlRegex);
        if (attemptIdMatch && attemptIdMatch[1]) {
            const attemptId = attemptIdMatch[1];
            console.log('Injector found Attempt ID via Fetch URL:', attemptId);
            window.postMessage({ type: "OUTLIER_ATTEMPT_ID", attemptId: attemptId }, "*");
        }
    }

    try {
        const response = await originalFetch.apply(this, args);

        // Check for Task ID in response
        if (typeof url === 'string' && assignmentDetailsUrlRegex.test(url) && response.ok) {
            // Clone the response to read its body without consuming it for the original request
            response.clone().json().then(data => {
                if (data && data.taskId) {
                    console.log('Injector found Task ID via Fetch Response:', data.taskId);
                    window.postMessage({ type: "OUTLIER_TASK_ID", taskId: data.taskId }, "*");
                } else {
                    console.log('Injector: getAssignmentDetails response did not contain taskId', data);
                }
            }).catch(err => {
                console.error('Injector: Error parsing getAssignmentDetails response:', err);
            });
        }

        return response;
    } catch (error) {
        console.error("Injector Fetch Error:", error);
        throw error; // Re-throw the error so the original call fails as expected
    }
};

// --- XMLHttpRequest Interceptor ---

// Store the URL passed to open
const xhrUrlMap = new WeakMap();

window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    // console.log(`Injector XHR Open: ${method} ${url}`);

    // Store the URL associated with this XHR instance
    if (typeof url === 'string') {
        xhrUrlMap.set(this, url);

        // Check for Attempt ID in URL
        const attemptIdMatch = url.match(attemptIdUrlRegex);
        if (attemptIdMatch && attemptIdMatch[1]) {
            const attemptId = attemptIdMatch[1];
            console.log('Injector found Attempt ID via XHR URL:', attemptId);
            window.postMessage({ type: "OUTLIER_ATTEMPT_ID", attemptId: attemptId }, "*");
        }
    }

    return originalXHROpen.apply(this, [method, url, ...rest]);
};

window.XMLHttpRequest.prototype.send = function(...args) {
    const xhr = this;
    const url = xhrUrlMap.get(xhr); // Retrieve the stored URL

    // Add event listener for when the request completes
    xhr.addEventListener('load', function() {
        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
            // console.log(`Injector XHR Load: ${url}`);
            // Check if this was the getAssignmentDetails request
            if (typeof url === 'string' && assignmentDetailsUrlRegex.test(url)) {
                try {
                    const responseData = JSON.parse(xhr.responseText);
                    if (responseData && responseData.taskId) {
                        console.log('Injector found Task ID via XHR Response:', responseData.taskId);
                        window.postMessage({ type: "OUTLIER_TASK_ID", taskId: responseData.taskId }, "*");
                    } else {
                        console.log('Injector: XHR getAssignmentDetails response did not contain taskId', responseData);
                    }
                } catch (err) {
                    console.error('Injector: Error parsing XHR getAssignmentDetails response:', err, xhr.responseText);
                }
            }
        }
    });

    // Add event listener for errors
    xhr.addEventListener('error', function() {
        console.error(`Injector XHR Error: ${url}`, xhr.status, xhr.statusText);
    });

    return originalXHRSend.apply(this, args);
};

console.log("Outlier Helper Injector Script Finished Setup"); 