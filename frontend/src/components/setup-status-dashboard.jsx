import React, { useState, useEffect } from "react";
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

const SetupStatusDashboard = ({ compact = false, showTitle = true }) => {
  const navigate = useNavigate();
  const [selectedProject] = useSelectedProject();

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

  // Load API keys status
  useEffect(() => {
    const loadApiKeysStatus = async () => {
      try {
        const apiKeys = await getUserApiKeys();
        setApiKeysStatus({
          loading: false,
          completed: apiKeys.length > 0,
          count: apiKeys.length,
        });
      } catch (error) {
        console.error("Error loading API keys:", error);
        setApiKeysStatus({
          loading: false,
          completed: false,
          count: 0,
        });
      }
    };

    loadApiKeysStatus();
  }, []);

  // Load connectors status
  useEffect(() => {
    const loadConnectorsStatus = async () => {
      try {
        const connectors = await fetchChatbotConnectors();
        setConnectorsStatus({
          loading: false,
          completed: connectors.length > 0,
          count: connectors.length,
        });
      } catch (error) {
        console.error("Error loading connectors:", error);
        setConnectorsStatus({
          loading: false,
          completed: false,
          count: 0,
        });
      }
    };

    loadConnectorsStatus();
  }, []);

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
      description: "Configure your AI provider API keys",
      icon: User,
      status: apiKeysStatus,
      action: () => navigate("/profile"),
      actionText: "Manage API Keys",
      requirement: "At least 1 API key required",
    },
    {
      id: "connectors",
      title: "Chatbot Connectors",
      description: "Set up connections to your chatbots",
      icon: Zap,
      status: connectorsStatus,
      action: () => navigate("/chatbot-connectors"),
      actionText: "Manage Connectors",
      requirement: "At least 1 connector required",
    },
    {
      id: "projects",
      title: "Projects",
      description: "Create and configure your testing projects",
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
      description: "Upload or generate user testing profiles",
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

  if (compact) {
    return (
      <Card className="bg-content2 dark:bg-darkbg-glass shadow-glass border border-border dark:border-border-dark w-full">
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Setup Progress</p>
                <p className="text-xs text-foreground/60 dark:text-foreground-dark/60">
                  {completedSteps} of {totalSteps} steps complete
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={progressPercentage}
                className="w-32 sm:w-20"
                size="sm"
                color={progressPercentage === 100 ? "success" : "primary"}
              />
              <span className="text-xs font-medium min-w-[3rem]">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </div>

          {progressPercentage < 100 && (
            <div className="mt-3 flex flex-wrap gap-1">
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
    <Card className="bg-content2 dark:bg-darkbg-glass shadow-glass border border-border dark:border-border-dark w-full">
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
            <p className="text-xs text-foreground/70 dark:text-foreground-dark/70 mt-1">
              Your Sensei environment is fully configured and ready for testing.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {setupSteps.map((step, index) => {
            const stepStatus = getStepStatus(step);
            const Icon = step.icon;

            return (
              <div key={step.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-foreground/70 dark:text-foreground-dark/70" />
                      <span className="text-sm font-medium">{step.title}</span>
                    </div>
                    {getStatusIcon(step.status)}
                  </div>

                  <div className="flex items-center gap-2">
                    {step.status.completed && step.status.count > 0 && (
                      <span className="text-xs text-foreground/60 dark:text-foreground-dark/60">
                        {step.status.count} configured
                      </span>
                    )}
                    <Chip size="sm" variant="flat" color={stepStatus.color}>
                      {stepStatus.text}
                    </Chip>
                  </div>
                </div>

                <div className="ml-7">
                  <p className="text-xs text-foreground/60 dark:text-foreground-dark/60 mb-2">
                    {step.description}
                  </p>

                  {step.isProjectDependent && !selectedProject && (
                    <div className="flex items-center gap-2 text-warning text-xs mb-2">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Select a project first</span>
                    </div>
                  )}

                  {!step.status.completed && !step.disabled && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground/50 dark:text-foreground-dark/50">
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

        {progressPercentage < 100 && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm text-foreground/80 dark:text-foreground-dark/80">
              <strong>Next Steps:</strong> Complete the remaining setup steps to
              start testing with Sensei.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default SetupStatusDashboard;
