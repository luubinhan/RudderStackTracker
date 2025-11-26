document.addEventListener('DOMContentLoaded', () => {
  const tracksContainer = document.getElementById('tracksContainer');
  const clearBtn = document.getElementById('clearBtn');

  // Syntax highlight JSON
  function syntaxHighlightJson(jsonString) {
    try {
      const obj = JSON.parse(jsonString);
      const json = JSON.stringify(obj, null, 2);
      
      return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      });
    } catch (e) {
      return jsonString;
    }
  }

  // Load all tracks from storage
  function loadTracks() {
    chrome.storage.local.get(['allTracks'], (result) => {
      const allTracks = result.allTracks || [];
      
      if (allTracks.length === 0) {
        tracksContainer.innerHTML = '<p class="empty-state">No tracks captured yet.</p>';
        return;
      }

      // Clear the badge
      chrome.action.setBadgeText({ text: "" });

      // Build accordion HTML
      tracksContainer.innerHTML = '';
      allTracks.forEach((track, index) => {
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';
        
        const header = document.createElement('div');
        header.className = 'accordion-header';
        header.innerHTML = `
          <span class="event-name">${track.eventName}</span>
          <span class="timestamp">${track.timestamp}</span>
        `;
        
        const content = document.createElement('div');
        content.className = 'accordion-content';
        
        // Syntax highlight the JSON
        const highlightedJson = syntaxHighlightJson(track.payload);
        
        content.innerHTML = `
          <pre class="payload-content">${highlightedJson}</pre>
          <button class="copy-btn" data-index="${index}">Copy</button>
        `;
        
        // Toggle accordion on header click
        header.addEventListener('click', () => {
          accordionItem.classList.toggle('active');
        });
        
        accordionItem.appendChild(header);
        accordionItem.appendChild(content);
        tracksContainer.appendChild(accordionItem);
      });

      // Add copy button listeners
      document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          const payload = allTracks[index].payload;
          
          navigator.clipboard.writeText(payload).then(() => {
            const originalText = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => btn.textContent = originalText, 1500);
          });
        });
      });
    });
  }

  // Clear all tracks
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.set({ allTracks: [] }, () => {
      loadTracks();
    });
  });

  // Initial load
  loadTracks();
});