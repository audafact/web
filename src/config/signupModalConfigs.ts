export interface SignupModalConfig {
  title: string;
  message: string;
  benefits: string[];
  ctaText: string;
  redirectAction?: string;
  upgradeRequired?: boolean;
}

export const SIGNUP_MODAL_CONFIGS: Record<string, SignupModalConfig> = {
  upload: {
    title: "🎧 Ready to remix your own sounds?",
    message: "Upload your own tracks and create unique mixes",
    benefits: [
      "Upload unlimited tracks",
      "Save your sessions",
      "Explore available sounds",
      "Sync across devices"
    ],
    ctaText: "Sign up to upload tracks",
    redirectAction: 'upload'
  },
  
  save_session: {
    title: "Create a free account to keep your work",
    message: "Save your session and pick up where you left off on any device.",
    benefits: [
      "Save sessions",
      "Multiple tracks & uploads",
      "MP3 export",
      "Access available sounds"
    ],
    ctaText: "Create free account",
    redirectAction: 'save_session'
  },

  add_second_source: {
    title: "Create a free account to keep your work",
    message: "Add more tracks, save sessions, and export your flips.",
    benefits: [
      "Multiple sources in the studio",
      "Save sessions",
      "MP3 export",
      "Available sounds"
    ],
    ctaText: "Create free account",
    redirectAction: 'add_second_source'
  },
  
  add_library_track: {
    title: "🎵 Expand your library",
    message: "Add tracks from the catalog to your studio",
    benefits: [
      "Access available tracks",
      "Multiple genres and BPMs",
      "High-quality audio files",
      "More sounds added during beta"
    ],
    ctaText: "Sign up to add tracks",
    redirectAction: 'add_library_track'
  },
  
  edit_cues: {
    title: "🎯 Customize your cues",
    message: "Set precise cue points for perfect transitions",
    benefits: [
      "Custom cue point placement",
      "Precise timing control",
      "Save cue configurations",
      "Share cue setups"
    ],
    ctaText: "Sign up to edit cues",
    redirectAction: 'edit_cues'
  },
  
  edit_loops: {
    title: "🔄 Perfect your loops",
    message: "Create seamless loops with custom start/end points",
    benefits: [
      "Custom loop regions",
      "Seamless transitions",
      "Save loop configurations",
      "Export loop settings"
    ],
    ctaText: "Sign up to edit loops",
    redirectAction: 'edit_loops'
  },
  
  record: {
    title: "Record your performance",
    message: "Create a free account to record and export your live mixes.",
    benefits: [
      "Record performances",
      "MP3 export",
      "Save sessions",
      "More uploads"
    ],
    ctaText: "Create free account",
    redirectAction: 'record',
    upgradeRequired: false
  },
  
  download: {
    title: "💿 Download your work",
    message: "Export your recordings in high quality",
    benefits: [
      "Multiple export formats",
      "High-quality audio",
      "No watermarks",
      "Commercial use rights"
    ],
    ctaText: "Upgrade to Pro Creator",
    redirectAction: 'download',
    upgradeRequired: true
  }
}; 