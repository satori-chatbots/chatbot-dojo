import React, { createContext, useState, useEffect, useContext } from "react";
import { validateToken } from "../api/authentication-api";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const clearAllData = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("selectedProject");
    setUser(null);
    setSelectedProject(null);
  };

  const checkTokenValidity = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      clearAllData();
      return false;
    }
    try {
      const isValid = await validateToken();
      if (!isValid) {
        clearAllData();
      }
      return isValid;
    } catch {
      clearAllData();
      return false;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        const userData = localStorage.getItem("user");
        if (userData && (await checkTokenValidity())) {
          const parsedUserData = JSON.parse(userData);
          setUser(parsedUserData.user);
          const projectData = localStorage.getItem("selectedProject");
          if (projectData) {
            setSelectedProject(JSON.parse(projectData));
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        clearAllData();
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };
    initAuth();
  }, []);

  const login = (userData) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", userData.token);
    setUser(userData.user);
  };

  const logout = () => {
    clearAllData();
  };

  const refreshUser = async () => {
    const userData = localStorage.getItem("user");
    console.log("Refresh user called");
    if (userData && (await checkTokenValidity())) {
      console.log("User data found");
      const parsedUserData = JSON.parse(userData);
      setUser(parsedUserData.user);
      // We have to update this if not it keeps displaying the old name
      localStorage.setItem("user", JSON.stringify(parsedUserData));
    }
  };

  const contextValue = {
    user,
    setUser,
    selectedProject,
    setSelectedProject,
    isLoading,
    isInitialized,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};
