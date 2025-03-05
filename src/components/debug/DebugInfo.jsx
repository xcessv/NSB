import React, { useState, useEffect } from 'react';

const DebugInfo = ({ currentScreen }) => {
  const [info, setInfo] = useState({
    apiUrl: 'Checking...',
    localStorage: 'Checking...',
    sessionStorage: 'Checking...',
    connectionStatus: 'Checking...',
    userAgent: navigator.userAgent
  });
  
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    const checkAPIConnection = async () => {
      try {
        // Try to get API URL from config (assuming it's imported)
        const apiUrl = window.config?.API_URL || 'API URL not found';
        
        // Check network connection
        const online = navigator.onLine ? 'Online' : 'Offline';
        
        // Check localStorage
        let localStorageStatus = 'Working';
        try {
          localStorage.setItem('test', 'test');
          localStorage.removeItem('test');
        } catch (e) {
          localStorageStatus = `Error: ${e.message}`;
        }
        
        // Check sessionStorage
        let sessionStorageStatus = 'Working';
        try {
          sessionStorage.setItem('test', 'test');
          sessionStorage.removeItem('test');
        } catch (e) {
          sessionStorageStatus = `Error: ${e.message}`;
        }
        
        setInfo({
          apiUrl,
          localStorage: localStorageStatus,
          sessionStorage: sessionStorageStatus,
          connectionStatus: online,
          userAgent: navigator.userAgent
        });
      } catch (error) {
        console.error('Error in debug component:', error);
        setInfo(prev => ({
          ...prev,
          error: error.message
        }));
      }
    };
    
    checkAPIConnection();
  }, []);
  
  const toggleExpand = () => setIsExpanded(!isExpanded);
  
  return (
    <div className="fixed bottom-20 right-0 bg-gray-800 text-white text-xs p-2 rounded-l-md z-50 max-w-xs" 
         style={{ opacity: 0.8 }}>
      <div className="flex justify-between items-center">
        <div className="font-bold">Debug Info</div>
        <button onClick={toggleExpand} className="ml-2">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="mt-2 space-y-1">
          <div>Screen: <span className="font-mono">{currentScreen}</span></div>
          <div>API URL: <span className="font-mono">{info.apiUrl}</span></div>
          <div>Connection: <span className="font-mono">{info.connectionStatus}</span></div>
          <div>localStorage: <span className="font-mono">{info.localStorage}</span></div>
          <div>sessionStorage: <span className="font-mono">{info.sessionStorage}</span></div>
          <div className="text-xxxs truncate" style={{ fontSize: '8px' }}>
            {info.userAgent}
          </div>
          {info.error && (
            <div className="text-red-400">Error: {info.error}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DebugInfo;