import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown } from 'lucide-react';

/**
 * PullToRefresh Component
 * 
 * A component that adds pull-to-refresh functionality to its children.
 * 
 * @param {Object} props
 * @param {Function} props.onRefresh - Function to call when refresh is triggered
 * @param {boolean} props.isRefreshing - Whether a refresh is currently in progress
 * @param {number} props.pullDownThreshold - Distance in pixels user needs to pull down to trigger refresh
 * @param {number} props.maxPullDownDistance - Maximum pull down distance
 * @param {React.ReactNode} props.children - Content to be wrapped with pull-to-refresh
 * @param {string} props.refreshIndicatorClassName - Class name for refresh indicator
 */
const PullToRefresh = ({
  onRefresh,
  isRefreshing,
  pullDownThreshold = 80,
  maxPullDownDistance = 120,
  children,
  refreshIndicatorClassName = ''
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const lastTouchRef = useRef(0);
  const isAtTopRef = useRef(false);
  
  // Check if scroll is at top
  const checkIfAtTop = () => {
    if (!containerRef.current) return false;
    return window.scrollY <= 5; // Consider top if within 5px of top
  };

  // Touch start handler
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    isAtTopRef.current = checkIfAtTop();
    setIsActive(true);
  };

  // Touch move handler
  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    lastTouchRef.current = touch.clientY;
    
    if (!isAtTopRef.current) return;
    
    const deltaY = touch.clientY - startYRef.current;
    
    // Only activate pull-down if we're scrolled to the top and pulling down
    if (deltaY > 0) {
      // Apply resistance to make it feel more natural
      const newPullDistance = Math.min(maxPullDownDistance, deltaY * 0.5);
      setPullDistance(newPullDistance);
      
      // Prevent default scrolling behavior if we're pulling
      if (newPullDistance > 10) {
        e.preventDefault();
      }
    }
  };

  // Touch end handler
  const handleTouchEnd = () => {
    if (pullDistance > pullDownThreshold && !isRefreshing) {
      // If we've pulled far enough, trigger refresh
      onRefresh();
    }
    
    // Reset to initial state with animation
    setPullDistance(0);
    setIsActive(false);
  };

  // Handle scrolling to determine if we're at the top
  useEffect(() => {
    const handleScroll = () => {
      isAtTopRef.current = checkIfAtTop();
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Calculate refresh progress percentage
  const progressPercentage = Math.min(100, (pullDistance / pullDownThreshold) * 100);
  
  // Calculate refresh indicator opacity based on pull distance
  const indicatorOpacity = Math.min(1, pullDistance / (pullDownThreshold * 0.8));
  
  // Calculate rotation angle for arrow icon
  const arrowRotation = Math.min(180, (pullDistance / pullDownThreshold) * 180);

  return (
    <div
      ref={containerRef}
      className="pull-to-refresh-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative' }}
    >
      {/* Pull indicator */}
      <div
        className="pull-indicator flex items-center justify-center"
        style={{
          height: `${pullDistance}px`,
          opacity: indicatorOpacity,
          overflow: 'hidden',
          transition: isActive ? 'none' : 'height 0.2s ease-out',
          marginBottom: pullDistance > 0 ? '8px' : '0'
        }}
      >
        <div 
          className={`refresh-indicator-content ${refreshIndicatorClassName}`} 
          style={{ 
            transform: `translateY(${(pullDistance - 40) < 0 ? (pullDistance - 40) : 0}px)`
          }}
        >
          {isRefreshing ? (
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          ) : (
            <ArrowDown 
              className="h-6 w-6 transition-transform" 
              style={{ 
                transform: `rotate(${arrowRotation}deg)`,
                color: progressPercentage >= 100 ? 'var(--color-primary)' : 'currentColor'
              }} 
            />
          )}
          <span className="ml-2 text-sm">
            {isRefreshing 
              ? 'Refreshing...' 
              : progressPercentage >= 100 
                ? 'Release to refresh' 
                : 'Pull to refresh'}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="pull-to-refresh-content">
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;