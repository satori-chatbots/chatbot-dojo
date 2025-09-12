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
  Select,
  SelectItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tabs,
  Tab,
} from "@heroui/react";
import {
  Upload,
  File,
  Trash,
  Play,
  Plus,
  Sparkles,
  ChevronDown,
  Settings,
  ArrowRight,
} from "lucide-react";
import {
  uploadFiles,
  deleteFiles,
  generateProfiles,
  checkOngoingGeneration,
  checkTracerGenerationStatus,
  fetchProfileExecutions,
  fetchTracerExecutions,
  deleteProfileExecution,
  fetchFiles,
  fetchSenseiCheckRules,
  uploadSenseiCheckRules,
} from "../api/file-api";
import { deleteProject, fetchProject } from "../api/project-api";
import { fetchChatbotConnectors } from "../api/chatbot-connector-api";
import { getUserApiKeys } from "../api/authentication-api";
import useFetchProjects from "../hooks/use-fetch-projects";
import { executeTest, checkTestCaseName } from "../api/test-cases-api";
import useSelectedProject from "../hooks/use-selected-projects";
import CreateProjectModal from "../components/create-project-modal";
import EditProjectModal from "../components/edit-project-modal";
import ExecutionFolder from "../components/execution-folder";
import ProjectsList from "../components/project-list";
import SetupProgress from "../components/setup-progress";
import { useSetup } from "../contexts/setup-context";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { getProviderDisplayName } from "../constants/providers";
import SenseiCheckRules from "../components/sensei-check-rules";

// Move preventDefault to the outer scope
const preventDefault = (event) => event.preventDefault();

// Helper function to get API key name
const getApiKeyName = (apiKeyId, apiKeys) => {
  if (!apiKeyId || !apiKeys) return "Unknown";
  const apiKey = apiKeys.find((key) => key.id === apiKeyId);
  return apiKey ? apiKey.name : "Unknown";
};

function Home() {
  const { showToast } = useMyCustomToast();
  const { reloadProjects: reloadSetupProjects, reloadProfiles } = useSetup();

  // List of available chatbot connectors (eg Taskyto, Rasa, etc.)
  const [availableConnectors, setAvailableConnectors] = useState([]);
  const [loadingConnectors, setLoadingConnectors] = useState(true);

  // List of available API keys
  const [availableApiKeys, setAvailableApiKeys] = useState([]);

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

  // List of profile executions in the selected project
  const [executions, setExecutions] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);

  // List of sensei check rules in the selected project
  const [senseiCheckRules, setSenseiCheckRules] = useState([]);
  const [loadingSenseiCheckRules, setLoadingSenseiCheckRules] = useState(false);

  // Track which execution folders are expanded to show all profiles
  const [expandedExecutions, setExpandedExecutions] = useState(new Set());

  // Function to reload executions and profiles
  const reloadExecutions = useCallback(async () => {
    if (!selectedProject) {
      setExecutions([]);
      setAllProfiles([]);
      return;
    }

    setLoadingExecutions(true);
    try {
      // Fetch both profile executions (for manual) and tracer executions (for tracer)
      const [profileData, tracerData] = await Promise.all([
        fetchProfileExecutions(selectedProject.id),
        fetchTracerExecutions(),
      ]);

      // Filter tracer executions to only include those for the current project
      const projectTracerExecutions = (tracerData.executions || []).filter(
        (execution) => execution.project_id === selectedProject.id,
      );

      // Fetch profiles for tracer executions
      const tracerExecutionsWithProfiles = await Promise.all(
        projectTracerExecutions.map(async (execution) => {
          if (execution.generated_profiles_count > 0) {
            try {
              // Get the editable TestFiles for this execution
              const testFiles = await fetchFiles(selectedProject.id);
              const executionTestFiles = testFiles.filter(
                (file) => file.execution === execution.id,
              );

              // Map TestFiles to the expected profile format
              const profiles = executionTestFiles.map((file) => ({
                id: file.id, // Use the actual TestFile ID for YAML editor
                name: file.name || file.file.name, // Use the processed name from TestFile
                is_valid: file.is_valid,
                uploaded_at: file.uploaded_at,
                content: undefined, // Content will be fetched by YAML editor when needed
              }));

              return {
                ...execution,
                execution_type: "tracer",
                profiles,
              };
            } catch (error) {
              console.error(
                `Error fetching profiles for tracer execution ${execution.id}:`,
                error,
              );
              // Fallback to empty profiles if fetch fails
              return {
                ...execution,
                execution_type: "tracer",
                profiles: [],
              };
            }
          } else {
            return {
              ...execution,
              execution_type: "tracer",
              profiles: [],
            };
          }
        }),
      );

      // Combine and sort executions: manual first, then tracer by date
      const manualExecutions = (profileData.executions || []).filter(
        (exec) => exec.execution_type === "manual",
      );
      const tracerExecutions = tracerExecutionsWithProfiles;

      // Sort manual executions by date (newest first)
      const sortedManualExecutions = manualExecutions.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );

      // Sort tracer executions by date (newest first)
      const sortedTracerExecutions = tracerExecutions.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );

      // Combine: manual first, then tracer
      const allExecutions = [
        ...sortedManualExecutions,
        ...sortedTracerExecutions,
      ];

      setExecutions(allExecutions);

      // Flatten all profiles for easy selection management (from both manual and tracer executions)
      const profiles = [];
      if (profileData.executions) {
        for (const execution of profileData.executions) {
          if (execution.execution_type === "manual") {
            for (const profile of execution.profiles) {
              profiles.push(profile);
            }
          }
        }
      }
      // Add tracer profiles to the flattened list
      for (const execution of tracerExecutionsWithProfiles) {
        for (const profile of execution.profiles) {
          profiles.push(profile);
        }
      }
      setAllProfiles(profiles);
    } catch (error) {
      console.error("Error fetching executions:", error);
      showToast("error", "Error loading profile executions");
      setExecutions([]);
      setAllProfiles([]);
    } finally {
      setLoadingExecutions(false);
    }
  }, [selectedProject, showToast]);

  // Function to reload sensei check rules
  const reloadSenseiCheckRules = useCallback(async () => {
    if (!selectedProject) {
      setSenseiCheckRules([]);
      return;
    }

    setLoadingSenseiCheckRules(true);
    try {
      const rules = await fetchSenseiCheckRules(selectedProject.id);
      setSenseiCheckRules(rules);
    } catch (error) {
      console.error("Error fetching SENSEI Check rules:", error);
      showToast("error", "Error loading SENSEI Check rules");
      setSenseiCheckRules([]);
    } finally {
      setLoadingSenseiCheckRules(false);
    }
  }, [selectedProject, showToast]);

  // Handler for execution deletion
  const handleDeleteExecution = useCallback(
    async (executionId) => {
      try {
        const response = await deleteProfileExecution(executionId);
        showToast(
          "success",
          response.message || "Execution deleted successfully",
        );

        // Clear any selected files that belonged to this execution
        const executionToDelete = executions.find(
          (exec) => exec.id === executionId,
        );
        if (executionToDelete) {
          const profilesToDeselect = new Set(
            executionToDelete.profiles.map((p) => p.id),
          );
          setSelectedFiles((prev) =>
            prev.filter((id) => !profilesToDeselect.has(id)),
          );
        }

        // Reload executions and profiles
        await reloadExecutions();
        await reloadProfiles(); // Update setup progress
      } catch (error) {
        console.error("Error deleting execution:", error);
        let errorMessage = "Error deleting execution";
        try {
          const errorData = JSON.parse(error.message);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Use default message if parsing fails
        }
        showToast("error", errorMessage);
      }
    },
    [executions, reloadExecutions, reloadProfiles, showToast],
  );

  // Loading state for the serverside validation of the execution name
  const [loadingValidation, setLoadingValidation] = useState(false);

  // Errors for the serverside validation of the execution name
  const [validationErrors, setValidationErrors] = useState({});

  // Profiles generation states
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [profileGenParameters, setProfileGenParameters] = useState({
    sessions: 8,
    turns_per_session: 5,
    verbosity: "normal",
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
      [field]: field === "verbosity" ? value : Number.parseInt(value) || 0,
    }));
  };

  const pollGenerationStatus = useCallback(
    async (celeryTaskId) => {
      // Clear any existing interval
      if (statusIntervalReference.current) {
        clearInterval(statusIntervalReference.current);
      }

      // Set up interval to check status using Celery task ID
      statusIntervalReference.current = setInterval(async () => {
        try {
          const status = await checkTracerGenerationStatus(celeryTaskId);

          if (status.status === "SUCCESS") {
            clearInterval(statusIntervalReference.current);
            statusIntervalReference.current = undefined;
            // Explicitly reload executions when generation completes
            await reloadExecutions();
            await reloadProfiles(); // Update setup progress
            setIsGenerating(false);
            showToast(
              "success",
              `Successfully generated ${status.generated_files || 0} profiles!`,
            );
          } else if (status.status === "FAILURE") {
            clearInterval(statusIntervalReference.current);
            statusIntervalReference.current = undefined;
            // Reload executions to update the status in the UI
            await reloadExecutions();
            setIsGenerating(false);
            const errorMessage =
              status.error_message ||
              "An error occurred during profile generation";
            showToast("error", errorMessage);
          } else {
            // Update the stage information in the UI
            setGenerationStage(status.stage || "Processing");
            setGenerationProgress(status.progress || 0);
            // Don't reload executions during progress updates to avoid page jumping
          }
        } catch {
          clearInterval(statusIntervalReference.current);
          statusIntervalReference.current = undefined;
          setIsGenerating(false);
          showToast("error", "Error checking generation status");
        }
      }, 2000); // Check every 2 seconds for more responsive progress updates
    },
    [reloadExecutions, reloadProfiles, showToast],
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
        sessions: profileGenParameters.sessions,
        turns_per_session: profileGenParameters.turns_per_session,
        verbosity: profileGenParameters.verbosity,
      });

      // Start polling for status using Celery task ID
      const celeryTaskId = response.celery_task_id;
      pollGenerationStatus(celeryTaskId);

      // Reload executions to show the new one
      await reloadExecutions();

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
        if (response.ongoing && response.celery_task_id) {
          // There's an ongoing generation task
          setIsGenerating(true);
          // Reset progress indicators to avoid showing stale data
          setGenerationStage("Loading status...");
          setGenerationProgress(0);
          pollGenerationStatus(response.celery_task_id);
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
    } else {
      // Clear generation status when no project is selected
      setIsGenerating(false);
      setGenerationStage("");
      setGenerationProgress(0);
      // Clear any ongoing polling
      if (statusIntervalReference.current) {
        clearInterval(statusIntervalReference.current);
        statusIntervalReference.current = undefined;
      }
    }
  }, [selectedProject, checkForOngoingGeneration]);

  // Clear generation status when switching between projects
  useEffect(() => {
    // Reset generation status immediately when project changes
    setIsGenerating(false);
    setGenerationStage("");
    setGenerationProgress(0);
    // Clear any ongoing polling from previous project
    if (statusIntervalReference.current) {
      clearInterval(statusIntervalReference.current);
      statusIntervalReference.current = undefined;
    }
  }, [selectedProject?.id]); // Only trigger when project ID changes

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
    await reloadSetupProjects(); // Update setup progress

    // If the edited project is the currently selected project, fetch fresh data
    if (selectedProject && editProjectId === selectedProject.id) {
      try {
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

  // Initialize with the available connectors and API keys
  useEffect(() => {
    const loadData = async () => {
      setLoadingConnectors(true);
      try {
        const [connectors, apiKeys] = await Promise.all([
          fetchChatbotConnectors(),
          getUserApiKeys(),
        ]);
        setAvailableConnectors(connectors);
        setAvailableApiKeys(apiKeys);
      } catch (error) {
        console.error("Error loading data:", error);
        // Provide more specific error messages based on the error
        if (
          error.message?.includes("connector") ||
          error.message?.includes("chatbot")
        ) {
          showToast("error", "Error loading chatbot connectors.");
        } else if (
          error.message?.includes("api") ||
          error.message?.includes("key")
        ) {
          showToast("error", "Error loading API keys.");
        } else {
          showToast("error", "Error loading project data.");
        }
      } finally {
        setLoadingConnectors(false);
      }
    };
    loadData();
  }, [showToast]);

  // When the selected project changes, reload the executions
  useEffect(() => {
    reloadExecutions();
    reloadSenseiCheckRules();
  }, [selectedProject, reloadExecutions, reloadSenseiCheckRules]);

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

  // Handle execution folder expansion
  const toggleShowAllProfiles = (executionId) => {
    setExpandedExecutions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(executionId)) {
        newSet.delete(executionId);
      } else {
        newSet.add(executionId);
      }
      return newSet;
    });
  };

  const toggleSelectAllFiles = () => {
    if (selectedFiles.length === allProfiles.length) {
      // If all files are already selected, deselect all
      setSelectedFiles([]);
    } else {
      // Otherwise, select all files
      setSelectedFiles(allProfiles.map((profile) => profile.id));
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
      .then(async () => {
        await reloadExecutions(); // Refresh the executions list
        await reloadProfiles(); // Update setup progress
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
      await reloadExecutions();
      await reloadProfiles(); // Update setup progress
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
    const invalidFiles = allProfiles
      .filter(
        (profile) =>
          selectedFiles.includes(profile.id) && profile.is_valid === false,
      )
      .map((profile) => profile.name);

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
      await reloadSetupProjects(); // Update setup progress
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

  // Helper to get missing config message for LLM Configuration
  const getMissingConfigMessage = () => {
    if (!selectedProject.api_key)
      return { color: "red", message: "No API key configured" };
    if (!selectedProject.llm_model)
      return { color: "red", message: "No exploration model configured" };
    if (!selectedProject.profile_model)
      return {
        color: "amber",
        message: "No profile model configured (optional)",
      };
    return { color: "", message: "No models configured" };
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 flex flex-col items-center space-y-4 sm:space-y-6 w-full max-w-7xl mx-auto my-auto">
      {/* Setup Progress - always visible when not complete */}
      <div className="w-full max-w-lg">
        <SetupProgress isCompact={true} />
      </div>

      {selectedProject ? (
        <Card className="p-4 sm:p-6 flex-col space-y-4 sm:space-y-6 max-w-lg mx-auto w-full bg-content3 dark:bg-darkbg-glass dark:backdrop-blur-md shadow-glass rounded-2xl border border-border dark:border-border-dark">
          {/* Header with Dropdown */}
          <div className="flex items-center justify-center relative">
            <div className="flex items-center justify-center flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground dark:text-foreground-dark truncate text-center">
                {selectedProject.name}
              </h1>
            </div>
            <Dropdown>
              <DropdownTrigger>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  className="project-dropdown-btn flex-shrink-0 ml-2"
                  aria-label="Project actions"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Project actions">
                <DropdownItem
                  key="edit"
                  startContent={<Settings className="w-4 h-4" />}
                  onPress={() => {
                    setEditProjectId(selectedProject.id);
                    setIsEditOpen(true);
                  }}
                >
                  Edit Project
                </DropdownItem>
                <DropdownItem
                  key="change"
                  startContent={<ArrowRight className="w-4 h-4" />}
                  onPress={() => setSelectedProject(undefined)}
                >
                  Change Project
                </DropdownItem>
                <DropdownItem
                  key="delete"
                  startContent={<Trash className="w-4 h-4" />}
                  className="text-danger"
                  color="danger"
                  onPress={() => handleProjectDelete(selectedProject.id)}
                >
                  Remove Project
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>

          {/* LLM Model Information */}
          <div className="bg-background-subtle dark:bg-darkbg-card rounded-lg p-3 sm:p-4 border border-border dark:border-border-dark backdrop-blur-sm">
            <div className="flex flex-col space-y-1">
              <h3 className="text-sm font-semibold text-foreground dark:text-foreground-dark mb-2">
                LLM Configuration
              </h3>
              {selectedProject.api_key &&
              selectedProject.llm_model &&
              selectedProject.profile_model ? (
                <div className="flex flex-col space-y-3">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                    <div className="flex flex-col">
                      <span className="text-xs text-foreground/60 dark:text-foreground-dark/60">
                        Provider
                      </span>
                      <span className="text-sm font-medium text-foreground dark:text-foreground-dark">
                        {getProviderDisplayName(selectedProject.llm_provider)}
                      </span>
                    </div>
                    <div className="flex flex-col sm:items-end">
                      <span className="text-xs text-foreground/60 dark:text-foreground-dark/60">
                        API Key
                      </span>
                      <span className="text-sm font-medium text-foreground dark:text-foreground-dark">
                        {getApiKeyName(
                          selectedProject.api_key,
                          availableApiKeys,
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                    <div className="flex flex-col">
                      <span className="text-xs text-foreground/60 dark:text-foreground-dark/60">
                        Exploration Model
                      </span>
                      <span className="text-sm font-medium text-foreground dark:text-foreground-dark">
                        {selectedProject.llm_model}
                      </span>
                    </div>
                    <div className="flex flex-col sm:items-end">
                      <span className="text-xs text-foreground/60 dark:text-foreground-dark/60">
                        Profile Model
                      </span>
                      <span className="text-sm font-medium text-foreground dark:text-foreground-dark">
                        {selectedProject.profile_model}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  {(() => {
                    const { color, message } = getMissingConfigMessage();
                    if (color === "red") {
                      return (
                        <span className="text-red-500 text-sm font-medium">
                          ⚠️ {message}
                        </span>
                      );
                    }
                    if (color === "amber") {
                      return (
                        <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                          ℹ️ {message}
                        </span>
                      );
                    }
                    return (
                      <span className="text-default-600 text-sm font-medium">
                        {message}
                      </span>
                    );
                  })()}
                </div>
              )}
              {selectedProject.api_key &&
                selectedProject.llm_model &&
                selectedProject.profile_model && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10 p-2 rounded border border-amber-200/50 dark:border-amber-800/30 backdrop-blur-sm mt-2">
                    💡 <strong>Important:</strong> API provider must match the
                    provider in your profiles. Check costs before running tests.
                  </div>
                )}
            </div>
          </div>

          {/* Project Details */}
          <div>
            <Tabs aria-label="Options">
              <Tab key="profiles" title="User Profiles">
                {/* Upload Section */}
                <div className="flex flex-col space-y-4">
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-5 transition-all duration-300 ease-in-out flex flex-col items-center justify-center ${
                      isDragActive
                        ? "border-primary bg-primary-50 dark:bg-primary-900/20 shadow-lg"
                        : "border-border dark:border-border-dark hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-2 mb-2">
                      <Upload
                        className={`transition-all duration-300 ease-in-out ${
                          isDragActive
                            ? "text-primary scale-125 opacity-80"
                            : "text-foreground/50 dark:text-foreground-dark/50 hover:text-foreground/70 dark:hover:text-foreground-dark/70"
                        } w-10 h-10`}
                      />
                      <div className="text-center">
                        <p
                          className={`text-sm font-medium transition-all duration-300 ${
                            isDragActive
                              ? "text-primary"
                              : "text-foreground dark:text-foreground-dark"
                          }`}
                        >
                          {isDragActive
                            ? "Drop files here"
                            : "Drag and drop YAML files here"}
                        </p>
                        <p className="text-xs mt-0.5 text-foreground/60 dark:text-foreground-dark/60">
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
                        <div className="bg-background-subtle dark:bg-darkbg-card rounded-md p-2 max-h-28 overflow-y-auto backdrop-blur-sm border border-border dark:border-border-dark">
                          <ul className="text-sm text-foreground/70 dark:text-foreground-dark/70 space-y-1">
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
                      isGenerating ? undefined : (
                        <Sparkles className="w-4 h-4" />
                      )
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
                      <h3 className="text-base font-medium mb-1 text-foreground dark:text-foreground-dark">
                        Generating Profiles
                      </h3>
                      {generationStage && (
                        <p className="text-sm font-medium text-primary mb-2 text-center">
                          {generationStage}
                        </p>
                      )}
                      <div className="w-full bg-muted dark:bg-muted-dark rounded-full h-2.5 mb-2">
                        <div
                          className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${generationProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-foreground/60 dark:text-foreground-dark/60 text-center">
                        {generationProgress}% complete
                      </p>
                      <p className="text-xs text-foreground/50 dark:text-foreground-dark/50 text-center mt-1">
                        This process may take a few minutes depending on the
                        complexity of your chatbot.
                      </p>
                    </div>
                  )}
                </div>

                {/* Profile Executions Section */}
                <div className="flex-1 overflow-y-auto mt-4">
                  {loadingExecutions ? (
                    <div className="text-center py-4">
                      <p className="text-default-500">Loading executions...</p>
                    </div>
                  ) : executions.length > 0 ? (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-medium text-foreground dark:text-foreground-dark">
                          📁 Profile Executions ({allProfiles.length} profiles
                          total)
                        </span>
                        <Button
                          size="sm"
                          variant="light"
                          color="primary"
                          onPress={toggleSelectAllFiles}
                        >
                          {selectedFiles.length === allProfiles.length
                            ? "Deselect All"
                            : "Select All"}
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {executions.map((execution) => (
                          <ExecutionFolder
                            key={execution.id}
                            execution={execution}
                            profiles={execution.profiles}
                            selectedFiles={selectedFiles}
                            onProfileSelect={selectFile}
                            showAll={expandedExecutions.has(execution.id)}
                            onToggleShowAll={toggleShowAllProfiles}
                            onDeleteExecution={handleDeleteExecution}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-foreground/60 dark:text-foreground-dark/60 text-center">
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
              </Tab>
              <Tab key="sensei-check" title="SENSEI Check">
                <SenseiCheckRules
                  project={selectedProject}
                  rules={senseiCheckRules}
                  reloadRules={reloadSenseiCheckRules}
                />
              </Tab>
            </Tabs>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col space-y-4 w-full">
          <h2 className="text-xl font-bold text-center text-foreground dark:text-foreground-dark">
            Select a Project
          </h2>
          <div className="w-full px-2 sm:px-0">
            <ProjectsList
              projects={projects}
              connectors={availableConnectors}
              loading={loadingProjects || loadingConnectors}
              selectedProject={selectedProject}
              onSelectProject={setSelectedProject}
              onEditProject={handleEditClick}
              onDeleteProject={handleProjectDelete}
            />
          </div>
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
          <ModalHeader>Generate Profiles with TRACER</ModalHeader>
          <ModalBody className="flex flex-col gap-4">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">
                  📊 Configuration
                </h4>
                <div className="space-y-3">
                  <Input
                    label="Sessions (exploration sessions)"
                    type="number"
                    min="1"
                    value={profileGenParameters.sessions.toString()}
                    onValueChange={(value) =>
                      handleProfileGenParameterChange("sessions", value)
                    }
                  />
                  <Input
                    label="Turns per session"
                    type="number"
                    min="1"
                    value={profileGenParameters.turns_per_session.toString()}
                    onValueChange={(value) =>
                      handleProfileGenParameterChange(
                        "turns_per_session",
                        value,
                      )
                    }
                  />
                  <Select
                    label="Log Verbosity"
                    selectedKeys={[profileGenParameters.verbosity]}
                    onSelectionChange={(selection) => {
                      const verbosity = [...selection][0];
                      handleProfileGenParameterChange("verbosity", verbosity);
                    }}
                    description="Choose log detail level for debugging"
                  >
                    <SelectItem key="normal" textValue="Normal">
                      <div className="flex flex-col">
                        <span className="text-small">Normal</span>
                        <span className="text-tiny text-default-400">
                          Standard output
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem key="verbose" textValue="Verbose">
                      <div className="flex flex-col">
                        <span className="text-small">Verbose (-v)</span>
                        <span className="text-tiny text-default-400">
                          Shows conversations and interactions
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem key="debug" textValue="Debug">
                      <div className="flex flex-col">
                        <span className="text-small">Debug (-vv)</span>
                        <span className="text-tiny text-default-400">
                          Debug mode with detailed technical info
                        </span>
                      </div>
                    </SelectItem>
                  </Select>
                </div>
              </div>

              <div className="pt-2 border-t border-default-200">
                <h4 className="text-sm font-medium text-foreground mb-2">
                  📝 Using:
                </h4>
                <div className="text-sm text-default-600 space-y-1">
                  <div>
                    Exploration Model:{" "}
                    {selectedProject?.llm_model || "gpt-4o-mini"} (TRACER
                    exploration)
                  </div>
                  <div>
                    Profile Model:{" "}
                    {selectedProject?.profile_model || "gpt-4o-mini"} (embedded
                    in profiles)
                  </div>
                  <div>
                    Technology:{" "}
                    {availableConnectors.find(
                      (c) => c.id === selectedProject?.chatbot_connector,
                    )?.technology || "Unknown"}{" "}
                    (from connector)
                  </div>
                </div>
              </div>
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
              Generate Profiles
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        connectors={availableConnectors}
        onProjectCreated={async (newProject) => {
          await reloadProjects();
          await reloadSetupProjects(); // Update setup progress
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
          <ModalBody className="text-foreground/70 dark:text-foreground-dark/70">
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
          <ModalBody className="text-foreground/70 dark:text-foreground-dark/70">
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
        connectors={availableConnectors}
        onProjectUpdated={handleProjectUpdated}
      />
    </div>
  );
}

export default Home;
