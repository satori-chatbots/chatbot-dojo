import { useState, useEffect } from 'react'
import { fetchFiles } from '../api/fileApi'

function useProjectHandlers(projects) {
    const [selectedProject, setSelectedProject] = useState(null);

    const handleProjectChange = (projectId) => {
        const project = projects.find(project => project.id === projectId);
        setSelectedProject(project);
    };

    return {
        selectedProject,
        setSelectedProject,
        handleProjectChange,
    };
}




export { useProjectHandlers, useFetchFiles }
