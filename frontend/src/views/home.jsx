import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Button,
  Input,
  Card,
  Modal,
  ModalContent,
  ModalFooter,
  ModalBody,
  ModalHeader,
  Form,
  useDisclosure,
  Link,
} from "@heroui/react";
import {
  Upload,
  File,
  Trash,
  Play,
  Plus,
  X,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import {
  uploadFiles,
  deleteFiles,
  generateProfiles,
  checkGenerationStatus,
  checkOngoingGeneration,
} from "../api/file-api";
import { deleteProject } from "../api/project-api";
import { fetchChatbotTechnologies } from "../api/chatbot-technology-api";
import useFetchProjects from "../hooks/use-fetch-projects";
import useFetchFiles from "../hooks/use-fetch-files";
import { executeTest, checkTestCaseName } from "../api/test-cases-api";
import useSelectedProject from "../hooks/use-selected-projects";
import CreateProjectModal from "../components/create-project-modal";
import EditProjectModal from "../components/edit-project-modal";
import ProjectsList from "../components/project-list";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { getProviderDisplayName } from "../constants/providers";

// Move preventDefault to the outer scope
const preventDefault = (event) => event.preventDefault();

function Home() {
  const { showToast } = useMyCustomToast();

  // List of available chatbot technologies (eg Taskyto, Rasa, etc.)
  const [availableTechnologies, setAvailableTechnologies] = useState([]);
  const [loadingTechnologies, setLoadingTechnologies] = useState(true);

  // Fetch the list of projects
  const { projects, loadingProjects, reloadProjects } =
    useFetchProjects("owned");

  // Control the selected project
  const [selectedProject, setSelectedProject] = useSelectedProject();

  // Controls if the modal is open or not
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // List of files selected with checkboxes
  const [selectedFiles, setSelectedFiles] = useState([]);

  // List of files to upload
  const fileInputReference = useRef(undefined);

  // State to control the modal for the execution name
  const [isExecuteOpen, setIsExecuteOpen] = useState(false);
  const [executionName, setExecutionName] = useState("");

  const [selectedUploadFiles, setSelectedUploadFiles] = useState();

  // List of files in the selected project
  const { files, reloadFiles } = useFetchFiles(
    selectedProject ? selectedProject.id : undefined,
  );

  // Loading state for the serverside validation of the execution name
  const [loadingValidation, setLoadingValidation] = useState(false);

  // Errors for the serverside validation of the execution name
  const [validationErrors, setValidationErrors] = useState({});

  // Profiles generation states
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [profileGenParameters, setProfileGenParameters] = useState({
    conversations: 5,
    turns: 5,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const statusIntervalReference = useRef();
  const [generationStage, setGenerationStage] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);

  // Navigation
  const navigate = useNavigate();

  // Delete project modal
  const [deleteProjectModal, setDeleteProjectModal] = useState({
    isOpen: false,
    isLoading: false,
    projectId: undefined,
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editProjectId, setEditProjectId] = useState();

  const handleProfileGenParameterChange = (field, value) => {
    setProfileGenParameters((previous) => ({
      ...previous,
      [field]: Number.parseInt(value) || 0,
    }));
  };

  const pollGenerationStatus = useCallback(
    async (taskId) => {
      // Clear any existing interval
      if (statusIntervalReference.current) {
        clearInterval(statusIntervalReference.current);
      }

      // Set up interval to check status
      statusIntervalReference.current = setInterval(async () => {
        try {
          const status = await checkGenerationStatus(taskId);

          if (status.status === "COMPLETED") {
            clearInterval(statusIntervalReference.current);
            statusIntervalReference.current = undefined;
            // Explicitly reload files when generation completes
            await reloadFiles();
            setIsGenerating(false);
            showToast(
              "success",
              `Successfully generated ${status.generated_files} profiles!`,
            );
          } else if (status.status === "ERROR") {
            clearInterval(statusIntervalReference.current);
            statusIntervalReference.current = undefined;
            setIsGenerating(false);
            showToast(
              "error",
              status.error_message || "Error generating profiles",
            );
          } else {
            // Update the stage information in the UI
            setGenerationStage(status.stage || "Processing");
            setGenerationProgress(status.progress || 0);
          }
        } catch {
          clearInterval(statusIntervalReference.current);
          statusIntervalReference.current = undefined;
          setIsGenerating(false);
          showToast("error", "Error checking generation status");
        }
      }, 3000); // Check every 3 seconds
    },
    [reloadFiles, showToast],
  );

  const handleGenerateProfiles = async () => {
    if (!selectedProject) {
      showToast("error", "Please select a project first");
      return;
    }

    // Reset progress indicators immediately when starting a new generation
    setIsGenerating(true);
    setGenerationStage("INITIALIZING");
    setGenerationProgress(0);

    try {
      const response = await generateProfiles(selectedProject.id, {
        conversations: profileGenParameters.conversations,
        turns: profileGenParameters.turns,
      });

      // Start polling for status
      const taskId = response.task_id;
      pollGenerationStatus(taskId);

      // Close modal but keep "generating" state active
      setIsGenerateModalOpen(false);
      showToast(
        "info",
        "Profile generation started. This may take a few minutes.",
      );
    } catch (error) {
      console.error("Error generating profiles:", error);
      let errorMessage = "Error starting profile generation";
      try {
        const errorData = JSON.parse(error.message);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (error_) {
        // Console log and toast
        console.error("Error parsing error message:", error_);
      }
      showToast("error", errorMessage);
      setIsGenerating(false);
    }
  };

  const checkForOngoingGeneration = useCallback(
    async (projectId) => {
      if (!projectId) return;

      try {
        const response = await checkOngoingGeneration(projectId);
        if (response.ongoing) {
          // There's an ongoing generation task
          setIsGenerating(true);
          // Reset progress indicators to avoid showing stale data
          setGenerationStage("Loading status...");
          setGenerationProgress(0);
          pollGenerationStatus(response.task_id);
          showToast("info", "Profile generation is in progress");
        }
      } catch (error) {
        console.error("Error checking ongoing generation:", error);
        showToast(
          "error",
          "Error checking ongoing generation. Please try again.",
        );
      }
    },
    [pollGenerationStatus, showToast],
  );

  // This will get called when the user selects a project
  useEffect(() => {
    if (selectedProject) {
      checkForOngoingGeneration(selectedProject.id);
    }
  }, [selectedProject, checkForOngoingGeneration]);

  useEffect(() => {
    return () => {
      if (statusIntervalReference.current) {
        clearInterval(statusIntervalReference.current);
      }
    };
  }, []);

  const handleEditClick = (project) => {
    setEditProjectId(project.id);
    setIsEditOpen(true);
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

  // Delete confirm modal
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    isLoading: false,
  });

  // Initialize with the available technologies
  useEffect(() => {
    const loadData = async () => {
      setLoadingTechnologies(true);
      try {
        const technologies = await fetchChatbotTechnologies();
        setAvailableTechnologies(technologies);
      } catch (error) {
        console.error("Error loading data:", error);
        showToast("error", "Error loading technologies.");
      } finally {
        setLoadingTechnologies(false);
      }
    };
    loadData();
  }, [showToast]);

  // When the selected project changes, reload the files
  useEffect(() => {
    if (selectedProject) {
      reloadFiles();
    }
    // We don't want to trigger this when reloadFiles changes, only when the project selection changes.
  }, [selectedProject, reloadFiles]);

  // When the list of projects changes, verify that the selected project still exists
  useEffect(() => {
    if (selectedProject && projects.length > 0) {
      const projectExists = projects.some((p) => p.id === selectedProject.id);
      if (!projectExists) {
        setSelectedProject(undefined);
      }
    }
  }, [projects, selectedProject, setSelectedProject]);

  /* ------------------------------------------------------ */
  /* ------------------ File Handlers --------------------- */
  /* ------------------------------------------------------ */

  // Drag and drop handlers
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((acceptedFiles) => {
      setSelectedUploadFiles(acceptedFiles);
    }, []),
    accept: {
      "text/yaml": [".yaml", ".yml"],
    },
    noClick: false,
  });

  useEffect(() => {
    globalThis.addEventListener("dragover", preventDefault);
    globalThis.addEventListener("drop", preventDefault);
    return () => {
      globalThis.removeEventListener("dragover", preventDefault);
      globalThis.removeEventListener("drop", preventDefault);
    };
  }, []);

  // This is for the checkboxes
  const selectFile = (id) => {
    setSelectedFiles((previous) =>
      previous.includes(id)
        ? previous.filter((fileId) => fileId !== id)
        : [...previous, id],
    );
  };

  const toggleSelectAllFiles = () => {
    if (selectedFiles.length === files.length) {
      // If all files are already selected, deselect all
      setSelectedFiles([]);
    } else {
      // Otherwise, select all files
      setSelectedFiles(files.map((file) => file.id));
    }
  };

  // Handle upload
  const handleUpload = () => {
    if (!selectedUploadFiles || selectedUploadFiles.length === 0) {
      alert("Please select files to upload.");
      return;
    }

    const formData = new FormData();
    for (const selectedUploadFile of selectedUploadFiles) {
      formData.append("file", selectedUploadFile);
    }

    formData.append("project", selectedProject.id);
    uploadFiles(formData)
      .then(() => {
        reloadFiles(); // Refresh the file list
        setSelectedUploadFiles(undefined);
        if (fileInputReference.current) {
          fileInputReference.current.value = undefined; // Clear the file input
        }
        showToast("success", "Files uploaded successfully!");
      })
      .catch((error) => {
        console.error("Error uploading files:", error);
        try {
          const errorObject = JSON.parse(error.message);
          if (errorObject.errors) {
            const errorMessages = errorObject.errors
              .map((error_) => `Error: ${error_.error}`)
              .join("\n");
            showToast("error", errorMessages);
          } else {
            showToast("error", "Error uploading files");
          }
        } catch {
          showToast("error", "Error uploading files");
        }
      });
  };

  // Delete selected files
  const handleDelete = () => {
    if (selectedFiles.length === 0) {
      alert("No files selected for deletion.");
      return;
    }
    setDeleteConfirmModal({ isOpen: true, isLoading: false });
  };

  const confirmDelete = async () => {
    setDeleteConfirmModal((previous) => ({ ...previous, isLoading: true }));
    try {
      await deleteFiles(selectedFiles);
      setSelectedFiles([]);
      reloadFiles();
      showToast("success", "Files deleted successfully!");
    } catch (error) {
      console.error("Error deleting files:", error);
      showToast("error", "Error deleting files.");
    } finally {
      setDeleteConfirmModal({ isOpen: false, isLoading: false });
    }
  };

  // Open the modal for the execution name
  const openExecuteModal = () => {
    if (selectedFiles.length === 0) {
      showToast("error", "No files selected for test execution.");
      return;
    }

    if (!selectedProject) {
      showToast("error", "Please select a project to execute the test.");
      return;
    }

    // Check if any of the selected files are invalid
    const invalidFiles = files
      .filter(
        (file) => selectedFiles.includes(file.id) && file.is_valid === false,
      )
      .map((file) => file.name);

    if (invalidFiles.length > 0) {
      showToast(
        "error",
        `The following files have validation errors and cannot be executed:\n${invalidFiles.join("\n")}`,
      );
      return;
    }

    setIsExecuteOpen(true);
  };

  // Execute test on selected files and project
  const handleExecuteTest = () => {
    const finalName = executionName.trim();

    executeTest(selectedFiles, selectedProject.id, finalName)
      .then((data) => {
        showToast("success", data.message);
        setIsExecuteOpen(false);
        setExecutionName("");
      })
      .catch((error) => {
        console.error("Error executing test:", error);
        showToast("error", `Error executing test: ${error.message}`);
      });
  };

  // Handle the submit of the execution name
  const handleSubmitPressed = async (event) => {
    // Prevent the reload
    event.preventDefault();
    setLoadingValidation(true);

    // If user left the name blank, skip validation
    if (!executionName.trim()) {
      setValidationErrors({});
      setLoadingValidation(false);
      handleExecuteTest();
      return;
    }

    // Otherwise, check if this name exists
    const existsResponse = await checkTestCaseName(
      selectedProject.id,
      executionName.trim(),
    );

    if (existsResponse.exists) {
      // Name already taken
      setValidationErrors({
        name: "This name is already taken, choose another one or leave it blank for auto-generation.",
      });
    } else {
      // Name is fine, proceed
      setValidationErrors({});
      handleExecuteTest();
    }

    setLoadingValidation(false);
  };

  /* ------------------------------------------------------ */
  /* ------------------ Project Handlers ------------------ */
  /* ------------------------------------------------------ */

  const handleProjectDelete = (projectId) => {
    setDeleteProjectModal({
      isOpen: true,
      isLoading: false,
      projectId,
    });
  };

  const confirmProjectDelete = async () => {
    setDeleteProjectModal((previous) => ({ ...previous, isLoading: true }));
    try {
      await deleteProject(deleteProjectModal.projectId);
      await reloadProjects();
      setSelectedProject(undefined);
      showToast("success", "Project deleted successfully!");
    } catch (error) {
      console.error("Error deleting project:", error);
      showToast("error", "Error deleting project.");
    } finally {
      setDeleteProjectModal({
        isOpen: false,
        isLoading: false,
        projectId: undefined,
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 w-full">
      {selectedProject ? (
        <Card className="p-6 flex-col space-y-6 max-w-lg mx-auto w-full">
          {/* Header */}
          <h1 className="text-3xl font-bold text-center">
            {selectedProject.name}
          </h1>

          {/* LLM Model Information */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                LLM Configuration
              </h3>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Model:
                </span>
                <div className="flex flex-col items-end">
                  {selectedProject.api_key && selectedProject.llm_model ? (
                    <>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {selectedProject.llm_model}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getProviderDisplayName(selectedProject.llm_provider)}
                      </span>
                    </>
                  ) : (
                    <span className="text-red-500 text-sm font-medium">
                      ⚠️ No model configured
                    </span>
                  )}
                </div>
              </div>
              {selectedProject.api_key && selectedProject.llm_model && (
                <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                  💡 <strong>Note:</strong> This model will be used for test
                  execution. Check costs before running large test suites.
                </div>
              )}
            </div>
          </div>

          {/* Project Dropdown */}
          <div className="flex flex-col space-y-4">
            <Button
              color="default"
              variant="ghost"
              onPress={() => setSelectedProject(undefined)}
              startContent={<X className="w-4 h-4" />}
            >
              Change Project
            </Button>
          </div>

          {/* Project Details */}
          <div>
            {/* Upload Section */}
            <div className="flex flex-col space-y-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-5 transition-all duration-300 ease-in-out flex flex-col items-center justify-center ${
                  isDragActive
                    ? "border-primary bg-primary-50 dark:bg-primary-900/20 shadow-lg"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 mb-2">
                  <Upload
                    className={`transition-all duration-300 ease-in-out ${
                      isDragActive
                        ? "text-primary scale-125 opacity-80"
                        : "text-gray-400 hover:text-gray-500"
                    } w-10 h-10`}
                  />
                  <div className="text-center">
                    <p
                      className={`text-sm font-medium transition-all duration-300 ${
                        isDragActive ? "text-primary" : ""
                      }`}
                    >
                      {isDragActive
                        ? "Drop files here"
                        : "Drag and drop YAML files here"}
                    </p>
                    <p className="text-xs mt-0.5 text-gray-500">
                      or click to browse
                    </p>
                  </div>
                </div>

                {/* File list part, keep your existing implementation */}
                {selectedUploadFiles && selectedUploadFiles.length > 0 && (
                  <div className="mt-4 w-full">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {selectedUploadFiles.length === 1
                          ? "1 file selected"
                          : `${selectedUploadFiles.length} files selected`}
                      </span>
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => {
                          setSelectedUploadFiles(undefined);
                          if (fileInputReference.current) {
                            fileInputReference.current.value = undefined;
                          }
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-2 max-h-28 overflow-y-auto">
                      <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        {[...selectedUploadFiles].map((file, index) => (
                          <li
                            key={index}
                            className="truncate flex items-center"
                          >
                            <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                            {file.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button
                      className="mt-3 w-full"
                      color="primary"
                      onPress={handleUpload}
                      startContent={<Upload className="w-4 h-4" />}
                    >
                      Upload{" "}
                      {selectedUploadFiles.length > 1
                        ? `${selectedUploadFiles.length} Files`
                        : "File"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Create New YAML button */}
              <Button
                onPress={() => navigate("/yaml-editor")}
                fullWidth
                color="secondary"
                variant="ghost"
                startContent={<File className="w-4 h-4" />}
              >
                Create Profile Manually
              </Button>

              {/* Auto generate profiles */}
              <Button
                fullWidth
                color="secondary"
                variant="ghost"
                startContent={
                  isGenerating ? undefined : <Sparkles className="w-4 h-4" />
                }
                isLoading={isGenerating}
                isDisabled={isGenerating}
                onPress={() => setIsGenerateModalOpen(true)}
              >
                {isGenerating
                  ? "Generating Profiles..."
                  : "Auto-Generate Profiles"}
              </Button>
              {isGenerating && (
                <div className="mt-4 border-2 border-primary/20 rounded-lg p-4 flex flex-col items-center">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse mb-2" />
                  <h3 className="text-base font-medium mb-1">
                    Generating Profiles
                  </h3>
                  {generationStage && (
                    <p className="text-sm font-medium text-primary mb-1">
                      {generationStage}
                    </p>
                  )}
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${generationProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {generationProgress}% complete
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
                    This might take a few minutes. Please wait...
                  </p>
                </div>
              )}
            </div>

            {/* List Section */}
            <div className="flex-1 overflow-y-auto mt-4">
              {files.length > 0 ? (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      {files.length} profiles
                    </span>
                    <Button
                      size="sm"
                      variant="light"
                      color="primary"
                      onPress={toggleSelectAllFiles}
                    >
                      {selectedFiles.length === files.length
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {files.map((file) => (
                      <li key={file.id} className="flex flex-col space-y-1">
                        <div className="flex items-start space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(file.id)}
                            onChange={() => selectFile(file.id)}
                            className="form-checkbox h-4 w-4 mt-1"
                          />
                          <div className="flex items-center space-x-2 flex-1">
                            <Link
                              variant="light"
                              onPress={() =>
                                navigate(`/yaml-editor/${file.id}`)
                              }
                              className="flex-1 break-words max-w-sm md:max-w-lg lg:max-w-2xl text-blue-500 hover:underline text-left"
                            >
                              {file.name}
                            </Link>
                            {file.is_valid === false && (
                              <div
                                className="tooltip-container"
                                title="Invalid profile: This YAML has validation errors"
                              >
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-gray-500 text-center">
                  No profiles uploaded yet.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex space-x-4">
              <Button
                color="danger"
                className="flex-1"
                onPress={handleDelete}
                startContent={<Trash className="w-4 h-4" />}
              >
                Delete Selected
              </Button>
              <Button
                color="primary"
                className="flex-1"
                onPress={openExecuteModal}
                startContent={<Play className="w-4 h-4" />}
              >
                Execute Test
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col space-y-4">
          <h2 className="text-xl font-bold text-center">Select a Project</h2>
          <ProjectsList
            projects={projects}
            technologies={availableTechnologies}
            loading={loadingProjects || loadingTechnologies}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            onEditProject={handleEditClick}
            onDeleteProject={handleProjectDelete}
          />
          <Button
            color="primary"
            className="max-w-[200px] mx-auto"
            onPress={() => onOpen()}
            startContent={<Plus className="w-4 h-4" />}
          >
            Create New Project
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------ */}
      {/* ------------------ Modals ---------------------------- */}
      {/* ------------------------------------------------------ */}

      {/* Generate Profiles Modal */}
      <Modal isOpen={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <ModalContent>
          <ModalHeader>Generate Profiles</ModalHeader>
          <ModalBody className="flex flex-col gap-4">
            <p className="text-gray-600 dark:text-gray-400">
              Profiles are generated based on conversations. More conversations
              with more turns create better profiles but take longer to
              generate.
            </p>
            <div className="space-y-4">
              <Input
                label="Number of conversations"
                type="number"
                min="1"
                value={profileGenParameters.conversations.toString()}
                onValueChange={(value) =>
                  handleProfileGenParameterChange("conversations", value)
                }
              />
              <Input
                label="Turns per conversation"
                type="number"
                min="1"
                value={profileGenParameters.turns.toString()}
                onValueChange={(value) =>
                  handleProfileGenParameterChange("turns", value)
                }
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="light"
              onPress={() => setIsGenerateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isGenerating}
              isDisabled={isGenerating}
              onPress={handleGenerateProfiles}
            >
              Generate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        technologies={availableTechnologies}
        onProjectCreated={async (newProject) => {
          await reloadProjects();
          setSelectedProject(newProject);
        }}
      />

      {/* Modal execution name */}
      <Modal isOpen={isExecuteOpen} onOpenChange={setIsExecuteOpen}>
        <ModalContent>
          <ModalHeader>Execute Test</ModalHeader>
          <ModalBody className="flex flex-col gap-4 items-center">
            <Form
              className="w-full"
              onSubmit={handleSubmitPressed}
              onReset={() => setIsExecuteOpen(false)}
              validationErrors={validationErrors}
            >
              <Input
                name="name"
                label="Execution Name (optional)"
                value={executionName}
                onValueChange={setExecutionName}
                isDisabled={loadingValidation}
              />
              <ModalFooter className="w-full flex justify-center gap-4">
                <Button type="reset" color="danger" variant="light">
                  Cancel
                </Button>
                {/* Didn't add isLoading={loadingValidation} because it looks werid since it loads instantly */}
                <Button type="submit" color="primary">
                  Execute
                </Button>
              </ModalFooter>
            </Form>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={deleteConfirmModal.isOpen}
        onOpenChange={(isOpen) =>
          setDeleteConfirmModal((previous) => ({ ...previous, isOpen }))
        }
      >
        <ModalContent>
          <ModalHeader>Confirm Deletion</ModalHeader>
          <ModalBody className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete the selected files?
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              onPress={() =>
                setDeleteConfirmModal((previous) => ({
                  ...previous,
                  isOpen: false,
                }))
              }
            >
              Cancel
            </Button>
            <Button
              color="danger"
              isLoading={deleteConfirmModal.isLoading}
              onPress={confirmDelete}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Project Modal */}
      <Modal
        isOpen={deleteProjectModal.isOpen}
        onOpenChange={(isOpen) =>
          setDeleteProjectModal((previous) => ({ ...previous, isOpen }))
        }
      >
        <ModalContent>
          <ModalHeader>Delete Project</ModalHeader>
          <ModalBody className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete this project? This action cannot be
            undone.
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              onPress={() =>
                setDeleteProjectModal((previous) => ({
                  ...previous,
                  isOpen: false,
                }))
              }
            >
              Cancel
            </Button>
            <Button
              color="danger"
              isLoading={deleteProjectModal.isLoading}
              onPress={confirmProjectDelete}
            >
              Delete Project
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        project={
          editProjectId
            ? projects.find((p) => p.id === editProjectId)
            : undefined
        }
        technologies={availableTechnologies}
        onProjectUpdated={handleProjectUpdated}
      />
    </div>
  );
}

export default Home;
