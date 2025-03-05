import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Users, Trophy, AlertTriangle, Loader, Award, Clock, Lock, ExternalLink } from 'lucide-react';
import LikesListModal from '../likes/LikesListModal';
import { getMediaUrl } from '../../utils/MediaUtils';
import config from '../../config';

const PollDisplay = ({ poll, newsId, currentUser, onVote }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showVotersModal, setShowVotersModal] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [selectedVoters, setSelectedVoters] = useState([]);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null);
  
  // Initialize user cache
  useEffect(() => {
    window.userCache = window.userCache || {};
  }, []);
  
  // Enhanced poll validation
  useEffect(() => {
    console.log(`PollDisplay mounted for news ${newsId} with poll:`, poll);
    
    // Validate poll data and log any issues
    if (!poll) {
      console.error(`Poll is missing or null for news ${newsId}`);
      return;
    }
    
    if (!poll.question) {
      console.error(`Poll is missing question for news ${newsId}`);
    }
    
    if (!Array.isArray(poll.options)) {
      console.error(`Poll options are not an array for news ${newsId}`);
    } else if (poll.options.length < 2) {
      console.error(`Poll has fewer than 2 options for news ${newsId}`);
    }
  }, [newsId, poll]);
  
  if (!poll || !poll.question || !Array.isArray(poll.options) || poll.options.length < 2) {
    console.error('Invalid poll data:', poll);
    return null;
  }
  
  // Calculate total votes
  const totalVotes = poll.options.reduce((sum, option) => 
    sum + (option.votes?.length || 0), 0);
  
  // Find user's current vote if any
  let userVotedOptionIndex = -1;
  for (let i = 0; i < poll.options.length; i++) {
    const hasVoted = poll.options[i].votes?.some(vote => {
      if (typeof vote === 'object') {
        return vote.userId === currentUser?._id || 
               (vote.userId && typeof vote.userId === 'object' && 
                vote.userId._id === currentUser?._id);
      }
      return vote === currentUser?._id;
    });
    
    if (hasVoted) {
      userVotedOptionIndex = i;
      break;
    }
  }
  
  const handleVote = async (optionIndex) => {
    if (!currentUser) {
      setError('You must be logged in to vote');
      return;
    }
    
    if (!poll.active) {
      setError('This poll is no longer active');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await onVote(optionIndex);
    } catch (error) {
      console.error('Voting error:', error);
      setError(error.message || 'Failed to record your vote');
    } finally {
      setLoading(false);
    }
  };
  
  const getOptionPercentage = (optionIndex) => {
    if (totalVotes === 0) return 0;
    const votes = poll.options[optionIndex].votes?.length || 0;
    return Math.round((votes / totalVotes) * 100);
  };
  
  // Improved voter data fetching
  const showVoters = async (optionIndex) => {
    try {
      setSelectedOptionIndex(optionIndex);
      setLoadingVoters(true);
      
      // Get votes for the selected option
      const votes = poll.options[optionIndex].votes || [];
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
      
      // Try multiple approaches to fetch user data
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
        
        // Fall back to individual fetches
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
      }
      
    } catch (error) {
      console.error('Error loading voters:', error);
    } finally {
      setLoadingVoters(false);
    }
  };
  
  // Check for winner announcement
  const hasWinner = poll.winner && poll.winner.announced;
  const winnerIndex = hasWinner ? poll.winner.optionIndex : -1;
  const winnerOption = winnerIndex >= 0 ? poll.options[winnerIndex] : null;
  
  return (
    <div className="mt-4 mb-4">
      {/* Poll header with streamlined winner announcement */}
      <div className="mb-3">
        {/* Winner announcement banner */}
        {hasWinner && (
          <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 flex items-center">
            <Trophy className="h-4 w-4 mr-2 text-yellow-500" />
            <div>
              <p className="font-semibold text-sm">
                Poll results: "{winnerOption?.title}" 
                {totalVotes > 0 && ` won with ${getOptionPercentage(winnerIndex)}% of votes`}
              </p>
            </div>
          </div>
        )}
        
        {/* Poll question with status indicator */}
        <div className="flex items-center">
          <h4 className="text-base font-semibold text-foreground flex items-center">
            {poll.question}
            {!poll.active && !hasWinner && (
              <span className="ml-2 text-muted-foreground text-xs flex items-center">
                <Lock className="h-3 w-3 mr-1" />
                Closed
              </span>
            )}
            {hasWinner && (
              <span className="ml-2 text-yellow-600 text-xs flex items-center">
                <Trophy className="h-3 w-3 mr-1" />
                Results
              </span>
            )}
          </h4>
          
          {totalVotes > 0 && (
            <span className="ml-auto text-xs text-muted-foreground flex items-center">
              <Users className="h-3 w-3 mr-1" />
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </span>
          )}
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mb-2 p-2 bg-red-50 text-red-600 rounded-lg flex items-center text-xs">
          <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Streamlined Poll options */}
      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const percentage = getOptionPercentage(index);
          const isWinner = winnerIndex === index;
          const userVoted = userVotedOptionIndex === index;
          const hasImage = Boolean(option.imageUrl);
          
          return (
            <div key={index} className="relative">
              <button
                onClick={() => handleVote(index)}
                disabled={loading || !poll.active || !currentUser}
                className={`relative w-full text-left ${hasImage ? 'p-3' : 'py-2 px-3'} rounded-lg overflow-hidden border transition-all ${
                  isWinner 
                    ? 'border-yellow-400 ring-1 ring-yellow-300/50'
                    : userVoted 
                      ? 'bg-primary/10 border-primary/30' 
                      : !poll.active 
                        ? 'border-gray-200 opacity-80'
                        : 'border-border hover:bg-secondary/50'
                }`}
              >
                {/* Progress bar background */}
                <div 
                  className={`absolute top-0 left-0 bottom-0 ${
                    isWinner
                      ? 'bg-yellow-100'
                      : userVoted
                        ? 'bg-primary/20'
                        : !poll.active 
                          ? 'bg-gray-100'
                          : 'bg-secondary/60'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
                
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex items-center flex-grow">
                    {/* Option image as a small thumbnail */}
                    {hasImage && (
                      <div 
                        className="w-8 h-8 mr-2 rounded-md overflow-hidden flex-shrink-0 cursor-pointer border border-gray-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedImage({
                            url: typeof option.imageUrl === 'string' && option.imageUrl.startsWith('data:') 
                              ? option.imageUrl 
                              : getMediaUrl(option.imageUrl, 'news'),
                            title: option.title
                          });
                        }}
                      >
                        <img
                          src={typeof option.imageUrl === 'string' && option.imageUrl.startsWith('data:') 
                            ? option.imageUrl 
                            : getMediaUrl(option.imageUrl, 'news')}
                          alt={option.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('Poll option image load error:', e);
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    <div>
                      {/* Option title */}
                      <div className={`font-medium text-sm ${isWinner ? 'text-yellow-700' : 'text-foreground'} flex items-center`}>
                        {option.title}
                        {isWinner && (
                          <Trophy className="h-3 w-3 text-yellow-600 ml-1" />
                        )}
                      </div>
                      
                      {/* Vote count and percentage */}
                      <div className="text-xs text-muted-foreground flex items-center">
                        <span>{option.votes?.length || 0} {option.votes?.length === 1 ? 'vote' : 'votes'}</span>
                        <span className="mx-1">•</span>
                        <span>{percentage}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Award at the right side */}
                  {isWinner && (
                    <div className="flex-shrink-0 ml-2">
                      <Award className="h-4 w-4 text-yellow-600" />
                    </div>
                  )}
                </div>
              </button>
              
              {/* Show voters button - back to its own line */}
              {(option.votes?.length > 0) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    showVoters(index);
                  }}
                  disabled={loadingVoters}
                  className="mt-0.5 ml-auto block text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {loadingVoters && selectedOptionIndex === index ? (
                    <Loader className="h-3 w-3 animate-spin" />
                  ) : (
                    'Show voters'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Poll status - simplified */}
      <div className="mt-3 text-xs">
        {!poll.active && !hasWinner && (
          <div className="text-muted-foreground flex items-center">
            <Lock className="h-3 w-3 mr-1" />
            This poll is closed. No more votes can be submitted.
          </div>
        )}
        
        {poll.active && (
          <div className="text-green-600 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            This poll is active. Cast your vote!
          </div>
        )}
      </div>
      
      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center mt-2">
          <Loader className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
      
      {/* Voters modal */}
      {showVotersModal && selectedOptionIndex !== null && (
        <LikesListModal
          likes={selectedVoters}
          onClose={() => setShowVotersModal(false)}
          title={`Voters for "${poll.options[selectedOptionIndex]?.title || 'Option'}"`}
          isLoading={loadingVoters}
        />
      )}
      
      {/* Expanded image modal */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-lg">
            <img 
              src={expandedImage.url} 
              alt={expandedImage.title}
              className="max-h-[80vh] max-w-full rounded-lg"
            />
            <button 
              className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white hover:bg-black/70"
              onClick={() => setExpandedImage(null)}
            >
              <ExternalLink className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

PollDisplay.propTypes = {
  poll: PropTypes.shape({
    question: PropTypes.string.isRequired,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string.isRequired,
        imageUrl: PropTypes.string,
        votes: PropTypes.array
      })
    ).isRequired,
    active: PropTypes.bool,
    winner: PropTypes.shape({
      optionIndex: PropTypes.number,
      announced: PropTypes.bool
    })
  }),
  newsId: PropTypes.string.isRequired,
  currentUser: PropTypes.object,
  onVote: PropTypes.func.isRequired
};

export default PollDisplay;