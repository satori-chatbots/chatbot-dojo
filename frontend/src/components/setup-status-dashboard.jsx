import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Progress,
  Chip,
  Divider,
} from "@heroui/react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  User,
  Zap,
  FolderOpen,
  FileText,
  ChevronRight,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getUserApiKeys } from "../api/authentication-api";
import { fetchChatbotConnectors } from "../api/chatbot-connector-api";
import useFetchProjects from "../hooks/use-fetch-projects";
import useFetchFiles from "../hooks/use-fetch-files";
import useSelectedProject from "../hooks/use-selected-projects";

// Helper function to get step status
const getStepStatus = (step) => {
  if (step.disabled) {
    return { text: "Select Project First", color: "warning" };
  }
  if (step.status.loading) {
    return { text: "Loading...", color: "default" };
  }
  if (step.status.completed) {
    return { text: "Complete", color: "success" };
  }
  return { text: "Incomplete", color: "danger" };
};

// Detailed explanations for each step
const getStepExplanation = (stepId, status, selectedProject) => {
  const explanations = {
    apikeys: {
      title: "Why API Keys are needed",
      content: status.completed
        ? `✅ You have ${status.count} API key${status.count !== 1 ? "s" : ""} configured. These provide access to LLM providers (OpenAI, Google, etc.) that power the user simulator.`
        : "🔑 API keys are required to access LLM providers (OpenAI, Google, Anthropic, etc.) that power Sensei's user simulator. The simulator uses these AI models to act as realistic users during testing.",
      action: status.completed
        ? "View or add more API keys"
        : "Add your first API key to enable user simulation",
    },
    connectors: {
      title: "Why Chatbot Connectors are needed",
      content: status.completed
        ? `✅ You have ${status.count} connector${status.count !== 1 ? "s" : ""} configured. These connect Sensei to different chatbot technologies for testing.`
        : "🔌 Chatbot connectors link Sensei to the chatbots you want to test (Taskyto, Ada, Rasa, etc.). Each connector knows how to communicate with a specific chatbot technology.",
      action: status.completed
        ? "View or add more connectors"
        : "Configure connectors to your chatbot platforms",
    },
    projects: {
      title: "Why Projects are needed",
      content: status.completed
        ? `✅ You have ${status.count} project${status.count !== 1 ? "s" : ""}, with ${status.hasConfiguredProject ? "at least one fully configured" : "none fully configured yet"}. Projects organize your testing scenarios and link API keys with connectors.`
        : "📁 Projects organize your testing scenarios. Each project links an API key (for user simulation) with a chatbot connector (what to test) and contains user profiles that define test behaviors.",
      action: status.completed
        ? "View or configure more projects"
        : "Create a project to organize your tests",
    },
    profiles: {
      title: "Why User Profiles are needed",
      content: selectedProject
        ? status.completed
          ? `✅ You have ${status.count} profile${status.count !== 1 ? "s" : ""} in "${selectedProject.name}". These YAML files define how the user simulator behaves during conversations with your chatbot.`
          : `📄 User profiles are YAML files that define how Sensei simulates users. They specify user goals, conversation styles, questions to ask, and expected outputs. You can create them manually, upload existing ones, or auto-generate them with TRACER.`
        : "📄 User profiles define how the user simulator behaves during testing. Select a project first to manage profiles for that specific testing scenario.",
      action: selectedProject
        ? status.completed
          ? "View, edit, or add more profiles"
          : "Create your first user profile to start testing"
        : "Select a project first",
    },
  };

  return (
    explanations[stepId] || {
      title: "Setup Step",
      content: "Configuration needed for Sensei.",
      action: "Configure this step",
    }
  );
};

const SetupStatusDashboard = ({ compact = false, showTitle = true }) => {
  const navigate = useNavigate();
  const [selectedProject] = useSelectedProject();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Status states
  const [apiKeysStatus, setApiKeysStatus] = useState({
    loading: true,
    completed: false,
    count: 0,
  });

  const [connectorsStatus, setConnectorsStatus] = useState({
    loading: true,
    completed: false,
    count: 0,
  });

  const [projectsStatus, setProjectsStatus] = useState({
    loading: true,
    completed: false,
    count: 0,
    hasConfiguredProject: false,
  });

  const [profilesStatus, setProfilesStatus] = useState({
    loading: true,
    completed: false,
    count: 0,
  });

  const { projects, loadingProjects } = useFetchProjects("owned");
  const { files, loadingFiles } = useFetchFiles(
    selectedProject ? selectedProject.id : undefined,
  );

  // Real-time update function with more frequent polling
  const updateStatuses = useCallback(async () => {
    try {
      // Load API keys status
      const apiKeys = await getUserApiKeys();
      setApiKeysStatus({
        loading: false,
        completed: apiKeys.length > 0,
        count: apiKeys.length,
      });

      // Load connectors status
      const connectors = await fetchChatbotConnectors();
      setConnectorsStatus({
        loading: false,
        completed: connectors.length > 0,
        count: connectors.length,
      });
    } catch (error) {
      console.error("Error updating statuses:", error);
    }
  }, []);

  // Load initial status and set up more frequent updates
  useEffect(() => {
    updateStatuses();

    // Set up more frequent updates every 10 seconds for real-time feel
    const interval = setInterval(updateStatuses, 10000);

    return () => clearInterval(interval);
  }, [updateStatuses]);

  // Update projects status
  useEffect(() => {
    if (!loadingProjects) {
      const hasConfiguredProject = projects.some(
        (project) =>
          project.api_key && project.llm_model && project.chatbot_connector,
      );

      setProjectsStatus({
        loading: false,
        completed: projects.length > 0 && hasConfiguredProject,
        count: projects.length,
        hasConfiguredProject,
      });
    }
  }, [projects, loadingProjects]);

  // Update profiles status
  useEffect(() => {
    if (!loadingFiles) {
      setProfilesStatus({
        loading: false,
        completed: files.length > 0,
        count: files.length,
      });
    }
  }, [files, loadingFiles]);

  const setupSteps = [
    {
      id: "apikeys",
      title: "API Keys",
      description: "LLM provider access for user simulation",
      icon: User,
      status: apiKeysStatus,
      action: () => navigate("/profile"),
      actionText: "Manage API Keys",
      requirement: "At least 1 API key required",
    },
    {
      id: "connectors",
      title: "Chatbot Connectors",
      description: "Connections to chatbot platforms you want to test",
      icon: Zap,
      status: connectorsStatus,
      action: () => navigate("/chatbot-connectors"),
      actionText: "Manage Connectors",
      requirement: "At least 1 connector required",
    },
    {
      id: "projects",
      title: "Projects",
      description: "Testing scenarios that link keys, connectors & profiles",
      icon: FolderOpen,
      status: projectsStatus,
      action: () => navigate("/projects"),
      actionText: "Manage Projects",
      requirement: "At least 1 fully configured project required",
      isProjectDependent: true,
    },
    {
      id: "profiles",
      title: "User Profiles",
      description: "YAML files defining user simulator behaviors",
      icon: FileText,
      status: profilesStatus,
      action: () => navigate("/"),
      actionText: "Manage Profiles",
      requirement: "At least 1 profile required",
      isProjectDependent: true,
      disabled: !selectedProject,
    },
  ];

  const completedSteps = setupSteps.filter(
    (step) => step.status.completed,
  ).length;
  const totalSteps = setupSteps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  const getStatusIcon = (status) => {
    if (status.loading) {
      return <Clock className="w-4 h-4 text-default-400 animate-pulse" />;
    }
    if (status.completed) {
      return <CheckCircle className="w-4 h-4 text-success" />;
    }
    return <XCircle className="w-4 h-4 text-danger" />;
  };

  // Get next suggested step
  const nextStep = setupSteps.find(
    (step) => !step.status.completed && !step.disabled,
  );

  if (compact) {
    return (
      <Card
        className={`
          bg-content1 dark:bg-content1
          shadow-medium border border-divider dark:border-divider
          w-full transition-all duration-300 hover:shadow-large
          ${isHovered ? "scale-[1.02]" : ""}
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardBody className="p-3">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Setup Progress</p>
                  <p className="text-xs text-foreground/60">
                    {completedSteps} of {totalSteps} complete
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Progress
                  value={progressPercentage}
                  className="w-20"
                  size="sm"
                  color={progressPercentage === 100 ? "success" : "primary"}
                />
                <span className="text-xs font-medium min-w-[2.5rem]">
                  {Math.round(progressPercentage)}%
                </span>
              </div>

              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-foreground/60" />
              ) : (
                <ChevronDown className="w-4 h-4 text-foreground/60" />
              )}
            </div>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
              {progressPercentage === 100 ? (
                <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Setup Complete!</span>
                  </div>
                  <p className="text-xs text-foreground/70 mt-1">
                    🎉 Sensei is ready! You can now create and run user
                    simulation tests.
                  </p>
                </div>
              ) : (
                <>
                  {/* Next step suggestion with better explanation */}
                  {nextStep && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-primary mb-1">
                            🎯 Next: {nextStep.title}
                          </p>
                          <p className="text-xs text-foreground/70 mb-2">
                            {
                              getStepExplanation(
                                nextStep.id,
                                nextStep.status,
                                selectedProject,
                              ).action
                            }
                          </p>
                        </div>
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          onPress={nextStep.action}
                          endContent={<ChevronRight className="w-3 h-3" />}
                        >
                          {nextStep.actionText}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Detailed explanations for incomplete steps */}
                  <div className="space-y-2">
                    {setupSteps
                      .filter((step) => !step.status.completed)
                      .slice(0, 3)
                      .map((step) => {
                        const Icon = step.icon;
                        const stepStatus = getStepStatus(step);
                        const explanation = getStepExplanation(
                          step.id,
                          step.status,
                          selectedProject,
                        );

                        return (
                          <div
                            key={step.id}
                            className="bg-content2/50 rounded-lg p-3 border border-divider/50"
                          >
                            <div className="flex items-start gap-3">
                              <Icon className="w-4 h-4 text-foreground/60 mt-0.5" />
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-medium">
                                    {step.title}
                                  </p>
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    color={stepStatus.color}
                                    className="text-xs"
                                  >
                                    {stepStatus.text}
                                  </Chip>
                                </div>
                                <p className="text-xs text-foreground/70 mb-2">
                                  {explanation.content}
                                </p>
                                {!step.disabled && (
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    color="primary"
                                    onPress={step.action}
                                    className="text-xs h-6"
                                  >
                                    {step.actionText}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Collapsed quick actions */}
          {!isExpanded && progressPercentage < 100 && (
            <div className="mt-3 flex gap-2">
              {setupSteps
                .filter((step) => !step.status.completed && !step.disabled)
                .slice(0, 2)
                .map((step) => (
                  <Button
                    key={step.id}
                    size="sm"
                    variant="flat"
                    color="primary"
                    onPress={step.action}
                    endContent={<ChevronRight className="w-3 h-3" />}
                    className="text-xs"
                  >
                    {step.actionText}
                  </Button>
                ))}
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-content1 dark:bg-content1 shadow-medium border border-divider dark:border-divider w-full">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-primary" />
            {showTitle && (
              <h3 className="text-lg font-semibold">Setup Status</h3>
            )}
          </div>
          <Chip
            color={progressPercentage === 100 ? "success" : "primary"}
            variant="flat"
            size="sm"
          >
            {completedSteps}/{totalSteps} Complete
          </Chip>
        </div>
      </CardHeader>

      <Divider />

      <CardBody className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Progress
            value={progressPercentage}
            className="flex-1"
            color={progressPercentage === 100 ? "success" : "primary"}
          />
          <span className="text-sm font-medium min-w-[3rem]">
            {Math.round(progressPercentage)}%
          </span>
        </div>

        {progressPercentage === 100 && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Setup Complete!</span>
            </div>
            <p className="text-xs text-foreground/70 mt-1">
              🎉 Your Sensei environment is fully configured and ready for
              testing. You can now create user profiles and run simulation
              tests.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {setupSteps.map((step, index) => {
            const stepStatus = getStepStatus(step);
            const Icon = step.icon;
            const explanation = getStepExplanation(
              step.id,
              step.status,
              selectedProject,
            );

            return (
              <div key={step.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-foreground/70" />
                      <span className="text-sm font-medium">{step.title}</span>
                    </div>
                    {getStatusIcon(step.status)}
                  </div>

                  <div className="flex items-center gap-2">
                    {step.status.completed && step.status.count > 0 && (
                      <span className="text-xs text-foreground/60">
                        {step.status.count} configured
                      </span>
                    )}
                    <Chip size="sm" variant="flat" color={stepStatus.color}>
                      {stepStatus.text}
                    </Chip>
                  </div>
                </div>

                <div className="ml-7">
                  <p className="text-xs text-foreground/60 mb-2">
                    {step.description}
                  </p>

                  {/* Enhanced explanations */}
                  <div className="bg-content2/30 rounded-md p-2 mb-2">
                    <div className="flex items-start gap-2">
                      <Info className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-foreground/80">
                        {explanation.content}
                      </p>
                    </div>
                  </div>

                  {step.isProjectDependent && !selectedProject && (
                    <div className="flex items-center gap-2 text-warning text-xs mb-2">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Select a project first</span>
                    </div>
                  )}

                  {!step.status.completed && !step.disabled && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground/50">
                        {step.requirement}
                      </span>
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        onPress={step.action}
                        endContent={<ChevronRight className="w-3 h-3" />}
                      >
                        {step.actionText}
                      </Button>
                    </div>
                  )}
                </div>

                {index < setupSteps.length - 1 && <Divider className="mt-3" />}
              </div>
            );
          })}
        </div>

        {progressPercentage < 100 && nextStep && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm text-foreground/80">
              <strong>🎯 Next Step:</strong> {nextStep.title} -{" "}
              {
                getStepExplanation(
                  nextStep.id,
                  nextStep.status,
                  selectedProject,
                ).action
              }
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default SetupStatusDashboard;
