/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        display: ["PlayfairDisplay_700Bold", "serif"],
      },
      colors: {
        border: "hsl(180 15% 88%)",
        input: "hsl(180 15% 88%)",
        ring: "hsl(168 50% 35%)",
        background: "hsl(180 20% 98%)",
        foreground: "hsl(180 25% 15%)",
        primary: {
          DEFAULT: "hsl(168 50% 35%)",
          foreground: "hsl(0 0% 100%)",
        },
        secondary: {
          DEFAULT: "hsl(180 15% 92%)",
          foreground: "hsl(180 25% 20%)",
        },
        destructive: {
          DEFAULT: "hsl(0 84.2% 60.2%)",
          foreground: "hsl(210 40% 98%)",
        },
        muted: {
          DEFAULT: "hsl(180 10% 94%)",
          foreground: "hsl(180 10% 45%)",
        },
        accent: {
          DEFAULT: "hsl(195 70% 45%)",
          foreground: "hsl(0 0% 100%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(180 25% 15%)",
        },
      },
    },
  },
  plugins: [],
};
