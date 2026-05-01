/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        // Editorial serif for display moments — gravitas, weather-report feel
        display: ["InstrumentSerif_400Regular"],
        "display-italic": ["InstrumentSerif_400Regular_Italic"],
        // UI sans — humanist grotesque, characterful but legible
        sans: ["InstrumentSans_400Regular"],
        "sans-medium": ["InstrumentSans_500Medium"],
        "sans-semibold": ["InstrumentSans_600SemiBold"],
        "sans-bold": ["InstrumentSans_700Bold"],
        // Data/numeric — instrument panel feel for timestamps, elevations, mph
        mono: ["JetBrainsMono_400Regular"],
        "mono-medium": ["JetBrainsMono_500Medium"],
        "mono-bold": ["JetBrainsMono_700Bold"],
      },
      colors: {
        // Cold dawn palette
        ink: {
          950: "#070A14", // page bg, deepest
          900: "#0B1220", // card bg
          800: "#141C2E", // raised surface
          700: "#1E2840", // hover/active surface
          600: "#2A3550", // border strong
          500: "#3B4A6B", // border default
          400: "#5A6B8C", // muted text
          300: "#8794AE", // secondary text
          200: "#B8C2D6", // body text
          100: "#E1E7F0", // primary text
          50: "#F5F8FC",  // brightest, headlines
        },
        // Frost accent — used sparingly for emphasis
        frost: {
          400: "#67D5F0",
          500: "#3DB8E0",
          600: "#1F94BF",
        },
        // Aspen — sunrise-on-snow warm accent
        aspen: {
          400: "#F0C674",
          500: "#E8B765",
          600: "#C99850",
        },
        // NAC official danger rating colors
        danger: {
          low: "#52BA4A",
          moderate: "#FFF200",
          considerable: "#F7941D",
          high: "#ED1C24",
          extreme: "#000000",
          extremeBorder: "#ED1C24",
          none: "#5A6B8C",
        },
      },
      spacing: {
        // Hairline borders for refined cards
        hairline: "0.5px",
      },
      borderRadius: {
        "4xl": "32px",
      },
    },
  },
  plugins: [],
};
