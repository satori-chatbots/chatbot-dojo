import React, { createContext, useContext, useState, useCallback } from "react";
import { getUserApiKeys } from "../api/authentication-api";
import { fetchChatbotConnectors } from "../api/chatbot-connector-api";
import useFetchProjects from "../hooks/use-fetch-projects";
import useFetchFiles from "../hooks/use-fetch-files";
import useSelectedProject from "../hooks/use-selected-projects";
import { fetchFiles } from "../api/file-api";
import { useAuth } from "./auth-context";

const SetupContext = createContext();

export const useSetup = () => {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error("useSetup must be used within a SetupProvider");
  }
  return context;
};

export const SetupProvider = ({ children }) => {
  const [setupData, setSetupData] = useState({
    apiKeys: [],
    connectors: [],
    projects: [],
    profiles: [],
  });
  const [loading, setLoading] = useState(true);

  // Using existing hooks for projects and files
  const { projects, loadingProjects, reloadProjects } =
    useFetchProjects("owned");
  const [selectedProject] = useSelectedProject();
  const { files } = useFetchFiles(selectedProject?.id);

  const { user, isLoading: authLoading } = useAuth();

  const loadSetupData = useCallback(async () => {
    try {
      setLoading(true);
      const [apiKeysData, connectorsData] = await Promise.all([
        getUserApiKeys().catch(() => []),
        fetchChatbotConnectors().catch(() => []),
      ]);

      // Fetch profiles from all projects
      let allProfiles = [];
      if (projects && projects.length > 0) {
        const profilesArrays = await Promise.all(
          projects.map((project) => fetchFiles(project.id).catch(() => [])),
        );
        allProfiles = profilesArrays.flat();
      }

      setSetupData({
        apiKeys: apiKeysData,
        connectors: connectorsData,
        projects: projects || [],
        profiles: allProfiles,
      });
    } catch (error) {
      console.error("Error loading setup data:", error);
    } finally {
      setLoading(false);
    }
  }, [projects]);

  // Individual reload functions
  const reloadApiKeys = useCallback(async () => {
    try {
      const apiKeysData = await getUserApiKeys();
      setSetupData((prev) => ({ ...prev, apiKeys: apiKeysData }));
    } catch (error) {
      console.error("Error reloading API keys:", error);
    }
  }, []);

  const reloadConnectors = useCallback(async () => {
    try {
      const connectorsData = await fetchChatbotConnectors();
      setSetupData((prev) => ({ ...prev, connectors: connectorsData }));
    } catch (error) {
      console.error("Error reloading connectors:", error);
    }
  }, []);

  const reloadProjectsData = useCallback(async () => {
    await reloadProjects();
    // The projects will be updated via the dependency in loadSetupData
  }, [reloadProjects]);

  const reloadProfilesData = useCallback(async () => {
    // Re-fetch profiles from all projects
    try {
      let allProfiles = [];
      if (projects && projects.length > 0) {
        const profilesArrays = await Promise.all(
          projects.map((project) => fetchFiles(project.id).catch(() => [])),
        );
        allProfiles = profilesArrays.flat();
      }
      setSetupData((prev) => ({ ...prev, profiles: allProfiles }));
    } catch (error) {
      console.error("Error reloading profiles:", error);
    }
  }, [projects]);

  // Combined reload function
  const reloadAllSetupData = useCallback(async () => {
    await loadSetupData();
  }, [loadSetupData]);

  // Update setup data when projects or files change
  React.useEffect(() => {
    setSetupData((prev) => ({
      ...prev,
      projects: projects || [],
      profiles: files || [],
    }));
  }, [projects, files]);

  // Initial load
  React.useEffect(() => {
    loadSetupData();
  }, [loadSetupData]);

  // Reload or clear data when auth state changes
  React.useEffect(() => {
    if (authLoading) return;
    if (user) {
      // User logged in or changed, reload
      reloadAllSetupData();
    } else {
      // User logged out, clear setup data
      setSetupData({ apiKeys: [], connectors: [], projects: [], profiles: [] });
    }
  }, [user, authLoading, reloadAllSetupData]);

  // Reload when browser tab gains focus
  React.useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        reloadAllSetupData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [reloadAllSetupData]);

  const contextValue = {
    setupData,
    loading: loading || loadingProjects,
    reloadApiKeys,
    reloadConnectors,
    reloadProjects: reloadProjectsData,
    reloadProfiles: reloadProfilesData,
    reloadAllSetupData,
  };

  return (
    <SetupContext.Provider value={contextValue}>
      {children}
    </SetupContext.Provider>
  );
};
