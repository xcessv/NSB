// services/adminService.js
import config from '../config';

const adminService = {
  async getUsers(params = {}) {
    const token = localStorage.getItem('token');
    const queryParams = new URLSearchParams(params);
    
    const response = await fetch(`${config.API_URL}/api/admin/users?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch users');
    }

    return response.json();
  },

  async updateUserRole(userId, role) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${config.API_URL}/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update user role');
    }

    return response.json();
  },

  async updateUserBanStatus(userId, banned) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${config.API_URL}/api/admin/users/${userId}/ban`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ banned })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update user ban status');
    }

    return response.json();
  }
};

export default adminService;