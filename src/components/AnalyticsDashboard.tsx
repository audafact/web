import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { FUNNEL_STAGES } from '../services/analyticsService';
import { useAnalytics } from '../hooks/useAnalytics';

interface AnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  isOpen,
  onClose
}) => {
  const [funnelData, setFunnelData] = useState<Record<string, number>>({});
  const [conversionRates, setConversionRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [retryQueueLength, setRetryQueueLength] = useState(0);
  const [sessionId, setSessionId] = useState('');
  const [averageLoadTime, setAverageLoadTime] = useState(0);
  
  const analytics = useAnalytics();
  
  useEffect(() => {
    if (isOpen) {
      loadAnalyticsData();
    }
  }, [isOpen]);
  
  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // Load funnel data
      const rates = analytics.getFunnelConversionRate();
      setConversionRates(rates);
      
      // Load other analytics data
      setRetryQueueLength(analytics.getRetryQueueLength());
      setSessionId(analytics.getSessionId());
      setAverageLoadTime(analytics.getAverageMetric('page_load_time'));
      
      // Mock some additional metrics for demonstration
      setFunnelData({
        'Demo to Signup': 15.2,
        'Signup to Pro': 8.7,
        'Avg Demo Session': 3.2,
        'Feature Gate CTR': 32.1
      });
      
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatMetricValue = (value: number, type: 'percentage' | 'time' | 'number' = 'number') => {
    switch (type) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'time':
        return `${value.toFixed(1)}min`;
      default:
        return value.toFixed(1);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="analytics-dashboard">
        <div className="dashboard-header">
          <h2>📊 Analytics Dashboard</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading analytics data...</p>
          </div>
        ) : (
          <div className="dashboard-content">
            {/* Session Info */}
            <div className="session-info">
              <div className="info-item">
                <span className="info-label">Session ID:</span>
                <span className="info-value">{sessionId}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Retry Queue:</span>
                <span className="info-value">{retryQueueLength} events</span>
              </div>
              <div className="info-item">
                <span className="info-label">Avg Load Time:</span>
                <span className="info-value">{formatMetricValue(averageLoadTime, 'time')}</span>
              </div>
            </div>
            
            {/* Funnel Chart */}
            <div className="funnel-section">
              <h3>Conversion Funnel</h3>
              <div className="funnel-chart">
                {FUNNEL_STAGES.map((stage, index) => (
                  <div key={stage.name} className="funnel-stage">
                    <div className="stage-name">{stage.name}</div>
                    <div className="stage-rate">
                      {conversionRates[stage.name]?.toFixed(1)}%
                    </div>
                    {index < FUNNEL_STAGES.length - 1 && (
                      <div className="funnel-arrow">↓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Key Metrics */}
            <div className="metrics-section">
              <h3>Key Metrics</h3>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{formatMetricValue(funnelData['Demo to Signup'] || 0, 'percentage')}</div>
                  <div className="metric-label">Demo to Signup</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetricValue(funnelData['Signup to Pro'] || 0, 'percentage')}</div>
                  <div className="metric-label">Signup to Pro</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetricValue(funnelData['Avg Demo Session'] || 0, 'time')}</div>
                  <div className="metric-label">Avg Demo Session</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetricValue(funnelData['Feature Gate CTR'] || 0, 'percentage')}</div>
                  <div className="metric-label">Feature Gate CTR</div>
                </div>
              </div>
            </div>
            
            {/* Recent Events */}
            <div className="events-section">
              <h3>Recent Analytics Events</h3>
              <div className="events-list">
                <div className="event-item">
                  <span className="event-time">2 min ago</span>
                  <span className="event-name">demo_track_loaded</span>
                  <span className="event-user">Guest User</span>
                </div>
                <div className="event-item">
                  <span className="event-time">5 min ago</span>
                  <span className="event-name">feature_gate_clicked</span>
                  <span className="event-user">Guest User</span>
                </div>
                <div className="event-item">
                  <span className="event-time">8 min ago</span>
                  <span className="event-name">signup_completed</span>
                  <span className="event-user">New User</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}; 