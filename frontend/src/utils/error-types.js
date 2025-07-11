// TRACER Error Type Mapping Utilities
// Centralized error type mapping to reduce duplication across components

// Map TRACER error types to user-friendly display names
const ERROR_TYPE_DISPLAY_MAP = {
  GRAPHVIZ_NOT_INSTALLED: "Graphviz Missing",
  CONNECTOR_CONNECTION: "Connection Failed",
  CONNECTOR_AUTHENTICATION: "Auth Failed",
  CONNECTOR_CONFIGURATION: "Config Error",
  CONNECTOR_RESPONSE: "Response Error",
  LLM_ERROR: "LLM Error",
  CONNECTOR_ERROR: "Connector Error",
  TRACER_ERROR: "TRACER Error",
  PERMISSION_ERROR: "Permission Denied",
  CONNECTION_ERROR: "Network Error",
  TIMEOUT_ERROR: "Timeout",
  API_KEY_ERROR: "API Key Error",
  AUTHENTICATION_ERROR: "Auth Error",
  NOT_FOUND_ERROR: "Not Found",
  SUBPROCESS_ERROR: "Execution Error",
  SYSTEM_ERROR: "System Error",
  OTHER: "Unknown Error",
};

// Map TRACER error types to detailed information (name + description)
const ERROR_TYPE_INFO_MAP = {
  GRAPHVIZ_NOT_INSTALLED: {
    name: "Graphviz Missing",
    description: "Graphviz is required for generating workflow graphs",
  },
  CONNECTOR_CONNECTION: {
    name: "Connection Failed",
    description: "Unable to connect to the chatbot endpoint",
  },
  CONNECTOR_AUTHENTICATION: {
    name: "Authentication Failed",
    description: "Failed to authenticate with the chatbot",
  },
  CONNECTOR_CONFIGURATION: {
    name: "Configuration Error",
    description: "Chatbot connector is not configured correctly",
  },
  CONNECTOR_RESPONSE: {
    name: "Response Error",
    description: "Chatbot returned an unexpected response",
  },
  LLM_ERROR: {
    name: "LLM Error",
    description: "Error occurred with the Language Model API",
  },
  CONNECTOR_ERROR: {
    name: "Connector Error",
    description: "General error with the chatbot connector",
  },
  TRACER_ERROR: {
    name: "TRACER Error",
    description: "Error occurred during TRACER execution",
  },
  PERMISSION_ERROR: {
    name: "Permission Denied",
    description: "Insufficient permissions to execute operation",
  },
  CONNECTION_ERROR: {
    name: "Network Error",
    description: "Network connection issue occurred",
  },
  TIMEOUT_ERROR: {
    name: "Timeout",
    description: "Operation timed out",
  },
  API_KEY_ERROR: {
    name: "API Key Error",
    description: "Issue with the API key configuration",
  },
  AUTHENTICATION_ERROR: {
    name: "Authentication Error",
    description: "Failed to authenticate with the service",
  },
  NOT_FOUND_ERROR: {
    name: "Not Found",
    description: "Required resource was not found",
  },
  SUBPROCESS_ERROR: {
    name: "Execution Error",
    description: "Failed to execute TRACER command",
  },
  SYSTEM_ERROR: {
    name: "System Error",
    description: "System-level error occurred",
  },
  OTHER: {
    name: "Unknown Error",
    description: "An unrecognized error occurred",
  },
};

/**
 * Get user-friendly display name for a TRACER error type
 * @param {string} errorType - The error type from the API
 * @returns {string} User-friendly display name
 */
export const getErrorTypeDisplay = (errorType) => {
  return ERROR_TYPE_DISPLAY_MAP[errorType] || errorType;
};

/**
 * Get detailed error information for a TRACER error type
 * @param {string} errorType - The error type from the API
 * @returns {Object} Object with name and description properties
 */
export const getErrorTypeInfo = (errorType) => {
  return (
    ERROR_TYPE_INFO_MAP[errorType] || {
      name: errorType,
      description: "Error details available in logs",
    }
  );
};

/**
 * Get all available error types (for debugging or validation)
 * @returns {string[]} Array of all known error type keys
 */
export const getAvailableErrorTypes = () => {
  return Object.keys(ERROR_TYPE_DISPLAY_MAP);
};
