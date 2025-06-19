import React, { useState, useEffect, useMemo } from "react";
import {
  Button,
} from "@heroui/react";
import CreateProjectModal from "../components/create-project-modal";
import useFetchProjects from "../hooks/use-fetch-projects";
import {
  fetchChatbotTechnologies,
} from "../api/chatbot-technology-api";
import {
  createProject,
  deleteProject,
  updateProject,
  checkProjectName,
} from "../api/project-api";
import EditProjectModal from "../components/edit-project-modal";
import useSelectedProject from "../hooks/use-selected-projects";
import ProjectsList from "../components/project-list";
import { Plus } from "lucide-react";

const ProjectsDashboard = () => {
  // Loading state
  const [loading, setLoading] = useState(false);

  // State of the modal to create new project
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // State of the modal to edit project
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Form data for creating a new project
  const [createFormData, setCreateFormData] = useState({
    name: "",
    technology: "",
  });

  // Form data for editing a project
  const [editFormData, setEditFormData] = useState({
    name: "",
    technology: "",
  });

  // Projects state
  const { projects, loadingProjects, errorProjects, reloadProjects } =
    useFetchProjects("owned");

  const [technologies, setTechnologies] = useState([]);

  // State with the id of the project to edit
  const [editProjectId, setEditProjectId] = useState(null);

  // Loading state for the serverside validation
  const [loadingValidation, setLoadingValidation] = useState(false);

  // Errors for the serverside validation
  const [validationErrors, setValidationErrors] = useState({});

  // State for the original name
  const [originalName, setOriginalName] = useState("");

  const [selectedProject, setSelectedProject] = useSelectedProject();

  // Init the available technologies and projects
  useEffect(() => {
    loadTechnologies();
  }, []);

  const loadTechnologies = async () => {
    try {
      setLoading(true);
      const technologies = await fetchChatbotTechnologies();
      setTechnologies(technologies);
      // console.log('technologies:', technologies);
    } catch (error) {
      console.error("Error fetching technologies:", error);
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------- */
  /* -------------- HANDLERS ------------- */
  /* ------------------------------------- */

  // Function to handle the change of the new project name
  const handleProjectNameChange = (e) => {
    setCreateFormData((previous) => ({ ...previous, name: e.target.value }));
  };

  // Function to handle the change of the selected technology
  const handleTechnologyChange = (e) => {
    setCreateFormData((previous) => ({
      ...previous,
      technology: e.target.value,
    }));
  };

  const handleFormValidation = async (
    event,
    name,
    technology,
    oldName = "",
  ) => {
    // Return false if the validation didn't pass

    event.preventDefault();
    setLoadingValidation(true);

    if (!name.trim()) {
      setLoadingValidation(false);
      return false;
    }

    if (!technology) {
      setLoadingValidation(false);
      return false;
    }

    if (oldName && name === oldName) {
      setLoadingValidation(false);
      return true;
    }

    const existsResponse = await checkProjectName(name);
    if (existsResponse.exists) {
      setValidationErrors({ name: "Project name already exists" });
      setLoadingValidation(false);
      return false;
    }

    setValidationErrors({});
    setLoadingValidation(false);
    return true;
  };

  // Function to handle the creation of a new project
  const handleCreateProject = async (event) => {
    event.preventDefault();
    const newProjectName = createFormData.name;
    const technology = createFormData.technology;

    // Validation
    const isValid = await handleFormValidation(
      event,
      newProjectName,
      technology,
    );

    if (!isValid) {
      return;
    }

    // Create the new project
    try {
      const newProject = await createProject({
        name: newProjectName,
        chatbot_technology: technology,
      });
      await reloadProjects();
      handleFormReset();
      setIsCreateOpen(false);
    } catch (error) {
      console.error("Error creating project:", error);
      //alert(`Error updating project: ${error.message}`);

      const errorData = JSON.parse(error.message);
      // Format the data
      const errors = Object.entries(errorData).map(
        ([key, value]) => `${key}: ${value}`,
      );
      alert(`Error creating project: ${errors.join("\n")}`);
    }
  };

  // Handle the edit project modal
  const handleEditClick = (project) => {
    setEditProjectId(project.id);
    setOriginalName(project.name);

    setEditFormData({
      name: project.name,
      technology: project.chatbot_technology,
    });

    //console.log('project technology:', project.chatbot_technology);
    //console.log('edit form data:', editFormData);
    setIsEditOpen(true);
  };

  // Function to handle the edit project modal
  const handleUpdateProject = async (event) => {
    event.preventDefault();

    // Validation
    const isValid = await handleFormValidation(
      event,
      editFormData.name,
      editFormData.technology,
      originalName,
    );
    if (!isValid) {
      return;
    }

    try {
      await updateProject(editProjectId, {
        name: editFormData.name,
        chatbot_technology: editFormData.technology,
      });
      setIsEditOpen(false);
      reloadProjects();
    } catch (error) {
      console.error("Error updating project:", error);
      //alert(`Error updating project: ${error.message}`);

      const errorData = JSON.parse(error.message);
      // Format the data
      const errors = Object.entries(errorData).map(
        ([key, value]) => `${key}: ${value}`,
      );
      alert(`Error updating project: ${errors.join("\n")}`);
    }
  };
  // Function to handle the deletion
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

  // Function to reset the form
  const handleEditFormReset = () => {
    setEditFormData({
      name: "",
      technology: "",
    });
  };

  // Function to reset the form
  const handleFormReset = () => {
    setCreateFormData({
      name: "",
      technology: "",
    });
  };

  /* Columns */
  const columns = [
    { name: "Name", key: "name", sortable: true },
    { name: "Technology", key: "technology", sortable: true },
    { name: "Actions", key: "actions" },
  ];

  const [sortDescriptor, setSortDescriptor] = useState({
    column: "name",
    direction: "ascending",
  });

  const sortedProjects = useMemo(() => {
    const { column, direction } = sortDescriptor;
    return [...projects].sort((a, b) => {
      const first =
        column === "technology"
          ? (technologies.find((t) => t.id === a.chatbot_technology)?.name ??
            "")
          : (a[column] ?? "");
      const second =
        column === "technology"
          ? (technologies.find((t) => t.id === b.chatbot_technology)?.name ??
            "")
          : (b[column] ?? "");
      const cmp = first < second ? -1 : first > second ? 1 : 0;
      return direction === "descending" ? -cmp : cmp;
    });
  }, [projects, technologies, sortDescriptor]);

  return (
    <div
      className="p-4 sm:p-6 lg:p-8
            flex flex-col
            space-y-4 sm:space-y-6
            max-w-full sm:max-w-4xl
            mx-auto
            my-auto
            max-h-[90vh]"
    >
      {/* Modal to create new project */}
      <CreateProjectModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        technologies={technologies}
        onProjectCreated={async (newProject) => {
          await reloadProjects();
          setSelectedProject(newProject);
        }}
      />

      <h2 className="text-xl sm:text-2xl font-bold text-center">
        My Projects:
      </h2>

      {/* Selected project */}
      <div className="flex items-center justify-center gap-2">
        <span className="font-semibold">Selected Project:</span>
        <span>{selectedProject?.name || "None"}</span>
      </div>

      {/* ProjectsList */}
      <ProjectsList
        projects={projects}
        technologies={technologies}
        loading={loading || loadingProjects}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
        onEditProject={handleEditClick}
        onDeleteProject={handleProjectDelete}
      />

      {/* Button to open modal */}
      <Button
        color="primary"
        className="max-w-full sm:max-w-[200px] mx-auto h-10 sm:h-12"
        onPress={() => setIsCreateOpen(true)}
        startContent={<Plus className="w-4 h-4 mr-1" />}
      >
        Create New Project
      </Button>

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        project={
          editProjectId ? projects.find((p) => p.id === editProjectId) : null
        }
        technologies={technologies}
        onProjectUpdated={reloadProjects}
      />
    </div>
  );
};

export default ProjectsDashboard;
