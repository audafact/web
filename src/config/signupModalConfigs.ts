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
      "Access full library",
      "Sync across devices"
    ],
    ctaText: "Sign up to upload tracks",
    redirectAction: 'upload'
  },
  
  save_session: {
    title: "💾 Don't lose your work",
    message: "Save your session and pick up where you left off",
    benefits: [
      "Save unlimited sessions",
      "Sync across devices",
      "Share with others",
      "Version history"
    ],
    ctaText: "Sign up to save session",
    redirectAction: 'save_session'
  },
  
  add_library_track: {
    title: "🎵 Expand your library",
    message: "Add tracks from our curated collection to your studio",
    benefits: [
      "Access 100+ curated tracks",
      "Multiple genres and BPMs",
      "High-quality audio files",
      "Regular new additions"
    ],
    ctaText: "Sign up to browse library",
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
    title: "🎙 Record your performances",
    message: "Capture and export your live mixing sessions",
    benefits: [
      "Record unlimited sessions",
      "Export to multiple formats",
      "Share performances",
      "Professional quality"
    ],
    ctaText: "Upgrade to Pro Creator",
    redirectAction: 'record',
    upgradeRequired: true
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