import { useState, useEffect } from "react";

export default function useSelectedProject() {
  const [selectedProject, setSelectedProjectState] = useState();

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("selectedProject");
    if (stored) {
      setSelectedProjectState(JSON.parse(stored));
    }
  }, []);

  // Wrapper to update both state and storage
  const setSelectedProject = (project) => {
    setSelectedProjectState(project);
    if (project) {
      localStorage.setItem("selectedProject", JSON.stringify(project));
    } else {
      localStorage.removeItem("selectedProject");
    }
  };

  return [selectedProject, setSelectedProject];
}
