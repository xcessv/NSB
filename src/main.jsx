import { createEventBus } from './utils/eventBus.js'

// Function to detect page reloads vs navigation
const setupPageReloadDetection = () => {
  // Set a timestamp when the page first loads
  const timestamp = Date.now();
  
  // Store in sessionStorage to detect reloads
  sessionStorage.setItem('pageLoadTimestamp', timestamp.toString());
  sessionStorage.setItem('justReloaded', 'true');
  
  // Set a flag in localStorage to communicate with other tabs
  try {
    const reloadEvents = JSON.parse(localStorage.getItem('pageReloadEvents') || '[]');
    reloadEvents.push({
      timestamp,
      url: window.location.href
    });
    
    // Keep only the last 5 events
    if (reloadEvents.length > 5) {
      reloadEvents.shift();
    }
    
    localStorage.setItem('pageReloadEvents', JSON.stringify(reloadEvents));
  } catch (e) {
    console.warn('Failed to track page reload:', e);
  }
  
  // Add beforeunload event to distinguish between tab closes and reloads
  window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('pageUnloading', 'true');
  });
  
  // Use the existing eventBus if it exists, otherwise create it
  if (!window.eventBus) {
    console.log('Creating event bus from main.jsx');
    window.eventBus = createEventBus();
  }
};

// Run this when the script loads
setupPageReloadDetection();

// Add a function to clear cache on hard reload
// This works with Chrome's "Hard Reload" option
if (window.performance && window.performance.navigation) {
  if (window.performance.navigation.type === 1) {
    // This is a page reload (type 1)
    console.log('Page reload detected, clearing caches');
    
    // Clear stale caches
    const staleCaches = [
      'activities-all-1',  // Main feed activities
      'reviews-all'        // Main reviews list
    ];
    
    staleCaches.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore errors
      }
    });
  }
}

// Now import React components
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './global.css'  // Import global.css first
import './index.css'   // Then import index.css
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)