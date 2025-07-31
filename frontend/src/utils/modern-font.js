/**
 * Modern monospace font utilities for code editors and code displays
 */

// Modern monospace font stack with fallbacks
export const MODERN_MONOSPACE_FONT_FAMILY =
  "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Monaco, 'Roboto Mono', 'Ubuntu Mono', Consolas, 'Courier New', monospace";

// Font feature settings for ligatures
export const FONT_FEATURE_SETTINGS = "'liga' on, 'calt' on";

// Complete style object for modern monospace font
export const modernMonospaceStyle = {
  fontFamily: MODERN_MONOSPACE_FONT_FAMILY,
  fontFeatureSettings: FONT_FEATURE_SETTINGS,
};

// CSS string for use in className or style attributes
export const modernMonospaceCss = `font-family: ${MODERN_MONOSPACE_FONT_FAMILY}; font-feature-settings: ${FONT_FEATURE_SETTINGS};`;

// Tailwind-safe class name (for use in custom CSS)
export const modernMonospaceClass = "font-modern-mono";
