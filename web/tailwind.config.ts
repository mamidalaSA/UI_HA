import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // One palette per role, matched to the reference screenshots' sidebar themes.
        doctor: { DEFAULT: "#0b3d2e", dark: "#082b20", accent: "#16a34a" },
        admin: { DEFAULT: "#0b1f3a", dark: "#081428", accent: "#2563eb" },
        reception: { DEFAULT: "#4c1d95", dark: "#3b0f78", accent: "#7c3aed" },
        nurse: { DEFAULT: "#10182b", dark: "#0a0f1f", accent: "#0ea5e9" },
        lab: { DEFAULT: "#0f2a3d", dark: "#0a1c29", accent: "#0891b2" },
        pharmacy: { DEFAULT: "#1e1b4b", dark: "#15132f", accent: "#6366f1" },
      },
    },
  },
  plugins: [],
} satisfies Config;
