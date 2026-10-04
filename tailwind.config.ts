import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm coral/cocoa palette, referenced from the GiftDrop design reference.
        rose: { DEFAULT: "#D9663F", 50: "#F6E3D7" },
        blush: "#F6E3D7",
        ink: "#3B2A22",
        muted: "#8A7A6E",
        border: "#E8DED1",
        background: "#FFFBF6",
        foreground: "#3B2A22",
        primary: { DEFAULT: "#D9663F", foreground: "#FFFBF6" },
        secondary: { DEFAULT: "#F6E3D7", foreground: "#7A4A36" },
        destructive: { DEFAULT: "#C0392B", foreground: "#FFFFFF" },
        accent: { DEFAULT: "#F6E3D7", foreground: "#7A4A36" },
        card: { DEFAULT: "#FFFFFF", foreground: "#3B2A22" },
        input: "#E8DED1",
        ring: "#D9663F"
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"]
      },
      maxWidth: {
        phone: "480px"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};
export default config;
