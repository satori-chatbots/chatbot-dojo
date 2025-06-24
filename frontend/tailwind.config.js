import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light mode palette
        background: {
          DEFAULT: "#f8fafc", // off-white, Notion-like
          paper: "#ffffffcc", // frosted white
          subtle: "#f4f6fa", // subtle background
        },
        primary: {
          DEFAULT: "#6366f1", // blue-violet
          light: "#a5b4fc",
          dark: "#4338ca",
        },
        secondary: {
          DEFAULT: "#a78bfa", // purple
          light: "#ddd6fe",
          dark: "#7c3aed",
        },
        accent: {
          DEFAULT: "linear-gradient(90deg, #6366f1 0%, #a78bfa 100%)",
        },
        border: {
          DEFAULT: "#e5e7eb",
          dark: "#23272f",
        },
        muted: {
          DEFAULT: "#f1f5f9",
          dark: "#1e293b",
        },
        // Dark mode palette
        darkbg: {
          DEFAULT: "#18181b", // neutral dark gray
          glass: "rgba(24,24,27,0.8)", // frosted neutral gray glass
          card: "rgba(39,39,42,0.8)", // slightly lighter neutral gray
        },
        // Text
        foreground: {
          DEFAULT: "#22223b",
          dark: "#e2e8f0", // light gray that works well with dark purple/black gradient
        },
      },
      backgroundImage: {
        "radial-gradient": "radial-gradient(var(--tw-gradient-stops))",
        "dark-gradient":
          "radial-gradient(circle at top left, #0f172a -100%, transparent 40%), radial-gradient(circle at bottom right, #6d28d9 -100%, transparent 40%)",
        "light-gradient": "linear-gradient(120deg, #f8fafc 0%, #e0e7ef 100%)",
      },
      boxShadow: {
        glass: "0 4px 32px 0 rgba(31, 41, 55, 0.12)",
        card: "0 2px 8px 0 rgba(31, 41, 55, 0.08)",
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.5rem",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: {
              DEFAULT: "#f8fafc",
            },
            foreground: {
              DEFAULT: "#22223b",
            },
            content1: {
              DEFAULT: "#ffffffcc", // for cards/inputs background
            },
            content2: {
              DEFAULT: "#f4f6fa", // for subtle backgrounds
            },
          },
        },
        dark: {
          colors: {
            background: {
              DEFAULT: "#000000",
            },
            foreground: {
              DEFAULT: "#e2e8f0", // your light gray for dark mode text
            },
            content1: {
              DEFAULT: "rgba(24,24,27,0.8)", // for cards/inputs background
            },
            content2: {
              DEFAULT: "rgba(39,39,42,0.8)", // for subtle backgrounds
            },
          },
        },
      },
    }),
  ],
};
