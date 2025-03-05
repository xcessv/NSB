import React, { useState, useEffect, useRef } from 'react';
import { 
  Users,
  FileText,
  AlertTriangle,
  Settings,
  Newspaper,
  Search,
  Star,
  ThumbsUp,
  MessageCircle,
  Loader,
  MapPin,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  PieChart,
  Utensils
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import NewsManagement from './NewsManagement';
import UserManagement from './UserManagement';
import ReviewManagement from './ReviewManagement';
import PointsOfInterestManagement from './PointsOfInterestManagement';
import BeeferyManagement from './BeeferyManagement';
import PollManagement from './PollManagement';
import BeeferyAnalytics from './BeeferyAnalytics';
import config from '../../config';
import AdminActivityFeed from './AdminActivityFeed';
import ReportManagement from './ReportManagement';

// Stat Card Component
const StatCard = ({ label, value, icon: Icon, trend }) => (
  <Card className="hover:shadow-md transition-shadow">
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {trend && (
            <p className="text-xs text-muted-foreground mt-1">
              {trend.label}: {typeof trend.value === 'number' ? trend.value.toLocaleString() : trend.value}
            </p>
          )}
        </div>
        <Icon className="h-8 w-8 text-primary" />
      </div>
    </div>
  </Card>
);

// Define tabs outside of component function to avoid the reference error
const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', icon: Settings },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'reviews', label: 'Reviews', icon: FileText },
  { id: 'beefery-analytics', label: 'Analytics', icon: PieChart },
  { id: 'beefery-management', label: 'Beeferies', icon: Utensils },
  { id: 'reports', label: 'Reports', icon: AlertTriangle },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'polls', label: 'Polls', icon: BarChart2 },
  { id: 'pois', label: 'Points of Interest', icon: MapPin }
];

const AdminDashboard = ({ currentUser }) => {
  // Check if there's a tab in the URL hash using the predefined ADMIN_TABS
  const getInitialTab = () => {
    const hash = window.location.hash.substring(1);
    // Only set active tab if it's one of our defined tabs
    const validTabs = ADMIN_TABS.map(tab => tab.id);
    return validTabs.includes(hash) ? hash : 'overview';
  };

  const [activeTab, setActiveTab] = useState(() => getInitialTab());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    users: 0,
    reviews: 0,
    reports: 0,
    totalReports: 0,
    newUsers: 0,
    activeUsers: 0,
    totalLikes: 0,
    totalComments: 0,
    averageRating: 0
  });
  const [scrollPosition, setScrollPosition] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const tabsContainerRef = useRef(null);

  // Minimum swipe distance in pixels
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      scrollTabs('right');
    }
    if (isRightSwipe) {
      scrollTabs('left');
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Update URL hash when tab changes
    window.location.hash = activeTab;
    
    // Listen for hash changes
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      const validTabs = ADMIN_TABS.map(tab => tab.id);
      if (validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        // Handle ESC key presses
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      // Fetch main stats and report counts in parallel
      const [statsResponse, reportCountsResponse] = await Promise.all([
        fetch(`${config.API_URL}/admin/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }),
        fetch(`${config.API_URL}/admin/report-counts`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })
      ]);

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch stats: ${statsResponse.status}`);
      }

      const statsData = await statsResponse.json();
      
      // Add report counts if available
      if (reportCountsResponse.ok) {
        const reportCounts = await reportCountsResponse.json();
        statsData.reports = reportCounts.pending || 0;
        statsData.totalReports = Object.values(reportCounts).reduce((sum, count) => sum + count, 0);
      }
      
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
      setError('Failed to load admin stats. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Ensure user is admin
  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to access this area.</p>
      </div>
    );
  }

  const scrollTabs = (direction) => {
    if (tabsContainerRef.current) {
      const container = tabsContainerRef.current;
      const scrollAmount = direction === 'left' ? -200 : 200;
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setScrollPosition(container.scrollLeft + scrollAmount);
    }
  };

  // Handle changing tabs
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    window.location.hash = tabId;
  };

  const renderContent = () => {
    if (loading && activeTab === 'overview') {
      return (
        <Card className="p-6">
          <div className="flex items-center justify-center">
            <Loader className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-foreground">Loading content...</span>
          </div>
        </Card>
      );
    }

    if (error && activeTab === 'overview') {
      return (
        <Card className="p-6">
          <div className="text-center">
            <p className="text-red-500">{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                fetchStats();
              }}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </Card>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={stats.users} icon={Users} />
              <StatCard label="Total Reviews" value={stats.reviews} icon={FileText} />
              <StatCard 
                label="Active Reports" 
                value={stats.reports} 
                icon={AlertTriangle} 
                trend={{ 
                  value: stats.totalReports || 0,
                  label: 'Total reports'
                }}
              />
              <StatCard label="New Users Today" value={stats.newUsers} icon={Users} />
              <StatCard label="Active Users" value={stats.activeUsers} icon={Users} />
              <StatCard label="Total Likes" value={stats.totalLikes} icon={ThumbsUp} />
              <StatCard label="Total Comments" value={stats.totalComments} icon={MessageCircle} />
              <StatCard label="Average Rating" value={stats.averageRating?.toFixed(1) || 'N/A'} icon={Star} />
            </div>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
              <div className="h-[600px] overflow-y-auto">
                <AdminActivityFeed currentUser={currentUser} />
              </div>
            </Card>
          </div>
        );
      case 'users':
        return <UserManagement currentUser={currentUser} />;
      case 'reviews':
        return <ReviewManagement currentUser={currentUser} />;
      case 'beefery-analytics':
        return <BeeferyAnalytics currentUser={currentUser} />;
      case 'beefery-management':
        return <BeeferyManagement currentUser={currentUser} />;
      case 'reports':
        return <ReportManagement currentUser={currentUser} />;
      case 'news':
        return <NewsManagement currentUser={currentUser} />;
      case 'polls':
        return <PollManagement currentUser={currentUser} />;
      case 'pois':
        return <PointsOfInterestManagement currentUser={currentUser} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center">
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        </div>
      </div>

      {/* Admin Navigation */}
      <div className="bg-card border-b border-border relative">
        <div className="max-w-7xl mx-auto px-4 flex items-center">
          {/* Left scroll button */}
          <button
            onClick={() => scrollTabs('left')}
            className="p-2 bg-card hover:bg-secondary rounded-full z-10"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>

          {/* Tabs container with horizontal scroll */}
          <div 
            ref={tabsContainerRef}
            className="flex overflow-x-auto scrollbar-hide px-2 py-2 space-x-4 flex-grow touch-pan-x"
            style={{ scrollBehavior: 'smooth' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {ADMIN_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === id
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Icon className={`h-5 w-5 mr-2 ${
                  activeTab === id 
                    ? 'text-white' 
                    : 'text-muted-foreground group-hover:text-foreground'
                }`} />
                {label}
                {id === 'reports' && stats.reports > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {stats.reports}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right scroll button */}
          <button
            onClick={() => scrollTabs('right')}
            className="p-2 bg-card hover:bg-secondary rounded-full z-10"
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminDashboard;