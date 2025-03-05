import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User,
  Eye,
  Clock,
  Filter,
  ExternalLink,
  Flag,
  RefreshCw,
  MessageCircle,
  FileText,
  Loader
} from 'lucide-react';
import { Card } from '../ui/card';
import ReviewModal from '../review/ReviewModal';
import CommentModal from '../comment/CommentModal';
import config from '../../config';
import { reportService } from '../../services/api';

const ReportManagement = ({ currentUser }) => {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [reportCounts, setReportCounts] = useState({
    pending: 0,
    reviewing: 0,
    resolved: 0,
    dismissed: 0
  });
  const [filterCriteria, setFilterCriteria] = useState({
    type: 'all',
    dateRange: '7days',
    sortBy: 'date'
  });
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReviewContent, setSelectedReviewContent] = useState(null);
  const [selectedCommentContent, setSelectedCommentContent] = useState(null);

  // Fetch reports based on current filter and criteria
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        filter,
        ...filterCriteria
      });

      const response = await fetch(`${config.API_URL}/admin/reports?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch reports: ${response.status}`);
      }

      const data = await response.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      setError(error.message || 'Failed to fetch reports. Please try again.');
      // Provide fallback empty reports array 
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [filter, filterCriteria]);

  // Fetch report counts
  const fetchReportCounts = useCallback(async () => {
    try {
      const response = await fetch(`${config.API_URL}/admin/report-counts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch report counts: ${response.status}`);
      }

      const data = await response.json();
      setReportCounts(data);
    } catch (error) {
      console.error('Failed to fetch report counts:', error);
      // Provide fallback data to avoid UI errors
      setReportCounts({
        pending: 0,
        reviewing: 0,
        resolved: 0,
        dismissed: 0
      });
    }
  }, []);

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchReports();
    fetchReportCounts();
  }, [fetchReports, fetchReportCounts]);

  // Refresh data
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([fetchReports(), fetchReportCounts()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle report action (dismiss, review, resolve)
  const handleReportAction = async (reportId, action) => {
    try {
      const response = await fetch(`${config.API_URL}/admin/reports/${reportId}/action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Failed to process report: ${response.status}`);
      }

      // Refresh reports
      fetchReports();
      fetchReportCounts();
    } catch (error) {
      console.error('Failed to process report:', error);
      setError(error.message || 'Failed to process report. Please try again.');
    }
  };

  // View reported content
  const handleViewContent = async (report) => {
    setSelectedReport(report);
    
    try {
      if (report.type === 'review') {
        await fetchReviewContent(report.contentId);
      } else if (report.type === 'comment') {
        await fetchCommentContent(report.contentId);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
      setError('Failed to fetch the reported content. It may have been deleted.');
    }
  };

  // Fetch review content
  const fetchReviewContent = async (reviewId) => {
    try {
      const response = await fetch(`${config.API_URL}/reviews/${reviewId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch review: ${response.status}`);
      }

      const review = await response.json();
      setSelectedReviewContent(review);
      setSelectedCommentContent(null);
    } catch (error) {
      console.error('Failed to fetch review:', error);
      setSelectedReviewContent(null);
      throw error;
    }
  };

  // Fetch comment content
  const fetchCommentContent = async (commentId) => {
    try {
      // First, we need to find which review contains this comment
      const response = await fetch(`${config.API_URL}/reviews?commentId=${commentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to find review containing comment: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.reviews && data.reviews.length > 0) {
        const review = data.reviews[0];
        const comment = review.comments.find(c => c._id === commentId);
        
        if (comment) {
          setSelectedCommentContent({
            ...comment,
            reviewId: review._id,
            beefery: review.beefery
          });
          setSelectedReviewContent(null);
        } else {
          throw new Error('Comment not found in review');
        }
      } else {
        throw new Error('Review containing comment not found');
      }
    } catch (error) {
      console.error('Failed to fetch comment:', error);
      setSelectedCommentContent(null);
      throw error;
    }
  };

  // Format date in a readable format
  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color for badges
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'reviewing':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'dismissed':
        return 'bg-secondary text-slate-800';
      default:
        return 'bg-secondary text-slate-800';
    }
  };

  // Get content type icon
  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'review':
        return <FileText className="h-4 w-4 mr-1" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 mr-1" />;
      case 'user':
        return <User className="h-4 w-4 mr-1" />;
      default:
        return <Flag className="h-4 w-4 mr-1" />;
    }
  };

  // Close content modals
  const handleCloseContentModal = () => {
    setSelectedReport(null);
    setSelectedReviewContent(null);
    setSelectedCommentContent(null);
  };

  // If there's an error with the reports API endpoint, display a helpful message
  if (error && error.includes('Unexpected token')) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Report API Not Setup</h2>
            <p className="text-muted-foreground mb-4">
              The report management API endpoints don't appear to be properly set up yet. 
              Please ensure the report routes are added to your server.js file.
            </p>
            <div className="bg-slate-50 p-4 rounded-lg text-left w-full max-w-2xl">
              <p className="font-medium mb-2">Add this to your server.js file:</p>
              <pre className="bg-slate-100 p-2 rounded text-sm overflow-x-auto">
                {`const reportRoutes = require('./routes/reportRoutes');\n\n// Add this with your other route registrations\napp.use('/api', reportRoutes);`}
              </pre>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh and filters */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-foreground">Report Management</h2>
        <button
          onClick={handleRefresh}
          className={`p-2 rounded-full transition-colors ${
            refreshing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-secondary'
          }`}
          disabled={refreshing}
          title="Refresh Reports"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Filters */}
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {['pending', 'reviewing', 'resolved', 'dismissed'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
                  filter === status
                    ? 'bg-primary text-white'
                    : 'bg-secondary text-muted-foreground hover:bg-border'
                }`}
              >
                <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                <span className="ml-2 bg-white/20 text-xs rounded-full px-2 py-0.5">
                  {reportCounts[status] || 0}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <Filter className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Additional Filters */}
        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Content Type
                </label>
                <select
                  value={filterCriteria.type}
                  onChange={(e) => setFilterCriteria(prev => ({
                    ...prev,
                    type: e.target.value
                  }))}
                  className="w-full p-2 border border-border rounded-lg"
                >
                  <option value="all">All Types</option>
                  <option value="review">Reviews</option>
                  <option value="comment">Comments</option>
                  <option value="user">Users</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date Range
                </label>
                <select
                  value={filterCriteria.dateRange}
                  onChange={(e) => setFilterCriteria(prev => ({
                    ...prev,
                    dateRange: e.target.value
                  }))}
                  className="w-full p-2 border border-border rounded-lg"
                >
                  <option value="today">Today</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sort By
                </label>
                <select
                  value={filterCriteria.sortBy}
                  onChange={(e) => setFilterCriteria(prev => ({
                    ...prev,
                    sortBy: e.target.value
                  }))}
                  className="w-full p-2 border border-border rounded-lg"
                >
                  <option value="date">Date</option>
                  <option value="type">Type</option>
                  <option value="reports">Report Count</option>
                </select>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Error Message */}
      {error && !error.includes('Unexpected token') && (
        <Card className="p-4 border-red-300">
          <div className="text-red-500 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {error}
          </div>
        </Card>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <div className="p-6 text-center text-slate-500 flex justify-center">
              <Loader className="h-6 w-6 animate-spin mr-2" />
              Loading reports...
            </div>
          </Card>
        ) : reports.length === 0 ? (
          <Card>
            <div className="p-6 text-center text-slate-500">
              No {filter} reports found
            </div>
          </Card>
        ) : (
          reports.map(report => (
            <Card key={report._id} className="hover:shadow-md transition-shadow">
              <div className="p-6">
                {/* Report Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getStatusColor(report.status)
                      }`}>
                        {report.status}
                      </span>
                      <span className="text-sm text-slate-500">
                        <Clock className="inline-block h-4 w-4 mr-1" />
                        {formatDate(report.date)}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {getContentTypeIcon(report.type)}
                        {report.type}
                      </span>
                    </div>

                    {/* Reporter Info */}
                    <div className="flex items-center mt-2 space-x-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-muted-foreground">
                        Reported by {report.reportedBy?.displayName || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    {report.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleReportAction(report._id, 'reviewing')}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Mark as Reviewing"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleReportAction(report._id, 'dismiss')}
                          className="p-2 text-muted-foreground hover:bg-slate-50 rounded-lg transition-colors"
                          title="Dismiss Report"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleReportAction(report._id, 'resolve')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove Content"
                        >
                          <AlertTriangle className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    {report.status === 'reviewing' && (
                      <>
                        <button
                          onClick={() => handleReportAction(report._id, 'dismiss')}
                          className="p-2 text-muted-foreground hover:bg-slate-50 rounded-lg transition-colors"
                          title="Dismiss Report"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleReportAction(report._id, 'resolve')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Remove Content"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleViewContent(report)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="View Content"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Report Content */}
                <div className="mt-4">
                  <div className="text-sm font-medium text-slate-700 mb-2">
                    Report Reason:
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-muted-foreground">
                    {report.reason}
                    {report.additionalInfo && (
                      <p className="mt-2 pt-2 border-t border-slate-200">
                        <span className="font-medium">Additional Info:</span> {report.additionalInfo}
                      </p>
                    )}
                  </div>
                </div>

                {/* Reported Content Preview */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-slate-700">
                      Reported Content:
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-muted-foreground">
                    {report.contentPreview || 'No content preview available'}
                  </div>
                </div>

                {/* Additional Details */}
                {report.status !== 'pending' && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <div>
                        Handled by: {report.resolvedBy?.displayName || 'System'}
                      </div>
                      <div>
                        Resolution: {report.resolution || 'None'}
                      </div>
                      {report.resolvedDate && (
                        <div>
                          Resolved: {formatDate(report.resolvedDate)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Content Modals */}
      {selectedReviewContent && (
        <ReviewModal
          review={selectedReviewContent}
          onClose={handleCloseContentModal}
          currentUser={currentUser}
          readOnly={true}
        />
      )}

      {selectedCommentContent && (
        <CommentModal
          comment={selectedCommentContent}
          onClose={handleCloseContentModal}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default ReportManagement;