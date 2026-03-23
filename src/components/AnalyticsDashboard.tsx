import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useAnalytics } from '../hooks/useAnalytics';
import { API_CONFIG, buildApiUrl } from '../config/api';
import { supabase } from '../services/supabase';

interface CreativeMetrics {
  ttfcAvgSeconds?: number;
  creationsPerSessionAvg?: number;
  creativeSessionDurationMinutes?: number;
  exportSaveRatePercent?: number;
  returnToCreateRatePercent?: number;
  totalCreativeSessions?: number;
}

interface CreativeFunnel {
  totalSessions?: number;
  samplerOpened?: number;
  trackLoaded?: number;
  samplerReady?: number;
  firstCreativeAction?: number;
  pctTrackLoaded?: number;
  pctSamplerReady?: number;
  pctFirstCreative?: number;
}

interface EarlyWarning {
  signal: string;
  message: string;
  value: string;
}

interface EarlyWarningsData {
  metrics?: CreativeMetrics;
  warnings?: EarlyWarning[];
}

interface AnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  isOpen,
  onClose
}) => {
  const [creativeMetrics, setCreativeMetrics] = useState<CreativeMetrics | null>(null);
  const [funnelData, setFunnelData] = useState<CreativeFunnel | null>(null);
  const [earlyWarnings, setEarlyWarnings] = useState<EarlyWarning[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState(30);

  const analytics = useAnalytics();
  const [sessionId, setSessionId] = useState('');
  const [retryQueueLength, setRetryQueueLength] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadAnalyticsData();
    }
  }, [isOpen, daysBack]);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - daysBack);
      const params = `?from=${from.toISOString()}&to=${to.toISOString()}`;

      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const [metricsRes, funnelRes, warningsRes] = await Promise.all([
        fetch(buildApiUrl(API_CONFIG.ENDPOINTS.ANALYTICS_CREATIVE_METRICS) + params, { headers }),
        fetch(buildApiUrl(API_CONFIG.ENDPOINTS.ANALYTICS_FUNNEL) + params, { headers }),
        fetch(buildApiUrl(API_CONFIG.ENDPOINTS.ANALYTICS_EARLY_WARNINGS) + `?from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}&to=${to.toISOString()}`, { headers }),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setCreativeMetrics(data);
      }
      if (funnelRes.ok) {
        const data = await funnelRes.json();
        setFunnelData(data);
      }
      if (warningsRes.ok) {
        const data: EarlyWarningsData = await warningsRes.json();
        setEarlyWarnings(data.warnings || []);
      }
      if (!metricsRes.ok || !funnelRes.ok) {
        const err = await metricsRes.json().catch(() => ({}));
        const msg = err?.error || 'Failed to load analytics';
        setError(metricsRes.status === 401 ? 'Sign in required. Admin access needed for analytics.' : msg);
      }

      setSessionId(analytics.getSessionId());
      setRetryQueueLength(analytics.getRetryQueueLength());
    } catch (e) {
      console.error('Failed to load analytics data:', e);
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const formatMetricValue = (value: number | undefined, type: 'percentage' | 'time' | 'number' = 'number') => {
    if (value === undefined || value === null) return '—';
    switch (type) {
      case 'percentage':
        return `${Number(value).toFixed(1)}%`;
      case 'time':
        return `${Number(value).toFixed(1)} min`;
      default:
        return Number(value).toFixed(2);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="analytics-dashboard">
        <div className="dashboard-header">
          <h2>Creative Metrics Dashboard</h2>
          <div className="dashboard-header-actions">
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="days-select"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <button onClick={onClose} className="close-button">✕</button>
          </div>
        </div>

        {error && (
          <div className="analytics-error">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading analytics data...</p>
          </div>
        ) : (
          <div className="dashboard-content">
            {/* Product Health */}
            <div className="metrics-section">
              <h3>Product Health</h3>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{formatMetricValue(creativeMetrics?.ttfcAvgSeconds, 'time')}</div>
                  <div className="metric-label">Avg Time to First Creation</div>
                  <div className="metric-target">Target: &lt; 60 sec</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetricValue(creativeMetrics?.creationsPerSessionAvg, 'number')}</div>
                  <div className="metric-label">Creations per Session</div>
                  <div className="metric-target">Target: 5–20</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetricValue(creativeMetrics?.creativeSessionDurationMinutes, 'time')}</div>
                  <div className="metric-label">Creative Session Duration</div>
                  <div className="metric-target">Target: 15–40 min</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetricValue(creativeMetrics?.exportSaveRatePercent, 'percentage')}</div>
                  <div className="metric-label">Export/Save Rate</div>
                  <div className="metric-target">Target: 10–20%</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetricValue(creativeMetrics?.returnToCreateRatePercent, 'percentage')}</div>
                  <div className="metric-label">7-Day Return-to-Create</div>
                  <div className="metric-target">Target: 20–30%</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{creativeMetrics?.totalCreativeSessions ?? '—'}</div>
                  <div className="metric-label">Creative Sessions</div>
                </div>
              </div>
            </div>

            {/* Creative Funnel */}
            <div className="funnel-section">
              <h3>Creative Funnel</h3>
              <div className="funnel-chart">
                <div className="funnel-stage">
                  <div className="stage-name">Sampler Opened</div>
                  <div className="stage-value">{funnelData?.samplerOpened ?? '—'}</div>
                  <div className="funnel-arrow">↓</div>
                </div>
                <div className="funnel-stage">
                  <div className="stage-name">Track Loaded</div>
                  <div className="stage-value">{funnelData?.trackLoaded ?? '—'}</div>
                  <div className="stage-rate">{funnelData?.pctTrackLoaded != null ? `${funnelData.pctTrackLoaded}%` : ''}</div>
                  <div className="funnel-arrow">↓</div>
                </div>
                <div className="funnel-stage">
                  <div className="stage-name">Sampler Ready</div>
                  <div className="stage-value">{funnelData?.samplerReady ?? '—'}</div>
                  <div className="stage-rate">{funnelData?.pctSamplerReady != null ? `${funnelData.pctSamplerReady}%` : ''}</div>
                  <div className="funnel-arrow">↓</div>
                </div>
                <div className="funnel-stage">
                  <div className="stage-name">First Creative Action</div>
                  <div className="stage-value">{funnelData?.firstCreativeAction ?? '—'}</div>
                  <div className="stage-rate">{funnelData?.pctFirstCreative != null ? `${funnelData.pctFirstCreative}%` : ''}</div>
                </div>
              </div>
            </div>

            {/* Early Warning Signals */}
            {earlyWarnings.length > 0 && (
              <div className="warnings-section">
                <h3>Early Warning Signals</h3>
                <div className="warnings-list">
                  {earlyWarnings.map((w, i) => (
                    <div key={i} className="warning-item">
                      <span className="warning-signal">{w.signal}</span>
                      <span className="warning-message">{w.message}</span>
                      <span className="warning-value">{w.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Session Info (local debug) */}
            <div className="session-info">
              <div className="info-item">
                <span className="info-label">Session ID:</span>
                <span className="info-value">{sessionId}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Retry Queue:</span>
                <span className="info-value">{retryQueueLength} events</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
