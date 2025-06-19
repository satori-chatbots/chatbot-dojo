// eslint.config.js

import globals from "globals";
import js from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import pluginUnicorn from "eslint-plugin-unicorn";
import pluginImport from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  // 1. Global ignores
  {
    ignores: ["dist/", "node_modules/"],
  },

  // 2. Base ESLint recommended rules
  js.configs.recommended,

  // 3. React-specific recommended rules
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "jsx-a11y": pluginJsxA11y,
      unicorn: pluginUnicorn,
      import: pluginImport,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      ...pluginJsxA11y.configs.recommended.rules,
      ...pluginUnicorn.configs.recommended.rules,

      // A couple of very common and useful overrides for modern React
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  // 4. Prettier compatibility config
  // This must be last to turn off any conflicting style rules.
  eslintConfigPrettier,
];
