// Simple toast notification utility
// Place this file at src/utils/toast.js

// DOM container for toasts
let toastContainer = null;

// Create the toast container if it doesn't exist
const createToastContainer = () => {
  if (toastContainer) return toastContainer;
  
  toastContainer = document.createElement('div');
  toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none';
  document.body.appendChild(toastContainer);
  
  return toastContainer;
};

// Toast configuration
const TOAST_CONFIG = {
  duration: 4000, // Default duration in ms
  animationDuration: 300, // Animation duration in ms
  maxToasts: 5 // Maximum number of toasts visible at once
};

// Toast types with their corresponding styles
const TOAST_TYPES = {
  success: {
    className: 'bg-green-50 border-green-500 text-green-800',
    iconColor: 'text-green-500'
  },
  error: {
    className: 'bg-red-50 border-red-500 text-red-800',
    iconColor: 'text-red-500'
  },
  warning: {
    className: 'bg-amber-50 border-amber-500 text-amber-800',
    iconColor: 'text-amber-500'
  },
  info: {
    className: 'bg-blue-50 border-blue-500 text-blue-800',
    iconColor: 'text-blue-500'
  }
};

// Get icon based on toast type
const getIcon = (type) => {
  const iconClass = TOAST_TYPES[type]?.iconColor || 'text-gray-500';
  
  switch(type) {
    case 'success':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${iconClass}" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>`;
    case 'error':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${iconClass}" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>`;
    case 'warning':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${iconClass}" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>`;
    case 'info':
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${iconClass}" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>`;
  }
};

// Main toast function
export const toast = ({ 
  title = '', 
  description = '', 
  type = 'info', 
  duration = TOAST_CONFIG.duration
}) => {
  // Ensure toast container exists
  const container = createToastContainer();
  
  // Limit the number of toasts
  if (container.children.length >= TOAST_CONFIG.maxToasts) {
    // Remove the oldest toast
    if (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }
  
  // Create the toast element
  const toastEl = document.createElement('div');
  
  // Get appropriate styles for the toast type
  const toastStyle = TOAST_TYPES[type] || TOAST_TYPES.info;
  
  // Set toast classes
  toastEl.className = `${toastStyle.className} shadow-md rounded-lg p-4 mb-2 border-l-4 flex items-start transform translate-x-full opacity-0 transition-all duration-300 pointer-events-auto`;
  
  // Set toast content
  toastEl.innerHTML = `
    <div class="mr-3 mt-0.5">
      ${getIcon(type)}
    </div>
    <div class="flex-1">
      ${title ? `<div class="font-semibold">${title}</div>` : ''}
      ${description ? `<div class="text-sm">${description}</div>` : ''}
    </div>
    <button class="ml-auto -mr-1 text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200 focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
  `;
  
  // Add the toast to the container
  container.appendChild(toastEl);
  
  // Animate the toast in
  setTimeout(() => {
    toastEl.classList.remove('translate-x-full', 'opacity-0');
  }, 10);
  
  // Set up auto-dismiss
  const dismissTimeout = setTimeout(() => {
    dismissToast(toastEl);
  }, duration);
  
  // Set up click-to-dismiss on the close button
  const closeBtn = toastEl.querySelector('button');
  closeBtn.addEventListener('click', () => {
    clearTimeout(dismissTimeout);
    dismissToast(toastEl);
  });
  
  // Function to dismiss the toast with animation
  function dismissToast(toast) {
    toast.classList.add('opacity-0', 'translate-x-full');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, TOAST_CONFIG.animationDuration);
  }
};

// Convenience methods for different toast types
toast.success = (options) => toast({ ...options, type: 'success' });
toast.error = (options) => toast({ ...options, type: 'error' });
toast.warning = (options) => toast({ ...options, type: 'warning' });
toast.info = (options) => toast({ ...options, type: 'info' });

export default toast;