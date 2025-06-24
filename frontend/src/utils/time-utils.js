/**
 * Format execution time in a human-readable format
 * @param {number} time - Time in seconds
 * @returns {string} Formatted time string
 */
export const formatExecutionTime = (time) => {
  if (!time || time < 0) {
    return "0s";
  }

  if (time < 60) {
    return `${time.toFixed(2)}s`;
  }
  if (time < 3600) {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}m ${seconds.toFixed(2)}s`;
  }
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = time % 60;
  return `${hours}h ${minutes}m ${seconds.toFixed(2)}s`;
};

/**
 * Format time in HH:MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string in HH:MM:SS format
 */
export const formatTime = (seconds) => {
  if (!seconds || seconds < 0) {
    return "00:00:00";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

/**
 * Calculate elapsed time from a start date
 * @param {Date} startDate - Start date
 * @returns {number} Elapsed time in seconds
 */
export const calculateElapsedTime = (startDate) => {
  const now = new Date();
  return Math.floor((now - startDate) / 1000);
};
