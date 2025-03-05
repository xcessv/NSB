import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  Check, 
  Clock, 
  Flag, 
  Loader, 
  Trophy, 
  Users, 
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  X
} from 'lucide-react';
import { Card } from '../ui/card';
import PollForm from './PollForm';
import LikesListModal from '../likes/LikesListModal';
import config from '../../config';

const PollManagement = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [polls, setPolls] = useState([]);
  const [showPollForm, setShowPollForm] = useState(false);
  const [editingPoll, setEditingPoll] = useState(null);
  const [expandedPoll, setExpandedPoll] = useState(null);
  const [showVotersModal, setShowVotersModal] = useState(false);
  const [selectedVoters, setSelectedVoters] = useState([]);
  const [selectedOptionName, setSelectedOptionName] = useState('');
  const [loadingVoters, setLoadingVoters] = useState(false);

  // Initialize user cache if it doesn't exist
  useEffect(() => {
    window.userCache = window.userCache || {};
  }, []);

  // Fetch polls from news items
  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Fetch all news with polls
      const response = await fetch(`${config.API_URL}/news`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch polls');
      }
      
      const newsData = await response.json();
      
      // Extract news items with polls
      const newsWithPolls = (newsData.news || []).filter(item => item.poll);
      
      // Format polls with additional info
      const formattedPolls = newsWithPolls.map(news => ({
        newsId: news._id,
        newsTitle: news.title,
        date: news.date,
        ...news.poll,
        totalVotes: news.poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0)
      }));
      
      // Sort by date (newest first)
      formattedPolls.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setPolls(formattedPolls);
    } catch (error) {
      console.error('Error fetching polls:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndPoll = async (newsId, announceWinner = false) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${config.API_URL}/news/${newsId}/poll/end`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ announceWinner })
      });
      
      if (!response.ok) {
        throw new Error('Failed to end poll');
      }
      
      // Refresh polls
      await fetchPolls();
      
      // Trigger a global refresh event
      const event = new CustomEvent('content-updated', {
        detail: { type: 'poll-ended', newsId, announceWinner }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error ending poll:', error);
      setError(error.message);
    }
  };

  const handleDeletePoll = async (newsId) => {
    if (!window.confirm('Are you sure you want to delete this poll?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${config.API_URL}/news/${newsId}/poll`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete poll');
      }
      
      // Refresh polls
      await fetchPolls();
      
      // Trigger a global refresh event
      const event = new CustomEvent('content-updated', {
        detail: { type: 'poll-deleted', newsId }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error deleting poll:', error);
      setError(error.message);
    }
  };

 // FIXED: Comprehensive fix for poll voter display in PollManagement.jsx
const showVoters = async (poll, optionIndex) => {
  try {
    const option = poll.options[optionIndex];
    setSelectedOptionName(option.title);
    setLoadingVoters(true);
    
    // Get votes for the selected option
    const votes = option.votes || [];
    console.log('Raw votes data:', votes);
    
    // Handle different vote formats and prepare basic voter list
    const votersList = votes.map(vote => {
      // If vote has userId as object with embedded user data
      if (vote.userId && typeof vote.userId === 'object' && vote.userId._id) {
        return {
          _id: vote.userId._id,
          displayName: vote.userId.displayName || vote.userId.username || 'Unknown User',
          profileImage: vote.userId.profileImage,
          username: vote.userId.username,
          timestamp: vote.timestamp
        };
      }
      
      // If vote has userId as string/ObjectId 
      if (vote.userId) {
        const userId = typeof vote.userId === 'object' ? vote.userId.toString() : vote.userId;
        return {
          _id: userId,
          displayName: 'Unknown User', // Will be updated after API call
          timestamp: vote.timestamp
        };
      }
      
      // If vote itself is just a string/ObjectId (fallback for older data)
      return {
        _id: typeof vote === 'object' ? vote.toString() : vote,
        displayName: 'Unknown User' // Will be updated after API call
      };
    });
    
    // Show modal immediately with basic data
    setSelectedVoters(votersList);
    setShowVotersModal(true);
    
    // Try to get a token for authenticated requests
    const token = localStorage.getItem('token');
    if (!token) {
      setLoadingVoters(false);
      return;
    }
    
    // Get list of user IDs we need to fetch data for
    const userIds = votersList
      .filter(voter => voter.displayName === 'Unknown User')
      .map(voter => voter._id)
      .filter(Boolean); // Filter out any null/undefined IDs
    
    if (userIds.length === 0) {
      setLoadingVoters(false);
      return;
    }
    
    console.log('Fetching data for user IDs:', userIds);
    
    // IMPROVED: Try multiple approaches to fetch user data
    try {
      // First try: bulk fetch with IDs query parameter
      const response = await fetch(`${config.API_URL}/users?ids=${userIds.join(',')}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Bulk user API response:', data);
        
        if (data.users && Array.isArray(data.users)) {
          // Create a map of user ID to user data
          const userMap = {};
          data.users.forEach(user => {
            if (user && user._id) {
              userMap[user._id] = user;
            }
          });
          
          // Update voters with fetched user data
          const updatedVoters = votersList.map(voter => {
            if (userMap[voter._id]) {
              const userData = userMap[voter._id];
              return {
                ...voter,
                displayName: userData.displayName || userData.username || 'Unknown User',
                profileImage: userData.profileImage,
                username: userData.username,
                role: userData.role
              };
            }
            return voter;
          });
          
          setSelectedVoters(updatedVoters);
          setLoadingVoters(false);
          return;
        }
      }
      
      // Second try: Try to use admin API for users if available
      const adminResponse = await fetch(`${config.API_URL}/admin/users/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: userIds })
      });
      
      if (adminResponse.ok) {
        const adminData = await adminResponse.json();
        console.log('Admin API response:', adminData);
        
        if (adminData.users && Array.isArray(adminData.users)) {
          // Create a map of user ID to user data
          const userMap = {};
          adminData.users.forEach(user => {
            if (user && user._id) {
              userMap[user._id] = user;
            }
          });
          
          // Update voters with fetched user data
          const updatedVoters = votersList.map(voter => {
            if (userMap[voter._id]) {
              const userData = userMap[voter._id];
              return {
                ...voter,
                displayName: userData.displayName || userData.username || 'Unknown User',
                profileImage: userData.profileImage,
                username: userData.username,
                role: userData.role
              };
            }
            return voter;
          });
          
          setSelectedVoters(updatedVoters);
          setLoadingVoters(false);
          return;
        }
      }
      
      // Third try: fall back to individual fetches for user profiles
      console.log('Falling back to individual user fetches');
      
      // Limit to max 5 fetches to avoid overwhelming
      const maxUsers = Math.min(userIds.length, 5);
      const userFetchPromises = [];
      
      for (let i = 0; i < maxUsers; i++) {
        userFetchPromises.push(
          fetch(`${config.API_URL}/users/profile/${userIds[i]}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.ok ? r.json() : null)
        );
      }
      
      const userResults = await Promise.allSettled(userFetchPromises);
      
      // Process results from individual fetches
      const userMap = {};
      userResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value && result.value.user) {
          const user = result.value.user;
          userMap[user._id] = user;
        }
      });
      
      // Update voters with fetched user data
      const updatedVoters = votersList.map(voter => {
        if (userMap[voter._id]) {
          const userData = userMap[voter._id];
          return {
            ...voter,
            displayName: userData.displayName || userData.username || 'Unknown User',
            profileImage: userData.profileImage,
            username: userData.username,
            role: userData.role
          };
        }
        return voter;
      });
      
      setSelectedVoters(updatedVoters);
      
    } catch (apiError) {
      console.error('Error fetching user data:', apiError);
      // Keep showing the modal with basic data
    }
    
  } catch (error) {
    console.error('Error loading voters:', error);
  } finally {
    setLoadingVoters(false);
  }
};

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-foreground">Polls Management</h3>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>{error}</span>
            <button
              onClick={fetchPolls}
              className="ml-auto text-sm underline"
            >
              Try Again
            </button>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : polls.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
            <p>No polls have been created yet.</p>
            <p className="text-sm mt-2">
              Create a poll by adding it to a news item.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {polls.map((poll, index) => (
              <Card 
                key={index} 
                className={`border ${poll.active ? 'border-primary/30' : poll.winner?.announced ? 'border-yellow-400/50' : 'border-border'} hover:shadow-md transition-shadow`}
              >
                <div className="p-4">
                  {/* Poll Header */}
                  <div 
                    className="flex justify-between items-start cursor-pointer"
                    onClick={() => setExpandedPoll(expandedPoll === poll.newsId ? null : poll.newsId)}
                  >
                    <div>
                      <div className="flex items-center">
                        <h4 className="font-semibold text-foreground">{poll.question}</h4>
                        {poll.active ? (
                          <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full text-xs flex items-center">
                            Closed
                          </span>
                        )}
                        {poll.winner && poll.winner.announced && (
                          <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs flex items-center">
                            <Trophy className="h-3 w-3 mr-1" />
                            Winner Announced
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        From news: {poll.newsTitle}
                      </p>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <span className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
                        </span>
                        <span className="mx-2">•</span>
                        <span>{formatDate(poll.date)}</span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {expandedPoll === poll.newsId ? (
                        <ArrowUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ArrowDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Poll Content */}
                  {expandedPoll === poll.newsId && (
                    <div className="mt-4 pt-4 border-t">
{/* Poll Options */}
<div className="space-y-3 mb-4">
  {poll.options.map((option, optIndex) => {
    const voteCount = option.votes?.length || 0;
    const percentage = poll.totalVotes > 0 
      ? Math.round((voteCount / poll.totalVotes) * 100) 
      : 0;
    const isWinner = poll.winner?.announced && poll.winner.optionIndex === optIndex;
    
    return (
      <div key={optIndex} className="relative">
        <div className={`relative p-3 rounded-lg overflow-hidden border ${
          isWinner ? 'border-yellow-400' : 'border-border'
        }`}>
          {/* Progress bar background */}
          <div 
            className={`absolute top-0 left-0 bottom-0 ${
              isWinner ? 'bg-yellow-100' : 'bg-secondary/30'
            }`}
            style={{ width: `${percentage}%` }}
          />
          
          <div className="flex justify-between items-center relative z-10">
            <div className="flex items-center">
              {/* Option image if available */}
              {option.imageUrl && (
                <div className="w-10 h-10 mr-3 rounded-md overflow-hidden flex-shrink-0">
                  <img
                    src={option.imageUrl}
                    alt={option.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div>
                <div className="font-medium text-foreground flex items-center">
                  {option.title}
                  {isWinner && (
                    <Trophy className="h-4 w-4 text-yellow-500 ml-2" />
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{voteCount}</span>
              <span className="mx-1">·</span>
              <span>{percentage}%</span>
            </div>
          </div>
        </div>
        
        {/* Show voters button - moved below the bar */}
        {voteCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              showVoters(poll, optIndex);
            }}
            className="mt-1 ml-auto block text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Show voters
          </button>
        )}
        
        {/* Winner badge */}
        {isWinner && (
          <div className="absolute -right-1 -top-1 bg-yellow-400 text-yellow-900 p-1 rounded-full">
            <Award className="h-4 w-4" />
          </div>
        )}
      </div>
    );
  })}
</div>
                      
                      {/* Action Buttons */}
                      <div className="flex space-x-2 mt-4">
                        {poll.active && (
                          <>
                            <button
                              onClick={() => handleEndPoll(poll.newsId, false)}
                              className="px-3 py-1.5 text-sm bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center"
                            >
                              <Flag className="h-4 w-4 mr-1" />
                              End Poll
                            </button>
                            <button
                              onClick={() => handleEndPoll(poll.newsId, true)}
                              className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors flex items-center"
                            >
                              <Trophy className="h-4 w-4 mr-1" />
                              End & Announce Winner
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeletePoll(poll.newsId)}
                          className="px-3 py-1.5 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors flex items-center ml-auto"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Delete Poll
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
      
      {/* Voters Modal */}
      {showVotersModal && (
        <LikesListModal
          likes={selectedVoters}
          onClose={() => setShowVotersModal(false)}
          title={`Voters for "${selectedOptionName}"`}
          isLoading={loadingVoters}
        />
      )}
      
      {/* Poll Form Modal */}
      {showPollForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110]">
          <div className="w-full max-w-2xl mx-auto">
            <PollForm
              initialPoll={editingPoll}
              onSubmit={() => {
                setShowPollForm(false);
                fetchPolls();
              }}
              onCancel={() => setShowPollForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PollManagement;