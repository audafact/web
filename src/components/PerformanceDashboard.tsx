import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { EnhancedAnalyticsService } from '../services/enhancedAnalyticsService';
import { PerformanceEvent } from '../services/performanceMonitor';
import { ErrorEvent } from '../services/errorMonitor';

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  isVisible,
  onClose
}) => {
  const [metrics, setMetrics] = useState<PerformanceEvent[]>([]);
  const [errors, setErrors] = useState<ErrorEvent[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  
  useEffect(() => {
    if (isVisible) {
      const analytics = EnhancedAnalyticsService.getInstance();
      
      setMetrics(analytics.getPerformanceMetrics());
      setErrors(analytics.getErrors());
      setHealthStatus(analytics.getHealthStatus());
    }
  }, [isVisible]);
  
  const getAverageMetric = (metricName: string): number => {
    const relevantMetrics = metrics.filter(m => m.metric.includes(metricName));
    if (relevantMetrics.length === 0) return 0;
    
    const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / relevantMetrics.length;
  };
  
  return (
    <Modal isOpen={isVisible} onClose={onClose}>
      <div className="performance-dashboard">
        <div className="dashboard-header">
          <h2>Performance & Error Dashboard</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        
        <div className="dashboard-content">
          {/* Health Status */}
          <div className="health-status">
            <h3>System Health</h3>
            <div className="health-grid">
              <div className="health-item">
                <span className="label">Online Status</span>
                <span className={`value ${healthStatus?.isOnline ? 'online' : 'offline'}`}>
                  {healthStatus?.isOnline ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
              <div className="health-item">
                <span className="label">Pending Events</span>
                <span className="value">{healthStatus?.pendingEvents || 0}</span>
              </div>
              <div className="health-item">
                <span className="label">Error Rate (1h)</span>
                <span className="value">{healthStatus?.errorRate || 0}</span>
              </div>
            </div>
          </div>
          
          {/* Performance Metrics */}
          <div className="performance-metrics">
            <h3>Performance Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-item">
                <span className="label">Demo Load Time</span>
                <span className="value">{getAverageMetric('demoLoadTime').toFixed(2)}ms</span>
              </div>
              <div className="metric-item">
                <span className="label">Feature Gate Response</span>
                <span className="value">{getAverageMetric('featureGateResponseTime').toFixed(2)}ms</span>
              </div>
              <div className="metric-item">
                <span className="label">Audio Load Time</span>
                <span className="value">{getAverageMetric('audioLoadTime').toFixed(2)}ms</span>
              </div>
              <div className="metric-item">
                <span className="label">Time to Interactive</span>
                <span className="value">{getAverageMetric('timeToInteractive').toFixed(2)}ms</span>
              </div>
            </div>
          </div>
          
          {/* Recent Errors */}
          <div className="recent-errors">
            <h3>Recent Errors</h3>
            <div className="errors-list">
              {errors.slice(-5).map(error => (
                <div key={error.id} className="error-item">
                  <div className="error-header">
                    <span className={`severity ${error.severity}`}>{error.severity}</span>
                    <span className="timestamp">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="error-message">{error.message}</div>
                  <div className="error-context">{error.context.currentRoute}</div>
                </div>
              ))}
              {errors.length === 0 && (
                <div className="no-errors">No errors recorded</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}; 