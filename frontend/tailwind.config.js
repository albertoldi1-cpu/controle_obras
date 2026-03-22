/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        ink: { 950: "#0a0e17", 900: "#0f1629", 800: "#151d32", 700: "#1e2a44" },
        accent: { DEFAULT: "#3d8bfd", glow: "#5eb0ff", muted: "#2a5a9e" },
        signal: { ok: "#34d399", warn: "#fbbf24", bad: "#f87171" },
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.35)",
        lift: "0 20px 50px rgba(61, 139, 253, 0.12)",
      },
      backgroundImage: {
        mesh: "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(61,139,253,0.25), transparent), radial-gradient(ellipse 60% 50% at 100% 20%, rgba(52,211,153,0.12), transparent), radial-gradient(ellipse 50% 40% at 50% 100%, rgba(251,191,36,0.08), transparent)",
      },
    },
  },
  plugins: [],
};
