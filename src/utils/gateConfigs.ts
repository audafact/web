import { useResponsiveDesign } from '../hooks/useResponsiveDesign';

interface GateConfig {
  gateType: 'lock' | 'overlay' | 'disabled' | 'tooltip' | 'mobile-overlay';
  text?: string;
  tooltip?: string;
}

interface FeatureGateConfigs {
  [feature: string]: {
    mobile: GateConfig;
    tablet: GateConfig;
    desktop: GateConfig;
  };
}

const FEATURE_GATE_CONFIGS: FeatureGateConfigs = {
  upload: {
    mobile: { gateType: 'mobile-overlay', text: 'Tap to upload' },
    tablet: { gateType: 'mobile-overlay', text: 'Click to upload' },
    desktop: { gateType: 'disabled', tooltip: 'Sign up to upload tracks' }
  },
  save_session: {
    mobile: { gateType: 'mobile-overlay', text: 'Tap to save' },
    tablet: { gateType: 'mobile-overlay', text: 'Click to save' },
    desktop: { gateType: 'disabled', tooltip: 'Sign up to save session' }
  },
  edit_cues: {
    mobile: { gateType: 'overlay', text: 'Tap to customize' },
    tablet: { gateType: 'overlay', text: 'Click to customize' },
    desktop: { gateType: 'lock', tooltip: 'Sign up to edit cue points' }
  },
  add_library_track: {
    mobile: { gateType: 'mobile-overlay', text: 'Tap to add' },
    tablet: { gateType: 'mobile-overlay', text: 'Click to add' },
    desktop: { gateType: 'lock', tooltip: 'Sign up to add tracks to studio' }
  },
  download_track: {
    mobile: { gateType: 'mobile-overlay', text: 'Tap to download' },
    tablet: { gateType: 'mobile-overlay', text: 'Click to download' },
    desktop: { gateType: 'disabled', tooltip: 'Sign up to download tracks' }
  },
  record_audio: {
    mobile: { gateType: 'overlay', text: 'Tap to record' },
    tablet: { gateType: 'overlay', text: 'Click to record' },
    desktop: { gateType: 'lock', tooltip: 'Sign up to record audio' }
  },
  advanced_effects: {
    mobile: { gateType: 'overlay', text: 'Tap for effects' },
    tablet: { gateType: 'overlay', text: 'Click for effects' },
    desktop: { gateType: 'lock', tooltip: 'Sign up for advanced effects' }
  },
  export_project: {
    mobile: { gateType: 'mobile-overlay', text: 'Tap to export' },
    tablet: { gateType: 'mobile-overlay', text: 'Click to export' },
    desktop: { gateType: 'disabled', tooltip: 'Sign up to export projects' }
  }
};

export const getGateConfigForScreen = (feature: string): GateConfig => {
  const { isMobile, isTablet } = useResponsiveDesign();
  
  const config = FEATURE_GATE_CONFIGS[feature];
  if (!config) {
    return { gateType: 'lock' };
  }
  
  if (isMobile) return config.mobile;
  if (isTablet) return config.tablet;
  return config.desktop;
};

export const getGateConfigForFeature = (feature: string, screenSize: 'mobile' | 'tablet' | 'desktop'): GateConfig => {
  const config = FEATURE_GATE_CONFIGS[feature];
  if (!config) {
    return { gateType: 'lock' };
  }
  
  return config[screenSize];
};

export const getAllGateConfigs = (): FeatureGateConfigs => {
  return FEATURE_GATE_CONFIGS;
};

export const addGateConfig = (feature: string, config: {
  mobile: GateConfig;
  tablet: GateConfig;
  desktop: GateConfig;
}) => {
  FEATURE_GATE_CONFIGS[feature] = config;
};

export const removeGateConfig = (feature: string) => {
  delete FEATURE_GATE_CONFIGS[feature];
}; 