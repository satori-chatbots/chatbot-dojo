import React, { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import CreateProjectModal from "../components/create-project-modal";
import useFetchProjects from "../hooks/use-fetch-projects";
import { fetchChatbotConnectors } from "../api/chatbot-connector-api";
import { deleteProject } from "../api/project-api";
import EditProjectModal from "../components/edit-project-modal";
import useSelectedProject from "../hooks/use-selected-projects";
import ProjectsList from "../components/project-list";
import { Plus } from "lucide-react";
import { getProviderDisplayName } from "../constants/providers";
import SetupProgress from "../components/setup-progress";

const ProjectsDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { projects, loadingProjects, reloadProjects } =
    useFetchProjects("owned");
  const [connectors, setConnectors] = useState([]);
  const [editProjectId, setEditProjectId] = useState();
  const [selectedProject, setSelectedProject] = useSelectedProject();

  useEffect(() => {
    const loadConnectors = async () => {
      try {
        setLoading(true);
        const techData = await fetchChatbotConnectors();
        setConnectors(techData);
      } catch (error) {
        console.error("Error fetching connectors:", error);
      } finally {
        setLoading(false);
      }
    };
    loadConnectors();
  }, []);

  const handleEditClick = (project) => {
    setEditProjectId(project.id);
    setIsEditOpen(true);
  };

  const handleProjectDelete = async (projectId) => {
    if (!globalThis.confirm("Are you sure you want to delete this project?")) {
      return;
    }
    try {
      await deleteProject(projectId);
      await reloadProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      alert(`Error deleting project: ${error.message}`);
    }
  };

  const handleProjectUpdated = async () => {
    await reloadProjects();

    // If the edited project is the currently selected project, fetch fresh data
    if (selectedProject && editProjectId === selectedProject.id) {
      try {
        const { fetchProject } = await import("../api/project-api");
        const updatedProject = await fetchProject(editProjectId);
        setSelectedProject(updatedProject);
      } catch (error) {
        console.error("Error fetching updated project:", error);
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col space-y-4 sm:space-y-6 max-w-full sm:max-w-4xl mx-auto my-auto max-h-[90vh]">
      <CreateProjectModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        connectors={connectors}
        onProjectCreated={async (newProject) => {
          await reloadProjects();
          setSelectedProject(newProject);
        }}
      />

      <h2 className="text-xl sm:text-2xl font-bold text-center">
        My Projects:
      </h2>

      {/* Setup Progress */}
      <div className="w-full max-w-4xl">
        <SetupProgress isCompact={true} />
      </div>

      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Selected Project:</span>
          <span>{selectedProject?.name || "None"}</span>
        </div>
        {selectedProject && (
          <div className="text-sm text-foreground/70 dark:text-foreground-dark/70 dark:text-foreground/50 dark:text-foreground-dark/50 flex items-center gap-2">
            <span>Model:</span>
            {selectedProject.api_key && selectedProject.llm_model ? (
              <span className="font-medium">
                {selectedProject.llm_model}
                <span className="text-xs text-foreground/60 dark:text-foreground-dark/60 ml-1">
                  ({getProviderDisplayName(selectedProject.llm_provider)})
                </span>
              </span>
            ) : (
              <span className="text-red-500">Not configured</span>
            )}
          </div>
        )}
      </div>

      <ProjectsList
        projects={projects}
        connectors={connectors}
        loading={loading || loadingProjects}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
        onEditProject={handleEditClick}
        onDeleteProject={handleProjectDelete}
      />

      <Button
        color="primary"
        className="max-w-full sm:max-w-[200px] mx-auto h-10 sm:h-12"
        onPress={() => setIsCreateOpen(true)}
        startContent={<Plus className="w-4 h-4 mr-1" />}
      >
        Create New Project
      </Button>

      <EditProjectModal
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        project={
          editProjectId
            ? projects.find((p) => p.id === editProjectId)
            : undefined
        }
        connectors={connectors}
        onProjectUpdated={handleProjectUpdated}
      />
    </div>
  );
};

export default ProjectsDashboard;
