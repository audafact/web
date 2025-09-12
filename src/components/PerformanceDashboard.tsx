/**
 * Performance Dashboard Component
 * 
 * Displays system health, performance metrics, and error information
 * Essential for Phase 6 observability
 */

import React, { useState, useEffect } from 'react';
import { EnhancedAnalyticsService } from '../services/enhancedAnalyticsService';
import { CostTrackingService } from '../services/costTrackingService';
import { R2StorageService } from '../services/r2StorageService';
import { WorkerMonitoringService } from '../services/workerMonitoringService';

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

interface HealthStatus {
  status: 'online' | 'offline';
  pendingEvents: number;
  errorRate: number;
}

interface PerformanceMetrics {
  demoLoadTime: number;
  featureGateResponse: number;
  audioLoadTime: number;
  averageResponseTime: number;
}

interface ErrorInfo {
  message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  source: string;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  isVisible,
  onClose,
}) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    status: 'online',
    pendingEvents: 0,
    errorRate: 0,
  });
  
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    demoLoadTime: 0,
    featureGateResponse: 0,
    audioLoadTime: 0,
    averageResponseTime: 0,
  });
  
  const [recentErrors, setRecentErrors] = useState<ErrorInfo[]>([]);
  const [costMetrics, setCostMetrics] = useState({
    storageCost: 0,
    bandwidthCost: 0,
    requestCost: 0,
    totalCost: 0,
  });
  const [storageMetrics, setStorageMetrics] = useState({
    totalSize: '0 B',
    objectCount: '0',
    dailyUpload: '0 B',
    dailyDownload: '0 B',
  });

  useEffect(() => {
    if (isVisible) {
      fetchData();
    }
  }, [isVisible]);

  const fetchData = async () => {
    try {
      // Get analytics data
      const analytics = EnhancedAnalyticsService.getInstance();
      const performanceData = analytics.getPerformanceMetrics();
      const errors = analytics.getErrors();
      const health = analytics.getHealthStatus();

      setHealthStatus(health);
      setPerformanceMetrics(performanceData);
      setRecentErrors(errors);

      // Get cost data
      const costTracker = CostTrackingService.getInstance();
      const costs = costTracker.calculateCosts();
      setCostMetrics(costs);

      // Get storage data
      const r2Storage = R2StorageService.getInstance();
      const storageUsage = r2Storage.getStorageUsageFormatted();
      setStorageMetrics(storageUsage);

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(4)}`;
  };

  const formatTime = (ms: number): string => {
    return `${ms.toFixed(2)}ms`;
  };

  const getStatusIcon = (status: string): string => {
    return status === 'online' ? '🟢' : '🔴';
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            Performance & Error Dashboard
          </h2>
          <button
            data-testid="close-button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* System Health */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">System Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl mb-1">
                  {getStatusIcon(healthStatus.status)}
                </div>
                <div className="text-sm text-gray-600">
                  {healthStatus.status === 'online' ? 'Online' : 'Offline'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {healthStatus.pendingEvents}
                </div>
                <div className="text-sm text-gray-600">Pending Events</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {healthStatus.errorRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Error Rate</div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Performance Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">
                  {formatTime(performanceMetrics.demoLoadTime)}
                </div>
                <div className="text-sm text-gray-600">Demo Load Time</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">
                  {formatTime(performanceMetrics.featureGateResponse)}
                </div>
                <div className="text-sm text-gray-600">Feature Gate Response</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600">
                  {formatTime(performanceMetrics.audioLoadTime)}
                </div>
                <div className="text-sm text-gray-600">Audio Load Time</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-600">
                  {formatTime(performanceMetrics.averageResponseTime)}
                </div>
                <div className="text-sm text-gray-600">Average Response</div>
              </div>
            </div>
          </div>

          {/* Recent Errors */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Recent Errors</h3>
            {recentErrors.length > 0 ? (
              <div className="space-y-2">
                {recentErrors.slice(0, 5).map((error, index) => (
                  <div key={index} className="bg-white rounded p-3 border-l-4 border-red-500">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{error.message}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {error.source} • {new Date(error.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getSeverityColor(error.severity)}`}>
                        {error.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No errors recorded
              </div>
            )}
          </div>

          {/* Cost Metrics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Cost Metrics (Daily)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">
                  {formatCurrency(costMetrics.storageCost)}
                </div>
                <div className="text-sm text-gray-600">Storage Cost</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">
                  {formatCurrency(costMetrics.bandwidthCost)}
                </div>
                <div className="text-sm text-gray-600">Bandwidth Cost</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600">
                  {formatCurrency(costMetrics.requestCost)}
                </div>
                <div className="text-sm text-gray-600">Request Cost</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-600">
                  {formatCurrency(costMetrics.totalCost)}
                </div>
                <div className="text-sm text-gray-600">Total Cost</div>
              </div>
            </div>
          </div>

          {/* Storage Metrics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Storage Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">
                  {storageMetrics.totalSize}
                </div>
                <div className="text-sm text-gray-600">Total Size</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">
                  {storageMetrics.objectCount}
                </div>
                <div className="text-sm text-gray-600">Object Count</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600">
                  {storageMetrics.dailyUpload}
                </div>
                <div className="text-sm text-gray-600">Daily Upload</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-600">
                  {storageMetrics.dailyDownload}
                </div>
                <div className="text-sm text-gray-600">Daily Download</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};