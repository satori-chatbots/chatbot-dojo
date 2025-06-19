import { useState } from "react";

function useProjectHandlers(projects) {
  const [selectedProject, setSelectedProject] = useState();

  const handleProjectChange = (projectId) => {
    const project = projects.find((project) => project.id === projectId);
    setSelectedProject(project);
  };

  return {
    selectedProject,
    setSelectedProject,
    handleProjectChange,
  };
}

export { useProjectHandlers };
