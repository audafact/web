import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerformanceDashboard } from '../../src/components/PerformanceDashboard';
import { EnhancedAnalyticsService } from '../../src/services/enhancedAnalyticsService';
import { PerformanceMonitor } from '../../src/services/performanceMonitor';
import { ErrorMonitor } from '../../src/services/errorMonitor';

// Mock the services
vi.mock('../../src/services/enhancedAnalyticsService');
vi.mock('../../src/components/Modal', () => ({
  Modal: ({ children, isOpen, onClose }: any) => 
    isOpen ? (
      <div data-testid="modal">
        <button onClick={onClose} data-testid="close-button">Close</button>
        {children}
      </div>
    ) : null
}));

describe('Performance Dashboard', () => {
  const mockAnalytics = {
    getPerformanceMetrics: vi.fn(),
    getErrors: vi.fn(),
    getHealthStatus: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (EnhancedAnalyticsService.getInstance as any).mockReturnValue(mockAnalytics);
    
    // Mock performance metrics
    mockAnalytics.getPerformanceMetrics.mockReturnValue([
      { metric: 'demoLoadTime', value: 150, timestamp: Date.now() },
      { metric: 'featureGateResponseTime', value: 75, timestamp: Date.now() },
      { metric: 'audioLoadTime', value: 200, timestamp: Date.now() },
      { metric: 'timeToInteractive', value: 300, timestamp: Date.now() }
    ]);
    
    // Mock errors
    mockAnalytics.getErrors.mockReturnValue([
      {
        id: 'error1',
        message: 'Test error 1',
        severity: 'high',
        timestamp: Date.now(),
        context: { currentRoute: '/studio' }
      },
      {
        id: 'error2',
        message: 'Test error 2',
        severity: 'medium',
        timestamp: Date.now(),
        context: { currentRoute: '/pricing' }
      }
    ]);
    
    // Mock health status
    mockAnalytics.getHealthStatus.mockReturnValue({
      isOnline: true,
      pendingEvents: 5,
      errorRate: 2
    });
  });

  it('should render when visible', () => {
    render(
      <PerformanceDashboard 
        isVisible={true} 
        onClose={vi.fn()} 
      />
    );

    expect(screen.getByText('Performance & Error Dashboard')).toBeInTheDocument();
    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
    expect(screen.getByText('Recent Errors')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(
      <PerformanceDashboard 
        isVisible={false} 
        onClose={vi.fn()} 
      />
    );

    expect(screen.queryByText('Performance & Error Dashboard')).not.toBeInTheDocument();
  });

  it('should display health status correctly', () => {
    render(
      <PerformanceDashboard 
        isVisible={true} 
        onClose={vi.fn()} 
      />
    );

    expect(screen.getByText('🟢 Online')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // pending events
    expect(screen.getByText('2')).toBeInTheDocument(); // error rate
  });

  it('should display performance metrics correctly', () => {
    render(
      <PerformanceDashboard 
        isVisible={true} 
        onClose={vi.fn()} 
      />
    );

    expect(screen.getByText('150.00ms')).toBeInTheDocument(); // demo load time
    expect(screen.getByText('75.00ms')).toBeInTheDocument(); // feature gate response
    expect(screen.getByText('200.00ms')).toBeInTheDocument(); // audio load time
    expect(screen.getByText('300.00ms')).toBeInTheDocument(); // time to interactive
  });

  it('should display recent errors correctly', () => {
    render(
      <PerformanceDashboard 
        isVisible={true} 
        onClose={vi.fn()} 
      />
    );

    expect(screen.getByText('Test error 1')).toBeInTheDocument();
    expect(screen.getByText('Test error 2')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('/studio')).toBeInTheDocument();
    expect(screen.getByText('/pricing')).toBeInTheDocument();
  });

  it('should show "No errors recorded" when no errors exist', () => {
    mockAnalytics.getErrors.mockReturnValue([]);

    render(
      <PerformanceDashboard 
        isVisible={true} 
        onClose={vi.fn()} 
      />
    );

    expect(screen.getByText('No errors recorded')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    
    render(
      <PerformanceDashboard 
        isVisible={true} 
        onClose={onClose} 
      />
    );

    fireEvent.click(screen.getByTestId('close-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should fetch data when becoming visible', () => {
    const { rerender } = render(
      <PerformanceDashboard 
        isVisible={false} 
        onClose={vi.fn()} 
      />
    );

    // Should not fetch when not visible
    expect(mockAnalytics.getPerformanceMetrics).not.toHaveBeenCalled();

    // Make visible
    rerender(
      <PerformanceDashboard 
        isVisible={true} 
        onClose={vi.fn()} 
      />
    );

    // Should fetch when becoming visible
    expect(mockAnalytics.getPerformanceMetrics).toHaveBeenCalled();
    expect(mockAnalytics.getErrors).toHaveBeenCalled();
    expect(mockAnalytics.getHealthStatus).toHaveBeenCalled();
  });

  it('should handle offline status correctly', () => {
    mockAnalytics.getHealthStatus.mockReturnValue({
      isOnline: false,
      pendingEvents: 10,
      errorRate: 5
    });

    render(
      <PerformanceDashboard 
        isVisible={true} 
        onClose={vi.fn()} 
      />
    );

    expect(screen.getByText('🔴 Offline')).toBeInTheDocument();
  });

  it('should calculate average metrics correctly', () => {
    // Mock multiple metrics for the same type
    mockAnalytics.getPerformanceMetrics.mockReturnValue([
      { metric: 'demoLoadTime', value: 100, timestamp: Date.now() },
      { metric: 'demoLoadTime', value: 200, timestamp: Date.now() },
      { metric: 'demoLoadTime', value: 300, timestamp: Date.now() }
    ]);

    render(
      <PerformanceDashboard 
        isVisible={true} 
        onClose={vi.fn()} 
      />
    );

    // Should show average: (100 + 200 + 300) / 3 = 200
    expect(screen.getByText('200.00ms')).toBeInTheDocument();
  });

  it('should handle zero metrics gracefully', () => {
    mockAnalytics.getPerformanceMetrics.mockReturnValue([]);

    render(
      <PerformanceDashboard 
        isVisible={true} 
        onClose={vi.fn()} 
      />
    );

    // Should show 0.00ms for all metrics
    expect(screen.getAllByText('0.00ms')).toHaveLength(4);
  });
}); 