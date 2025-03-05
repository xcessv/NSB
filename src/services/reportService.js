// services/reportService.js
import config from '../config';

const reportService = {
  createReport: async (data) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${config.API_URL}/reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create report');
      }

      return response.json();
    } catch (error) {
      console.error('Create report error:', error);
      throw error;
    }
  },

  getReports: async (filter = 'pending', page = 1) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${config.API_URL}/admin/reports?filter=${filter}&page=${page}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch reports');
      }

      return response.json();
    } catch (error) {
      console.error('Get reports error:', error);
      throw error;
    }
  },

  handleReport: async (reportId, action) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${config.API_URL}/admin/reports/${reportId}/action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to handle report');
      }

      return response.json();
    } catch (error) {
      console.error('Handle report error:', error);
      throw error;
    }
  }
};

export default reportService;