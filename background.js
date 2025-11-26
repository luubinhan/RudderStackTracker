// Hardcoding the specific URL to capture
const TARGET_URL_PATTERN = "*://mailgun-dataplane.rudderstack.com/v1/track*"; 

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method === "POST" && details.requestBody) {
      
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
      chrome.storage.local.get(['allTracks'], (result) => {
        const allTracks = result.allTracks || [];
        allTracks.unshift(trackEntry); // Add to beginning
        
        // Keep only last 50 tracks
        if (allTracks.length > 50) {
          allTracks.pop();
        }
        
        chrome.storage.local.set({ allTracks: allTracks });

        // Update badge with count
        chrome.action.setBadgeText({ text: allTracks.length.toString() });
        chrome.action.setBadgeBackgroundColor({ color: "#2ecc71" });
      });
    }
  },
  // Filters: Now uses the hardcoded pattern
  { urls: [TARGET_URL_PATTERN] },
  ["requestBody", "extraHeaders"]
);