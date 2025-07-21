import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          "react-vendor": ["react", "react-dom", "react-router-dom"],

          // UI Framework
          "ui-vendor": ["@heroui/react", "framer-motion", "next-themes"],

          // Code Editor
          "codemirror-vendor": [
            "@uiw/react-codemirror",
            "@codemirror/lang-yaml",
            "@codemirror/search",
            "@uiw/codemirror-theme-github",
            "@uiw/codemirror-theme-material",
            "thememirror",
          ],

          // Utilities
          "utils-vendor": [
            "lodash",
            "date-fns",
            "js-yaml",
            "react-dropzone",
            "react-window",
          ],

          // Icons
          "icons-vendor": ["lucide-react", "react-icons"],
        },
      },
    },
    // Increase chunk size warning limit to 700 since heroui is already 500+
    chunkSizeWarningLimit: 700,
  },
});
