// Status Label Mapping Utilities
// Centralized status label mapping to reduce duplication across components

// Map status values to user-friendly display names
const STATUS_LABEL_MAP = {
  SUCCESS: "Success",
  FAILURE: "Failure",
  RUNNING: "Running",
  PENDING: "Pending",
  STOPPED: "Stopped",
  CANCELLED: "Cancelled",
  ERROR: "Error", // Legacy support
};

/**
 * Get user-friendly display label for a status value
 * @param {string} status - The status value from the API
 * @returns {string} User-friendly display label
 */
export const getStatusLabel = (status) => {
  return STATUS_LABEL_MAP[status] || status;
};

/**
 * Get all available status values (for debugging or validation)
 * @returns {string[]} Array of all known status keys
 */
export const getAvailableStatuses = () => {
  return Object.keys(STATUS_LABEL_MAP);
};
