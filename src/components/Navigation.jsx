import React from 'react';
import { 
  Clock, 
  Star, 
  MapPin, 
  Newspaper,
  Settings
} from 'lucide-react';

const Navigation = ({ currentScreen, onScreenChange, currentUser }) => {
  const navItems = [
    { id: 'recents', icon: Clock, label: 'Recent' },
    { id: 'top', icon: Star, label: 'Top' },
    { id: 'map', icon: MapPin, label: 'Map' },
    { id: 'news', icon: Newspaper, label: 'News' }
  ];

  if (currentUser?.role === 'admin') {
    navItems.push({ id: 'admin', icon: Settings, label: 'Admin' });
  }

  const handleScreenChange = (id) => {
    // Only trigger the change if it's a different screen
    if (currentScreen !== id) {
      console.log(`Navigation: changing from ${currentScreen} to ${id}`);
      
      try {
        // Reset scroll position for better UX
        window.scrollTo(0, 0);
        
        // Wrap the screen change in a try-catch to handle potential errors
        try {
          onScreenChange(id);
          console.log(`Navigation: change to ${id} completed`);
        } catch (error) {
          console.error('Error in onScreenChange:', error);
          // Don't throw from here to prevent UI from breaking
        }
      } catch (error) {
        console.error('Error during screen change:', error);
        // Prevent app freezing by showing a message and reloading if needed
        setTimeout(() => {
          if (confirm('An error occurred while navigating. Would you like to reload the app?')) {
            window.location.reload();
          }
        }, 500);
      }
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-border z-50">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex justify-between items-center py-2">
          {navItems.map(({ id, icon: Icon, label }) => (
            <div key={id} className="flex flex-col items-center">
              <div 
                onClick={() => handleScreenChange(id)}
                className={`w-14 h-14 mb-1 rounded-full flex items-center justify-center cursor-pointer ${
                  currentScreen === id ? 'bg-[#333333]' : ''
                }`}
              >
                <Icon 
                  className={`w-7 h-7 ${
                    currentScreen === id ? 'text-[#8b0000]' : 'text-gray-500'
                  }`}
                />
              </div>
              <span className={
                currentScreen === id ? 'text-white text-xs' : 'text-gray-500 text-xs'
              }>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Navigation;