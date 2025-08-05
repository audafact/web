import React, { useState, useEffect } from 'react';
import { X, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface PerformanceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [pendingEvents, setPendingEvents] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [lastError, setLastError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { EnhancedAnalyticsService } = await import('../services/enhancedAnalyticsService');
      const analytics = EnhancedAnalyticsService.getInstance();
      const healthStatus = analytics.getHealthStatus();
      
      setMetrics(healthStatus.performanceMetrics);
      setErrors(analytics.getErrors());
      setPendingEvents(healthStatus.pendingEvents);
      setIsOnline(healthStatus.isOnline);
      setLastError(healthStatus.lastError);
    } catch (error) {
      console.warn('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-audafact-surface-1 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-audafact-divider">
          <h2 className="text-xl font-semibold audafact-heading">Performance Dashboard</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded-lg transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 audafact-card-enhanced">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-audafact-accent-cyan" />
                <span className="font-medium">Metrics</span>
              </div>
              <p className="text-2xl font-bold">{metrics.length}</p>
            </div>
            
            <div className="p-4 audafact-card-enhanced">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="font-medium">Errors</span>
              </div>
              <p className="text-2xl font-bold">{errors.length}</p>
            </div>
            
            <div className="p-4 audafact-card-enhanced">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-5 h-5 text-yellow-500" />
                <span className="font-medium">Pending</span>
              </div>
              <p className="text-2xl font-bold">{pendingEvents}</p>
            </div>
            
            <div className="p-4 audafact-card-enhanced">
              <div className="flex items-center gap-2 mb-2">
                {isOnline ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium">Network</span>
              </div>
              <p className="text-2xl font-bold">{isOnline ? 'Online' : 'Offline'}</p>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold audafact-heading mb-4">Performance Metrics</h3>
            <div className="space-y-2">
              {metrics.slice(0, 10).map((metric, index) => (
                <div key={index} className="p-3 audafact-card-enhanced">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{metric.metric}</span>
                    <span className="text-audafact-accent-cyan">{metric.value}</span>
                  </div>
                  <div className="text-sm text-audafact-text-secondary mt-1">
                    {new Date(metric.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Errors */}
          {errors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold audafact-heading mb-4">Recent Errors</h3>
              <div className="space-y-2">
                {errors.slice(0, 5).map((error, index) => (
                  <div key={index} className="p-3 audafact-card-enhanced border-l-4 border-red-500">
                    <div className="font-medium text-red-500">{error.message}</div>
                    <div className="text-sm text-audafact-text-secondary mt-1">{error.context}</div>
                    <div className="text-xs text-audafact-text-secondary mt-1">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 