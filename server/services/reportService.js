// services/reportService.js
import config from '../config';

const reportService = {
  /**
   * Create a new content report
   * @param {Object} reportData - Report data object
   * @param {string} reportData.contentType - Type of content ('review', 'comment', 'user')
   * @param {string} reportData.contentId - ID of the reported content
   * @param {string} reportData.reason - Reason for reporting
   * @param {string} [reportData.additionalInfo] - Additional information
   * @returns {Promise<Object>} Created report object
   */
  async createReport(reportData) {
    if (!reportData.contentType || !reportData.contentId || !reportData.reason) {
      throw new Error('Missing required report data');
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required to report content');
      }

      const response = await fetch(`${config.API_URL}/reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit report');
      }

      return await response.json();
    } catch (error) {
      console.error('Error submitting report:', error);
      throw error;
    }
  },

  /**
   * Get reports (admin only)
   * @param {Object} options - Query options
   * @param {string} [options.filter='pending'] - Filter by status
   * @param {string} [options.type='all'] - Filter by content type
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=20] - Results per page
   * @returns {Promise<Object>} Reports with pagination
   */
  async getReports(options = {}) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const queryParams = new URLSearchParams({
        filter: options.filter || 'pending',
        ...(options.type && options.type !== 'all' && { type: options.type }),
        page: options.page || 1,
        limit: options.limit || 20
      });

      const response = await fetch(`${config.API_URL}/admin/reports?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch reports');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  },

  /**
   * Get report counts by status
   * @returns {Promise<Object>} Counts by status
   */
  async getReportCounts() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${config.API_URL}/admin/report-counts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch report counts');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching report counts:', error);
      throw error;
    }
  },

  /**
   * Take action on a report
   * @param {string} reportId - ID of the report
   * @param {string} action - Action to take ('dismiss', 'reviewing', 'resolve')
   * @returns {Promise<Object>} Updated report
   */
  async handleReportAction(reportId, action) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

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
        throw new Error(errorData.message || 'Failed to process report');
      }

      return await response.json();
    } catch (error) {
      console.error('Error handling report action:', error);
      throw error;
    }
  }
};

export { reportService };
export default reportService;