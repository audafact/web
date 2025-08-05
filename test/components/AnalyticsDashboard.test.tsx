import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalyticsDashboard } from '../../src/components/AnalyticsDashboard';
import { FUNNEL_STAGES } from '../../src/services/analyticsService';

// Mock the analytics hook
vi.mock('../../src/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    getFunnelConversionRate: vi.fn(() => ({
      'Demo Started': 100,
      'Feature Interaction': 75,
      'Gate Clicked': 50,
      'Signup Modal Shown': 30,
      'Signup Completed': 15,
      'Upgrade Clicked': 10,
      'Upgrade Completed': 5
    })),
    getRetryQueueLength: vi.fn(() => 3),
    getSessionId: vi.fn(() => 'session_1234567890_abc123'),
    getAverageMetric: vi.fn(() => 2.5)
  })
}));

// Mock the Modal component
vi.mock('../../src/components/Modal', () => ({
  Modal: ({ children, isOpen, onClose }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal">
        <div data-testid="modal-content">
          {children}
        </div>
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }
}));

describe('AnalyticsDashboard', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    
    expect(screen.getByText('📊 Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<AnalyticsDashboard isOpen={false} onClose={vi.fn()} />);
    
    expect(screen.queryByText('📊 Analytics Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('should display session information', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    
    expect(screen.getByText('Session ID:')).toBeInTheDocument();
    expect(screen.getByText('session_1234567890_abc123')).toBeInTheDocument();
    expect(screen.getByText('Retry Queue:')).toBeInTheDocument();
    expect(screen.getByText('3 events')).toBeInTheDocument();
    expect(screen.getByText('Avg Load Time:')).toBeInTheDocument();
    expect(screen.getByText('2.5min')).toBeInTheDocument();
  });

  it('should display conversion funnel', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    
    expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
    
    // Check that all funnel stages are displayed
    FUNNEL_STAGES.forEach(stage => {
      expect(screen.getByText(stage.name)).toBeInTheDocument();
    });
    
    // Check conversion rates
    expect(screen.getByText('100.0%')).toBeInTheDocument(); // Demo Started
    expect(screen.getByText('75.0%')).toBeInTheDocument();  // Feature Interaction
    expect(screen.getByText('50.0%')).toBeInTheDocument();  // Gate Clicked
    expect(screen.getByText('30.0%')).toBeInTheDocument();  // Signup Modal Shown
    expect(screen.getByText('15.0%')).toBeInTheDocument();  // Signup Completed
    expect(screen.getByText('10.0%')).toBeInTheDocument();  // Upgrade Clicked
    expect(screen.getByText('5.0%')).toBeInTheDocument();   // Upgrade Completed
  });

  it('should display key metrics', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    
    expect(screen.getByText('Key Metrics')).toBeInTheDocument();
    
    // Check metric cards
    expect(screen.getByText('15.2%')).toBeInTheDocument(); // Demo to Signup
    expect(screen.getByText('Demo to Signup')).toBeInTheDocument();
    
    expect(screen.getByText('8.7%')).toBeInTheDocument(); // Signup to Pro
    expect(screen.getByText('Signup to Pro')).toBeInTheDocument();
    
    expect(screen.getByText('3.2min')).toBeInTheDocument(); // Avg Demo Session
    expect(screen.getByText('Avg Demo Session')).toBeInTheDocument();
    
    expect(screen.getByText('32.1%')).toBeInTheDocument(); // Feature Gate CTR
    expect(screen.getByText('Feature Gate CTR')).toBeInTheDocument();
  });

  it('should display recent events', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    
    expect(screen.getByText('Recent Analytics Events')).toBeInTheDocument();
    
    // Check event items
    expect(screen.getByText('demo_track_loaded')).toBeInTheDocument();
    expect(screen.getByText('feature_gate_clicked')).toBeInTheDocument();
    expect(screen.getByText('signup_completed')).toBeInTheDocument();
    
    expect(screen.getByText('Guest User')).toBeInTheDocument();
    expect(screen.getByText('New User')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<AnalyticsDashboard isOpen={true} onClose={onClose} />);
    
    const closeButton = screen.getByTestId('modal-close');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should show loading state initially', async () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    
    // Should show loading spinner initially
    expect(screen.getByText('Loading analytics data...')).toBeInTheDocument();
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
    });
  });

  it('should format metric values correctly', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    
    // Wait for loading to complete
    waitFor(() => {
      // Check percentage formatting
      expect(screen.getByText('15.2%')).toBeInTheDocument();
      expect(screen.getByText('8.7%')).toBeInTheDocument();
      
      // Check time formatting
      expect(screen.getByText('3.2min')).toBeInTheDocument();
      expect(screen.getByText('2.5min')).toBeInTheDocument();
    });
  });

  it('should handle error state gracefully', async () => {
    // Mock console.error to prevent test output noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock useAnalytics to throw an error
    vi.mocked(require('../../src/hooks/useAnalytics').useAnalytics).mockImplementation(() => ({
      getFunnelConversionRate: vi.fn(() => {
        throw new Error('Failed to load analytics data');
      }),
      getRetryQueueLength: vi.fn(() => 0),
      getSessionId: vi.fn(() => ''),
      getAverageMetric: vi.fn(() => 0)
    }));
    
    render(<AnalyticsDashboard {...defaultProps} />);
    
    // Should still render without crashing
    expect(screen.getByText('📊 Analytics Dashboard')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('should display funnel arrows between stages', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    
    // Check that funnel arrows are present
    const arrows = screen.getAllByText('↓');
    expect(arrows).toHaveLength(FUNNEL_STAGES.length - 1); // One less arrow than stages
  });

  it('should have proper accessibility attributes', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    
    // Check that the close button is accessible
    const closeButton = screen.getByTestId('modal-close');
    expect(closeButton).toBeInTheDocument();
    
    // Check that headings are properly structured
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument(); // Dashboard title
    const h3Elements = screen.getAllByRole('heading', { level: 3 });
    expect(h3Elements).toHaveLength(4); // Conversion Funnel, Key Metrics, Recent Analytics Events
  });
}); 