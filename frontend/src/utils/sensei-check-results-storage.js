// Utility functions for managing SENSEI check results persistence

/**
 * Generate a unique execution ID for a SENSEI check result
 */
export const generateExecutionId = () => {
  return `sensei-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Save a SENSEI check result to localStorage
 * @param {string} projectId - The project ID
 * @param {Object} result - The SENSEI check result
 */
export const saveSenseiCheckResult = (projectId, result) => {
  console.log("Saving SENSEI check result for project:", projectId);

  try {
    const storageKey = `senseiCheckResults_${projectId || "all"}`;
    const existingResults = JSON.parse(
      localStorage.getItem(storageKey) || "[]",
    );

    const newResult = {
      ...result,
      id: generateExecutionId(),
      executedAt: new Date().toISOString(),
      projectId: projectId,
    };

    existingResults.unshift(newResult); // Add to beginning (newest first)

    // Keep only the last 100 results to prevent localStorage from getting too large
    const limitedResults = existingResults.slice(0, 100);

    localStorage.setItem(storageKey, JSON.stringify(limitedResults));
    console.log(
      `Saved result to ${storageKey}, total results: ${limitedResults.length}`,
    );

    return newResult;
  } catch (error) {
    console.error("Error saving SENSEI check result:", error);
    throw new Error("Failed to save result to local storage");
  }
}; /**
 * Load SENSEI check results from localStorage
 * @param {string} projectId - The project ID (optional, loads all if not provided)
 * @returns {Array} Array of SENSEI check results
 */
export const loadSenseiCheckResults = (projectId = undefined) => {
  try {
    const storageKey = `senseiCheckResults_${projectId || "all"}`;
    const results = JSON.parse(localStorage.getItem(storageKey) || "[]");

    // Sort by execution date, newest first
    return results.sort(
      (a, b) => new Date(b.executedAt) - new Date(a.executedAt),
    );
  } catch (error) {
    console.error("Error loading SENSEI check results:", error);
    return [];
  }
};

/**
 * Delete a specific SENSEI check result
 * @param {string} projectId - The project ID
 * @param {string} resultId - The result ID to delete
 */
export const deleteSenseiCheckResult = (projectId, resultId) => {
  try {
    const storageKey = `senseiCheckResults_${projectId || "all"}`;
    const existingResults = JSON.parse(
      localStorage.getItem(storageKey) || "[]",
    );

    const updatedResults = existingResults.filter(
      (result) => result.id !== resultId,
    );
    localStorage.setItem(storageKey, JSON.stringify(updatedResults));

    return updatedResults;
  } catch (error) {
    console.error("Error deleting SENSEI check result:", error);
    throw new Error("Failed to delete result from local storage");
  }
};

/**
 * Clear all SENSEI check results for a project
 * @param {string} projectId - The project ID
 */
export const clearSenseiCheckResults = (projectId) => {
  try {
    const storageKey = `senseiCheckResults_${projectId || "all"}`;
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error("Error clearing SENSEI check results:", error);
    throw new Error("Failed to clear results from local storage");
  }
};

/**
 * Get the total count of SENSEI check results for a project
 * @param {string} projectId - The project ID
 * @returns {number} The total count of results
 */
export const getSenseiCheckResultsCount = (projectId) => {
  try {
    const results = loadSenseiCheckResults(projectId);
    return results.length;
  } catch (error) {
    console.error("Error getting SENSEI check results count:", error);
    return 0;
  }
};

/**
 * Export SENSEI check results as JSON
 * @param {Array} results - The results to export
 * @param {string} filename - The filename for the export
 */
export const exportSenseiCheckResults = (
  results,
  filename = "sensei-check-results.json",
) => {
  try {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting SENSEI check results:", error);
    throw new Error("Failed to export results");
  }
};
