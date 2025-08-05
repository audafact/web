import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import VisualFeatureGate from '../../src/components/VisualFeatureGate';
import { useUserTier } from '../../src/hooks/useUserTier';
import { useAccessControl } from '../../src/hooks/useAccessControl';
import { useResponsiveDesign } from '../../src/hooks/useResponsiveDesign';
import { showSignupModal } from '../../src/hooks/useSignupModal';
import { trackEvent } from '../../src/services/analyticsService';

// Mock the hooks
vi.mock('../../src/hooks/useUserTier');
vi.mock('../../src/hooks/useAccessControl');
vi.mock('../../src/hooks/useResponsiveDesign');
vi.mock('../../src/hooks/useSignupModal');
vi.mock('../../src/services/analyticsService');

const mockUseUserTier = useUserTier as vi.MockedFunction<typeof useUserTier>;
const mockUseAccessControl = useAccessControl as vi.MockedFunction<typeof useAccessControl>;
const mockUseResponsiveDesign = useResponsiveDesign as vi.MockedFunction<typeof useResponsiveDesign>;
const mockShowSignupModal = showSignupModal as vi.MockedFunction<typeof showSignupModal>;
const mockTrackEvent = trackEvent as vi.MockedFunction<typeof trackEvent>;

describe('VisualFeatureGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockUseUserTier.mockReturnValue({ tier: 'free' });
    mockUseAccessControl.mockReturnValue({
      canAccessFeature: vi.fn().mockReturnValue(false),
      getFeatureConfig: vi.fn(),
      isFeatureEnabled: vi.fn()
    });
    mockUseResponsiveDesign.mockReturnValue({
      screenSize: { width: 1200, height: 800 },
      breakpoints: { isMobile: false, isTablet: false, isDesktop: true },
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      BREAKPOINTS: { mobile: 768, tablet: 1024, desktop: 1200 }
    });
  });

  it('should render children when user has access', () => {
    mockUseAccessControl.mockReturnValue({
      canAccessFeature: vi.fn().mockReturnValue(true),
      getFeatureConfig: vi.fn(),
      isFeatureEnabled: vi.fn()
    });

    render(
      <VisualFeatureGate feature="test_feature" gateType="lock">
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    expect(screen.getByText('Test Button')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign up to unlock/i })).not.toBeInTheDocument();
  });

  it('should render lock gate when user does not have access', () => {
    render(
      <VisualFeatureGate feature="test_feature" gateType="lock">
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    const gatedButton = screen.getByRole('button', { name: /sign up to unlock test_feature/i });
    expect(gatedButton).toBeInTheDocument();
    expect(gatedButton).toHaveClass('locked-feature');
  });

  it('should render overlay gate correctly', () => {
    render(
      <VisualFeatureGate feature="test_feature" gateType="overlay">
        <div className="test-component">Test Component</div>
      </VisualFeatureGate>
    );

    expect(screen.getByText('Test Component')).toBeInTheDocument();
    expect(screen.getByText('🔒')).toBeInTheDocument();
    expect(screen.getByText('Sign up to unlock')).toBeInTheDocument();
  });

  it('should render disabled gate correctly', () => {
    render(
      <VisualFeatureGate feature="test_feature" gateType="disabled">
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    const gatedButton = screen.getByRole('button', { name: /sign up to unlock test_feature/i });
    expect(gatedButton).toHaveClass('disabled-button');
  });

  it('should show tooltip on hover for lock gate', async () => {
    render(
      <VisualFeatureGate 
        feature="test_feature" 
        gateType="lock"
        tooltipText="Custom tooltip text"
      >
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    const gatedButton = screen.getByRole('button', { name: /sign up to unlock test_feature/i });
    fireEvent.mouseEnter(gatedButton);

    await waitFor(() => {
      expect(screen.getByText('Custom tooltip text')).toBeInTheDocument();
    });
  });

  it('should handle click events correctly', () => {
    render(
      <VisualFeatureGate feature="test_feature" gateType="lock">
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    const gatedButton = screen.getByRole('button', { name: /sign up to unlock test_feature/i });
    fireEvent.click(gatedButton);

    expect(mockShowSignupModal).toHaveBeenCalledWith('test_feature');
    expect(mockTrackEvent).toHaveBeenCalledWith('gate_clicked', {
      feature: 'test_feature',
      gateType: 'lock',
      userTier: 'free',
      screenSize: 'desktop'
    });
  });

  it('should handle custom onClick handler', () => {
    const customHandler = vi.fn();
    
    render(
      <VisualFeatureGate 
        feature="test_feature" 
        gateType="lock"
        onClick={customHandler}
      >
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    const gatedButton = screen.getByRole('button', { name: /sign up to unlock test_feature/i });
    fireEvent.click(gatedButton);

    expect(customHandler).toHaveBeenCalled();
    expect(mockShowSignupModal).not.toHaveBeenCalled();
  });

  it('should handle keyboard events correctly', () => {
    render(
      <VisualFeatureGate feature="test_feature" gateType="lock">
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    const gatedButton = screen.getByRole('button', { name: /sign up to unlock test_feature/i });
    fireEvent.keyDown(gatedButton, { key: 'Enter' });

    expect(mockShowSignupModal).toHaveBeenCalledWith('test_feature');
  });

  it('should render mobile overlay on mobile devices', () => {
    mockUseResponsiveDesign.mockReturnValue({
      screenSize: { width: 375, height: 667 },
      breakpoints: { isMobile: true, isTablet: false, isDesktop: false },
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      BREAKPOINTS: { mobile: 768, tablet: 1024, desktop: 1200 }
    });

    render(
      <VisualFeatureGate feature="test_feature" gateType="mobile-overlay">
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    expect(screen.getByText('Tap to unlock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up to unlock test_feature/i })).toBeInTheDocument();
  });

  it('should render tablet overlay on tablet devices', () => {
    mockUseResponsiveDesign.mockReturnValue({
      screenSize: { width: 768, height: 1024 },
      breakpoints: { isMobile: false, isTablet: true, isDesktop: false },
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      BREAKPOINTS: { mobile: 768, tablet: 1024, desktop: 1200 }
    });

    render(
      <VisualFeatureGate feature="test_feature" gateType="mobile-overlay">
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    expect(screen.getByText('Click to unlock')).toBeInTheDocument();
  });

  it('should fallback to lock gate on desktop for mobile-overlay type', () => {
    render(
      <VisualFeatureGate feature="test_feature" gateType="mobile-overlay">
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    const gatedButton = screen.getByRole('button', { name: /sign up to unlock test_feature/i });
    expect(gatedButton).toHaveClass('locked-feature');
  });

  it('should apply custom className', () => {
    render(
      <VisualFeatureGate 
        feature="test_feature" 
        gateType="lock"
        className="custom-class"
      >
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    const gatedButton = screen.getByRole('button', { name: /sign up to unlock test_feature/i });
    expect(gatedButton).toHaveClass('custom-class');
  });

  it('should handle different tooltip positions', async () => {
    render(
      <VisualFeatureGate 
        feature="test_feature" 
        gateType="lock"
        tooltipText="Test tooltip"
        tooltipPosition="bottom"
      >
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    const gatedButton = screen.getByRole('button', { name: /sign up to unlock test_feature/i });
    fireEvent.mouseEnter(gatedButton);

    await waitFor(() => {
      const tooltip = screen.getByText('Test tooltip');
      expect(tooltip).toHaveClass('tooltip-bottom');
    });
  });

  it('should respect tooltip delay', async () => {
    vi.useFakeTimers();

    render(
      <VisualFeatureGate 
        feature="test_feature" 
        gateType="lock"
        tooltipText="Test tooltip"
        tooltipDelay={100}
      >
        <button>Test Button</button>
      </VisualFeatureGate>
    );

    const gatedButton = screen.getByRole('button', { name: /sign up to unlock test_feature/i });
    
    act(() => {
      fireEvent.mouseEnter(gatedButton);
    });

    // Tooltip should not be visible immediately
    expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(screen.getByText('Test tooltip')).toBeInTheDocument();
    });

    vi.useRealTimers();
  });
}); 