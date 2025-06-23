// LLM Provider constants and utilities
export const PROVIDER_OPTIONS = [
  { key: "openai", value: "openai", label: "OpenAI" },
  { key: "gemini", value: "gemini", label: "Google Gemini" },
];

// Helper function to get provider display name
export const getProviderDisplayName = (provider) => {
  const providerOption = PROVIDER_OPTIONS.find((p) => p.value === provider);
  return providerOption ? providerOption.label : provider || "Unknown Provider";
};

// Map of provider values to display names for quick lookup
export const PROVIDER_DISPLAY_MAP = {
  openai: "OpenAI",
  gemini: "Google Gemini",
};
