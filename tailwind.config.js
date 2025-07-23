/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Audafact Brand Colors - Updated with midnight blue tones
        audafact: {
          // Primary Background - Very dark midnight blue
          "bg-primary": "#0A0D14",
          // Surface Elevation 1 (Cards/Panels) - Dark midnight blue
          "surface-1": "#111827",
          // Surface Elevation 1 Enhanced (Cards with better contrast)
          "surface-1-enhanced": "#1A1F2E",
          // Surface Elevation 2 (Button hover/Dropdown background) - Medium midnight blue
          "surface-2": "#1F2937",
          // Accent Cyan (Waveform lines, progress bars, cue overlays) - Brighter cyan
          "accent-cyan": "#00F5C3",
          // Accent Blue (Secondary action highlight) - Bright blue
          "accent-blue": "#008CFF",
          // Text Primary (Main white/off-white text) - Pure white
          "text-primary": "#FFFFFF",
          // Text Secondary (Descriptive subtext/labels) - Lighter gray
          "text-secondary": "#8B949E",
          // Divider Line (Subtle separators/waveform grids) - Darker midnight blue
          divider: "#374151",
          // Alert Red (Errors, notifications) - Bright red
          "alert-red": "#FF4D4F",
        },
      },
      fontFamily: {
        inter: ["Inter", "sans-serif"],
        poppins: ["Poppins", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        "card-hover":
          "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      },
      letterSpacing: {
        "tool-name": "0.025em",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
