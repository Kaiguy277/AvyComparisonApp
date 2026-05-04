/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        display: ["InstrumentSerif_400Regular"],
        "display-italic": ["InstrumentSerif_400Regular_Italic"],
        sans: ["InstrumentSans_400Regular"],
        "sans-medium": ["InstrumentSans_500Medium"],
        "sans-semibold": ["InstrumentSans_600SemiBold"],
        "sans-bold": ["InstrumentSans_700Bold"],
        mono: ["JetBrainsMono_400Regular"],
        "mono-medium": ["JetBrainsMono_500Medium"],
        "mono-bold": ["JetBrainsMono_700Bold"],
      },
      colors: {
        // Warm-paper editorial palette.
        ink: {
          950: "#EDE5D2", // page bg
          900: "#E5DCC4", // recessed surface
          800: "#F6EFDD", // tile / raised surface
          700: "#1B1916", // strong ink line
          600: "#3A332A", // medium ink
          500: "#A89A82", // soft sepia border
          400: "#7B7160", // muted text
          300: "#5C534A", // secondary text
          200: "#2E2A24", // body text
          100: "#1B1916", // primary text
          50: "#0F0D0B",  // emphasis text
        },
        frost: {
          400: "#3F7AB8",
          500: "#2D5F95",
          600: "#1F4773",
        },
        aspen: {
          400: "#B25437",
          500: "#92402A",
          600: "#73311F",
        },
        // NAC official danger rating colors (locked).
        danger: {
          low: "#52BA4A",
          moderate: "#FFF200",
          considerable: "#F7941D",
          high: "#ED1C24",
          extreme: "#000000",
          extremeBorder: "#ED1C24",
          none: "#A89A82",
        },
      },
      spacing: {
        hairline: "0.5px",
      },
      borderRadius: {
        "4xl": "32px",
      },
    },
  },
  plugins: [],
};
