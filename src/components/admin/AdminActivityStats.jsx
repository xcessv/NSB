import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Users, 
  Star, 
  ThumbsUp, 
  MessageCircle,
  TrendingUp,
  Loader
} from 'lucide-react';
import config from '../../config';

const StatCard = ({ title, value, icon: Icon, change }) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold mt-2">{value}</h3>
          {change !== undefined && (
            <p className={`text-sm mt-2 flex items-center ${
              change >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              <TrendingUp className={`h-4 w-4 mr-1 ${
                change < 0 ? 'rotate-180' : ''
              }`} />
              {Math.abs(change)}% from last week
            </p>
          )}
        </div>
        <div className="p-4 bg-secondary rounded-full">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const AdminActivityStats = ({ currentUser }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 300000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${config.API_URL}/admin/activity-stats`, {
        headers: {
          'Authorization': `Bearer ${currentUser.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-center h-24">
                <Loader className="h-6 w-6 animate-spin text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-500">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Active Users"
        value={stats.activeUsers}
        icon={Users}
        change={stats.userGrowth}
      />
      <StatCard
        title="New Reviews"
        value={stats.newReviews}
        icon={Star}
        change={stats.reviewGrowth}
      />
      <StatCard
        title="Total Likes"
        value={stats.totalLikes}
        icon={ThumbsUp}
        change={stats.likeGrowth}
      />
      <StatCard
        title="Total Comments"
        value={stats.totalComments}
        icon={MessageCircle}
        change={stats.commentGrowth}
      />
    </div>
  );
};

export default AdminActivityStats;