import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';

/**
 * Internal analytics dashboard for viewing creative metrics.
 * Access at /admin/analytics. Requires authentication; production also
 * requires user ID in ADMIN_USER_IDS (Worker env).
 */
export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth?redirect=/admin/analytics', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleClose = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-audafact-surface-2 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-audafact-accent-cyan" />
      </div>
    );
  }

  if (!user) {
    return null; // redirecting
  }

  return (
    <div className="min-h-screen bg-audafact-surface-2 p-4">
      <AnalyticsDashboard isOpen={isOpen} onClose={handleClose} />
    </div>
  );
}
