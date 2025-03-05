import React, { useState } from 'react';
import { X, Flag, AlertTriangle, Loader, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { reportService } from '../../services/api';

const REPORT_REASONS = [
  { id: 'inappropriate', label: 'Inappropriate Content' },
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'misinformation', label: 'Misinformation' },
  { id: 'other', label: 'Other' }
];

const ReportModal = ({ 
  contentType, // 'review' or 'comment' or 'user'
  contentId,
  onClose,
  onReportSubmitted 
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReason) return;

    try {
      setLoading(true);
      setError(null);

      // Use the reportService to submit the report
      const reportResult = await reportService.createReport({
        contentType,
        contentId,
        reason: selectedReason,
        additionalInfo: additionalInfo.trim()
      });

      setSuccess(true);
      
      // After successful submission, call the callback with the report result
      if (onReportSubmitted) {
        onReportSubmitted({
          contentType,
          contentId,
          reportResult
        });
      }
      
      // After 2 seconds, close the modal
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Report submission error:', error);
      setError(error.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };
  
  const getContentTypeText = () => {
    switch (contentType) {
      case 'review':
        return 'Review';
      case 'comment':
        return 'Comment';
      case 'user':
        return 'User';
      default:
        return 'Content';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <Card className="w-full max-w-md bg-card p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full"
          disabled={loading}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center">
            <Flag className="h-6 w-6 mr-2 text-primary" />
            Report {getContentTypeText()}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Help us understand what's wrong with this {contentType}.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold text-green-600">Report Submitted</h3>
            <p className="text-center text-muted-foreground mt-2">
              Thank you for helping keep our community safe.
              Our moderators will review this report soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Why are you reporting this {contentType}?
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map(({ id, label }) => (
                  <label
                    key={id}
                    className={`flex items-center p-3 rounded-lg border border-border hover:bg-secondary cursor-pointer transition-colors ${
                      selectedReason === id ? 'bg-primary/10 border-primary' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={id}
                      checked={selectedReason === id}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="mr-3"
                    />
                    <span className="text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Additional Information (Optional)
              </label>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Provide any additional details about your report..."
                className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none h-32"
                disabled={loading}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-foreground hover:bg-secondary rounded-lg"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedReason || loading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ReportModal;