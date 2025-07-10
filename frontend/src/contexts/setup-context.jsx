import React, { createContext, useContext, useState, useCallback } from "react";
import { getUserApiKeys } from "../api/authentication-api";
import { fetchChatbotConnectors } from "../api/chatbot-connector-api";
import useFetchProjects from "../hooks/use-fetch-projects";
import useFetchFiles from "../hooks/use-fetch-files";
import useSelectedProject from "../hooks/use-selected-projects";
import { fetchFiles } from "../api/file-api";
import { useAuth } from "./auth-context";
import { fetchProjects } from "../api/project-api";

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

      // Only load data if user is authenticated
      if (!user) {
        setSetupData({
          apiKeys: [],
          connectors: [],
          projects: [],
          profiles: [],
        });
        return;
      }

      // Always fetch fresh data tied to the *current* authenticated user.
      const [apiKeysData, connectorsData, projectsData] = await Promise.all([
        getUserApiKeys().catch(() => []),
        fetchChatbotConnectors().catch(() => []),
        fetchProjects("owned").catch(() => []),
      ]);

      // Fetch profiles from all freshly-fetched projects
      let allProfiles = [];
      if (projectsData && projectsData.length > 0) {
        const profilesArrays = await Promise.all(
          projectsData.map((project) => fetchFiles(project.id).catch(() => [])),
        );
        allProfiles = profilesArrays.flat();
      }

      setSetupData({
        apiKeys: apiKeysData,
        connectors: connectorsData,
        projects: projectsData || [],
        profiles: allProfiles,
      });
    } catch (error) {
      console.error("Error loading setup data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Individual reload functions
  const reloadApiKeys = useCallback(async () => {
    try {
      if (!user) return; // Only reload if user is authenticated
      const apiKeysData = await getUserApiKeys();
      setSetupData((prev) => ({ ...prev, apiKeys: apiKeysData }));
    } catch (error) {
      console.error("Error reloading API keys:", error);
    }
  }, [user]);

  const reloadConnectors = useCallback(async () => {
    try {
      if (!user) return; // Only reload if user is authenticated
      const connectorsData = await fetchChatbotConnectors();
      setSetupData((prev) => ({ ...prev, connectors: connectorsData }));
    } catch (error) {
      console.error("Error reloading connectors:", error);
    }
  }, [user]);

  // Reload projects for both the local hook (to keep UI in sync) and the setup context
  const reloadProjectsData = useCallback(async () => {
    try {
      // First trigger the hook to refresh any other components using it
      reloadProjects();

      // Then fetch fresh data to update this context immediately
      const projectsData = await fetchProjects("owned").catch(() => []);
      setSetupData((prev) => ({ ...prev, projects: projectsData }));
    } catch (error) {
      console.error("Error reloading projects:", error);
    }
  }, [reloadProjects]);

  const reloadProfilesData = useCallback(async () => {
    try {
      // Always work with fresh project data when computing profiles
      const projectsData = await fetchProjects("owned").catch(() => []);

      let allProfiles = [];
      if (projectsData && projectsData.length > 0) {
        const profilesArrays = await Promise.all(
          projectsData.map((project) => fetchFiles(project.id).catch(() => [])),
        );
        allProfiles = profilesArrays.flat();
      }

      setSetupData((prev) => ({
        ...prev,
        projects: projectsData,
        profiles: allProfiles,
      }));
    } catch (error) {
      console.error("Error reloading profiles:", error);
    }
  }, []);

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
      // User logged in or changed, clear old data first, then reload
      setSetupData({ apiKeys: [], connectors: [], projects: [], profiles: [] });
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
