import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FeatureGate from '../../src/components/FeatureGate';

// Mock the hooks
vi.mock('../../src/hooks/useUserTier', () => ({
  useUserTier: vi.fn()
}));

vi.mock('../../src/hooks/useAccessControl', () => ({
  useAccessControl: vi.fn()
}));

import { useUserTier } from '../../src/hooks/useUserTier';
import { useAccessControl } from '../../src/hooks/useAccessControl';

describe('FeatureGate Component', () => {
  const mockUseUserTier = useUserTier as ReturnType<typeof vi.fn>;
  const mockUseAccessControl = useAccessControl as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children for users with access', () => {
    mockUseUserTier.mockReturnValue({
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
    mockUseUserTier.mockReturnValue({
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

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(
      <FeatureGate feature="upload">
        <button>Upload</button>
      </FeatureGate>
    );

    fireEvent.click(screen.getByText('Upload'));
    expect(consoleSpy).toHaveBeenCalledWith('Show signup modal for feature:', 'upload');

    consoleSpy.mockRestore();
  });

  it('should render hidden gate type correctly', () => {
    mockUseUserTier.mockReturnValue({
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
    mockUseUserTier.mockReturnValue({
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

    const disabledElement = screen.getByText('Upload').closest('.feature-gate-disabled');
    expect(disabledElement).toBeInTheDocument();
  });

  it('should call onGateTrigger when gate is triggered', () => {
    mockUseUserTier.mockReturnValue({
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