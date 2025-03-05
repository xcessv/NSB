import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Ban,
  CheckCircle,
  Mail,
  Calendar,
  Star,
  AlertTriangle,
  FileText,
  Loader,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useNotifications } from '../notifications/NotificationProvider';
import config from '../../config';
import { userService } from '../../services/api';
import ProfileImage from '../user/ProfileImage';

// Role Badge Component
const RoleBadge = ({ role }) => {
  if (!role) return null;

  const roleConfig = {
    admin: {
      text: 'Admin',
      className: 'bg-purple-100 text-purple-800'
    },
    moderator: {
      text: 'Mod',
      className: 'bg-green-100 text-green-800'
    },
    user: {
      text: 'User',
      className: 'bg-slate-100 text-slate-800'
    },
    mvb: {
      text: 'MVB',
      className: 'bg-purple-100 text-purple-800'
    },
    danBob: {
      text: 'DanBob',
      className: 'bg-orange-100 text-orange-800'
    },
    verified: {
      text: 'Verified',
      className: 'bg-blue-100 text-blue-800'
    },
    banned: {
      text: 'Banned',
      className: 'bg-red-100 text-red-800'
    }
  };

  const config = roleConfig[role] || {
    text: role,
    className: 'bg-slate-100 text-slate-800'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.text}
    </span>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const { showNotification } = useNotifications();
  
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 0
  });

  const [filterCriteria, setFilterCriteria] = useState({
    role: 'all',
    status: 'all',
    sortBy: 'joinDate',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        search: searchTerm,
        ...filterCriteria
      });

      const response = await fetch(`${config.API_URL}/admin/users?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setPagination(data.pagination || { page: 1, total: 0, pages: 0 });
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to load users');
      showNotification('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchUsers();
  }, []); // Only run once on mount

  // Handle search debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm !== '') {
        fetchUsers();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Handle filter changes
  useEffect(() => {
    if (filterCriteria.page !== 1) {
      fetchUsers();
    }
  }, [filterCriteria.page]);

  const handleFilterChange = (key, value) => {
    setFilterCriteria(prev => ({
      ...prev,
      [key]: value,
      page: 1
    }));
    fetchUsers();
  };

  const handlePageChange = (newPage) => {
    setFilterCriteria(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const handleRoleChange = async (userId, newRole) => {
  try {
    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    // Prevent changing own role
    if (userId === currentUser._id) {
      showNotification('error', 'You cannot change your own role');
      return;
    }

    // Get the user we're changing
    const targetUser = users.find(u => u._id === userId);
    if (!targetUser) {
      showNotification('error', 'User not found');
      return;
    }

    // Only prevent changing an admin to user if they're the last admin
    if (targetUser.role === 'admin' && newRole !== 'admin') {
      // Count how many admins we have
      const adminCount = users.filter(u => u.role === 'admin').length;
      
      if (adminCount <= 1) {
        showNotification('error', 'Cannot remove the last admin user');
        return;
      }
    }

    const token = localStorage.getItem('token');
    const response = await fetch(`${config.API_URL}/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: newRole }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    // Update local state
    setUsers(prevUsers =>
      prevUsers.map(user =>
        user._id === userId ? { ...user, role: newRole } : user
      )
    );

    showNotification('success', `User role updated to ${newRole} successfully`);
  } catch (error) {
    console.error('Failed to update user role:', error);
    showNotification('error', error.message || 'Failed to update user role');
  }
};

  const handleBanUser = async (userId, banned) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/admin/users/${userId}/ban`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ banned }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      showNotification('success', banned ? 'User banned successfully' : 'User unbanned successfully');
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user ban status:', error);
      showNotification('error', error.message);
    }
  };

  const renderProfileImage = (user) => {
    return (
      <ProfileImage
        user={user}
        size="xl"
        className="w-12 h-12"
      />
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Header */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search users by name, email, or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Filter className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role
                </label>
                <select
                  value={filterCriteria.role}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                >
                  <option value="all">All Roles</option>
                  <option value="user">Users</option>
                  <option value="admin">Admins</option>
                  <option value="moderator">Moderators</option>
                  <option value="mvb">MVB</option>
                  <option value="danBob">DanBob</option>
                  <option value="verified">Verified</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={filterCriteria.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="banned">Banned</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sort By
                </label>
                <select
                  value={filterCriteria.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                >
                  <option value="joinDate">Join Date</option>
                  <option value="lastActive">Last Active</option>
                  <option value="reviewCount">Review Count</option>
                  <option value="username">Username</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sort Order
                </label>
                <select
                  value={filterCriteria.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Users List */}
      <div className="space-y-4">
        {loading && users.length === 0 ? (
          <Card className="p-6">
            <div className="flex items-center justify-center">
              <Loader className="w-6 h-6 animate-spin text-purple-500" />
              <span className="ml-2 text-slate-600">Loading users...</span>
            </div>
          </Card>
        ) : error ? (
          <Card className="p-6">
            <div className="text-center text-red-500">
              <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
              {error}
              <button
                onClick={fetchUsers}
                className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                Try Again
              </button>
            </div>
          </Card>
        ) : users.length === 0 ? (
          <Card>
            <div className="p-6 text-center text-slate-500">
              No users found
            </div>
          </Card>
        ) : (
          <>
            {users.map(user => (
  <Card key={user._id} className="hover:shadow-md transition-shadow">
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-start space-y-4 md:space-y-0 md:justify-between">
        {/* User Info */}
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {renderProfileImage(user)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {user.displayName}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm text-slate-500">@{user.username}</span>
              <RoleBadge role={user.role} />
              {user.banned && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Banned
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-1" />
                <span className="truncate max-w-[200px]">{user.email}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Joined {formatDate(user.joinDate)}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* User Stats */}
          <div className="flex space-x-4 px-4 py-2 bg-slate-50 rounded-lg w-full sm:w-auto">
            <div className="flex items-center text-slate-600">
              <FileText className="h-4 w-4 mr-1" />
              <span className="text-sm">{user.reviewCount || 0} reviews</span>
            </div>
            <div className="flex items-center text-slate-600">
              <Star className="h-4 w-4 mr-1" />
              <span className="text-sm">{user.avgRating?.toFixed(1) || 0} avg</span>
            </div>
          </div>

          {/* Admin Actions */}
          <div className="flex space-x-2">
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(user._id, e.target.value)}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                user._id === JSON.parse(localStorage.getItem('user'))._id ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={
                user._id === JSON.parse(localStorage.getItem('user'))._id || // Can't change own role
                (user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1) // Can't demote last admin
              }
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="mvb">MVB</option>
              <option value="danBob">DanBob</option>
              <option value="verified">Verified</option>
            </select>
            <button
              onClick={() => handleBanUser(user._id, !user.banned)}
              className={`p-2 rounded-lg transition-colors ${
                user.banned
                  ? 'text-green-600 hover:bg-green-50'
                  : 'text-red-600 hover:bg-red-50'
              } ${user.role === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={user.role === 'admin'}
              title={
                user.role === 'admin' 
                  ? 'Cannot ban admin users' 
                  : user.banned 
                    ? 'Unban User' 
                    : 'Ban User'
              }
            >
              {user.banned ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <Ban className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Card>
))}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      Showing{' '}
                      <span className="font-medium">
                        {((pagination.page - 1) * filterCriteria.limit) + 1}
                      </span>
                      {' '}to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * filterCriteria.limit, pagination.total)}
                      </span>
                      {' '}of{' '}
                      <span className="font-medium">{pagination.total}</span>
                      {' '}users
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                      >
                        <span className="sr-only">Previous</span>
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      
                      {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                        .filter(page => {
                          const current = pagination.page;
                          return page === 1 || 
                                page === pagination.pages || 
                                (page >= current - 1 && page <= current + 1);
                        })
                        .map((page, index, array) => {
                          const elements = [];
                          if (index > 0 && array[index - 1] !== page - 1) {
                            elements.push(
                              <span
                                key={`ellipsis-before-${page}`}
                                className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300"
                              >
                                ...
                              </span>
                            );
                          }

                          elements.push(
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                page === pagination.page
                                  ? 'bg-purple-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600'
                                  : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0'
                              }`}
                            >
                              {page}
                            </button>
                          );

                          return elements;
                        })}

                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.pages}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                      >
                        <span className="sr-only">Next</span>
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UserManagement;