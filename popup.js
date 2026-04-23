console.log('RudderStackTracker: popup.js loaded');

let allTracksCache = [];

document.addEventListener('DOMContentLoaded', () => {
  console.log('RudderStackTracker: DOMContentLoaded event fired');
  const tracksContainer = document.getElementById('tracksContainer');
  const clearBtn = document.getElementById('clearBtn');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  
  console.log('RudderStackTracker: Elements found', { 
    tracksContainer: !!tracksContainer, 
    clearBtn: !!clearBtn,
    searchInput: !!searchInput,
    clearSearchBtn: !!clearSearchBtn
  });

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
  function loadTracks(filterText = '') {
    console.log('RudderStackTracker: Loading tracks...', { filterText });
    try {
      chrome.storage.local.get(['allTracks'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('RudderStackTracker: Error getting storage:', chrome.runtime.lastError);
          return;
        }
        const allTracks = result.allTracks || [];
        allTracksCache = allTracks;
        console.log('RudderStackTracker: Tracks loaded', { count: allTracks.length });
        
        // Filter out shell_page_loaded events and apply search filter
        const filteredTracks = allTracks
          // .filter(track => track.eventName !== 'shell_page_loaded')
          .filter(track => 
            filterText 
              ? track.eventName.toLowerCase().includes(filterText.toLowerCase())
              : true
          );
        
        
        console.log('RudderStackTracker: Tracks after filter', { count: filteredTracks.length });

        if (filteredTracks.length === 0) {
          console.log('RudderStackTracker: No tracks to display');
          if (filterText) {
            tracksContainer.innerHTML = '<p class="empty-state">No tracks match your search.</p>';
          } else {
            tracksContainer.innerHTML = '<p class="empty-state">No tracks captured yet.</p>';
          }
          return;
        }      // Clear the badge
      chrome.action.setBadgeText({ text: "" });

        // Build accordion HTML
        console.log('RudderStackTracker: Rendering tracks');
        tracksContainer.innerHTML = '';
        filteredTracks.forEach((track, index) => {
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
        console.log('RudderStackTracker: Tracks rendered successfully');

        // Add copy button listeners
        document.querySelectorAll('.copy-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            const payload = filteredTracks[index].payload;
            
            navigator.clipboard.writeText(payload).then(() => {
              console.log('RudderStackTracker: Payload copied to clipboard');
              const originalText = btn.textContent;
              btn.textContent = "Copied!";
              setTimeout(() => btn.textContent = originalText, 1500);
            }).catch(err => {
              console.error('RudderStackTracker: Error copying to clipboard:', err);
            });
          });
        });
      });
    } catch (error) {
      console.error('RudderStackTracker: Error in loadTracks:', error);
      tracksContainer.innerHTML = '<p class="empty-state">Error loading tracks. Check console.</p>';
    }
  }

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const searchText = e.target.value;
    console.log('RudderStackTracker: Search input changed:', searchText);
    
    if (searchText) {
      clearSearchBtn.classList.add('visible');
    } else {
      clearSearchBtn.classList.remove('visible');
    }
    
    loadTracks(searchText);
  });
  
  // Clear search
  clearSearchBtn.addEventListener('click', () => {
    console.log('RudderStackTracker: Clear search button clicked');
    searchInput.value = '';
    clearSearchBtn.classList.remove('visible');
    loadTracks();
  });
  
  // Clear all tracks
  clearBtn.addEventListener('click', () => {
    console.log('RudderStackTracker: Clear button clicked');
    chrome.storage.local.set({ allTracks: [] }, () => {
      if (chrome.runtime.lastError) {
        console.error('RudderStackTracker: Error clearing storage:', chrome.runtime.lastError);
        return;
      }
      console.log('RudderStackTracker: Storage cleared');
      searchInput.value = '';
      clearSearchBtn.classList.remove('visible');
      loadTracks();
    });
  });

  // Initial load
  console.log('RudderStackTracker: Starting initial load');
  loadTracks();
});

// Error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('RudderStackTracker: Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('RudderStackTracker: Unhandled promise rejection:', event.reason);
});