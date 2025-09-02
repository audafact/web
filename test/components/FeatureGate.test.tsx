import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FeatureGate from '../../src/components/FeatureGate';

// Mock the hooks
vi.mock('../../src/hooks/useUser', () => ({
  useUser: vi.fn()
}));

vi.mock('../../src/hooks/useAccessControl', () => ({
  useAccessControl: vi.fn()
}));

// Mock the signup modal hook
vi.mock('../../src/hooks/useSignupModal', () => ({
  showSignupModal: vi.fn()
}));

// Mock the analytics service
vi.mock('../../src/services/analyticsService', () => ({
  trackEvent: vi.fn()
}));

// Mock the VisualFeatureGate component
vi.mock('../../src/components/VisualFeatureGate', () => ({
  default: ({ children, onClick }: any) => (
    <div className="visual-feature-gate" onClick={onClick}>
      {children}
    </div>
  )
}));

// Mock the gate configs utility
vi.mock('../../src/utils/gateConfigs', () => ({
  getGateConfigForScreen: vi.fn(() => ({
    gateType: 'modal',
    tooltip: 'Upgrade to access this feature'
  }))
}));

// Mock the access service
vi.mock('../../src/services/accessService', () => ({
  EnhancedAccessService: {
    getFeatureGateConfig: vi.fn(() => ({
      message: 'Upgrade to access this feature'
    }))
  }
}));

import { useUser } from '../../src/hooks/useUser';
import { useAccessControl } from '../../src/hooks/useAccessControl';
import { showSignupModal } from '../../src/hooks/useSignupModal';

describe('FeatureGate Component', () => {
  const mockuseUser = useUser as ReturnType<typeof vi.fn>;
  const mockUseAccessControl = useAccessControl as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children for users with access', () => {
    mockuseUser.mockReturnValue({
      tier: { id: 'pro', name: 'Pro Creator', features: {}, limits: {} },
      isGuest: false,
      isFree: false,
      isPro: true,
      features: { canUpload: true },
      limits: {}
    });

    mockUseAccessControl.mockReturnValue({
      canAccessFeature: vi.fn().mockReturnValue(true),
      accessStatus: null,
      loading: false,
      refreshAccessStatus: vi.fn(),
      canPerformAction: vi.fn(),
      getUpgradeMessage: vi.fn(),
      tier: { id: 'pro', name: 'Pro Creator', features: {}, limits: {} }
    });

    render(
      <FeatureGate feature="upload">
        <button>Upload</button>
      </FeatureGate>
    );

    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('should show modal gate for users without access', () => {
    mockuseUser.mockReturnValue({
      tier: { id: 'guest', name: 'Guest', features: {}, limits: {} },
      isGuest: true,
      isFree: false,
      isPro: false,
      features: { canUpload: false },
      limits: {}
    });

    mockUseAccessControl.mockReturnValue({
      canAccessFeature: vi.fn().mockReturnValue(false),
      accessStatus: null,
      loading: false,
      refreshAccessStatus: vi.fn(),
      canPerformAction: vi.fn(),
      getUpgradeMessage: vi.fn(),
      tier: { id: 'guest', name: 'Guest', features: {}, limits: {} }
    });

    render(
      <FeatureGate feature="upload">
        <button>Upload</button>
      </FeatureGate>
    );

    fireEvent.click(screen.getByText('Upload'));
    expect(showSignupModal).toHaveBeenCalledWith('upload');
  });

  it('should render hidden gate type correctly', () => {
    mockuseUser.mockReturnValue({
      tier: { id: 'guest', name: 'Guest', features: {}, limits: {} },
      isGuest: true,
      isFree: false,
      isPro: false,
      features: { canUpload: false },
      limits: {}
    });

    mockUseAccessControl.mockReturnValue({
      canAccessFeature: vi.fn().mockReturnValue(false),
      accessStatus: null,
      loading: false,
      refreshAccessStatus: vi.fn(),
      canPerformAction: vi.fn(),
      getUpgradeMessage: vi.fn(),
      tier: { id: 'guest', name: 'Guest', features: {}, limits: {} }
    });

    const { container } = render(
      <FeatureGate feature="upload" gateType="hidden">
        <button>Upload</button>
      </FeatureGate>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render disabled gate type correctly', () => {
    mockuseUser.mockReturnValue({
      tier: { id: 'guest', name: 'Guest', features: {}, limits: {} },
      isGuest: true,
      isFree: false,
      isPro: false,
      features: { canUpload: false },
      limits: {}
    });

    mockUseAccessControl.mockReturnValue({
      canAccessFeature: vi.fn().mockReturnValue(false),
      accessStatus: null,
      loading: false,
      refreshAccessStatus: vi.fn(),
      canPerformAction: vi.fn(),
      getUpgradeMessage: vi.fn(),
      tier: { id: 'guest', name: 'Guest', features: {}, limits: {} }
    });

    render(
      <FeatureGate feature="upload" gateType="disabled">
        <button>Upload</button>
      </FeatureGate>
    );

    const disabledElement = screen.getByText('Upload').closest('.visual-feature-gate');
    expect(disabledElement).toBeInTheDocument();
  });

  it('should call onGateTrigger when gate is triggered', () => {
    mockuseUser.mockReturnValue({
      tier: { id: 'guest', name: 'Guest', features: {}, limits: {} },
      isGuest: true,
      isFree: false,
      isPro: false,
      features: { canUpload: false },
      limits: {}
    });

    mockUseAccessControl.mockReturnValue({
      canAccessFeature: vi.fn().mockReturnValue(false),
      accessStatus: null,
      loading: false,
      refreshAccessStatus: vi.fn(),
      canPerformAction: vi.fn(),
      getUpgradeMessage: vi.fn(),
      tier: { id: 'guest', name: 'Guest', features: {}, limits: {} }
    });

    const onGateTrigger = vi.fn();

    render(
      <FeatureGate feature="upload" onGateTrigger={onGateTrigger}>
        <button>Upload</button>
      </FeatureGate>
    );

    fireEvent.click(screen.getByText('Upload'));
    expect(onGateTrigger).toHaveBeenCalledWith('upload');
  });
}); 