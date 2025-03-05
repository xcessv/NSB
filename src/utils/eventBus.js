/**
 * Simple event bus implementation for cross-component communication
 * This allows components to subscribe to and emit events without direct coupling
 */

export const createEventBus = () => {
  const listeners = {};
  
  return {
    /**
     * Subscribe to an event
     * @param {string} event - Event name to listen for
     * @param {function} callback - Function to execute when event is emitted
     * @returns {function} Unsubscribe function
     */
    on: (event, callback) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
      
      // Return unsubscribe function
      return () => {
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      };
    },
    
    /**
     * Emit an event with optional data
     * @param {string} event - Event name to emit
     * @param {any} data - Data to pass to subscribers
     */
    emit: (event, data) => {
      if (listeners[event]) {
        listeners[event].forEach(callback => callback(data));
      }
    },
    
    /**
     * Clear all listeners for a specific event
     * @param {string} event - Event name to clear listeners for
     */
    clear: (event) => {
      if (listeners[event]) {
        listeners[event] = [];
      }
    },
    
    /**
     * Get count of listeners for an event
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    count: (event) => {
      return listeners[event]?.length || 0;
    }
  };
};

// Create a singleton instance of the event bus
// This ensures we have exactly one event bus for the whole application
let singletonEventBus;

// Initialize the event bus if it doesn't exist yet
if (typeof window !== 'undefined') {
  if (window.eventBus) {
    // If already initialized elsewhere, use that instance
    singletonEventBus = window.eventBus;
    console.log('Using existing window.eventBus');
  } else {
    // Otherwise create a new one
    singletonEventBus = createEventBus();
    window.eventBus = singletonEventBus;
    console.log('Created new eventBus in eventBus.js');
  }
} else {
  // Fallback for non-browser environments
  singletonEventBus = createEventBus();
}

// Export the global instance for convenience
export const eventBus = singletonEventBus;

// Common event names as constants for consistency
export const EVENT_TYPES = {
  COMMENT_UPDATED: 'comment-updated',
  REVIEW_UPDATED: 'review-updated',
  COMMENTS_UPDATED: 'comments-updated',
  COMMENT_ADDED: 'comment-added',
  COMMENT_DELETED: 'comment-deleted',
  SCREEN_CHANGED: 'screen-changed',
  ACTIVITIES_REFRESHED: 'activities-refreshed',
  NEWS_UPDATED: 'news-updated',
  USER_UPDATED: 'user-updated'
};