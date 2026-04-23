console.log('RudderStackTracker: background.js loaded');

// Hardcoding the specific URL to capture
const TARGET_URL_PATTERN = "*://*.rudderstack.com/v1/track*";

console.log('RudderStackTracker: Registering webRequest listener for:', TARGET_URL_PATTERN);

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    console.log('RudderStackTracker: Request captured:', details.url);
    if (details.method === "POST" && details.requestBody) {
      console.log('RudderStackTracker: POST request with body detected');
      
      let finalPayload = "No parsable data found.";

      let payloadObj = null;
      
      // 1. Handle JSON/Raw Data
      if (details.requestBody.raw) {
        try {
          const decoder = new TextDecoder("utf-8");
          const rawData = details.requestBody.raw[0].bytes;
          const decodedString = decoder.decode(rawData);
          
          try {
            payloadObj = JSON.parse(decodedString);
            finalPayload = JSON.stringify(payloadObj, null, 2);
          } catch {
            finalPayload = decodedString;
          }
        } catch (e) {
          finalPayload = "Error decoding raw bytes.";
        }
      } 
      // 2. Handle Form Data
      else if (details.requestBody.formData) {
        finalPayload = JSON.stringify(details.requestBody.formData, null, 2);
      }

      // Extract event name from payload
      let eventName = "Unknown Event";
      if (payloadObj && payloadObj.properties && payloadObj.properties.event && payloadObj.properties.event.name) {
        eventName = payloadObj.properties.event.name;
      }

      // Create track entry
      const trackEntry = {
        id: Date.now(),
        eventName: eventName,
        timestamp: new Date().toLocaleTimeString(),
        payload: finalPayload
      };

      // Get existing tracks and add new one
      console.log('RudderStackTracker: Storing track entry:', eventName);
      chrome.storage.local.get(['allTracks'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('RudderStackTracker: Error getting storage:', chrome.runtime.lastError);
          return;
        }
        const allTracks = result.allTracks || [];
        allTracks.unshift(trackEntry); // Add to beginning
        
        // Keep only last 50 tracks
        if (allTracks.length > 50) {
          allTracks.pop();
        }
        
        chrome.storage.local.set({ allTracks: allTracks }, () => {
          if (chrome.runtime.lastError) {
            console.error('RudderStackTracker: Error setting storage:', chrome.runtime.lastError);
            return;
          }
          console.log('RudderStackTracker: Track stored successfully, total:', allTracks.length);
        });

        // Update badge with count
        chrome.action.setBadgeText({ text: allTracks.length.toString() });
        chrome.action.setBadgeBackgroundColor({ color: "#2ecc71" });
        console.log('RudderStackTracker: Badge updated:', allTracks.length);
      });
    }
  },
  // Filters: Now uses the hardcoded pattern
  { urls: [TARGET_URL_PATTERN] },
  ["requestBody", "extraHeaders"]
);