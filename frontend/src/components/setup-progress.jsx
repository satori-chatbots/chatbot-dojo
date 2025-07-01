import React, { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  Button,
  Progress,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Chip,
  Divider,
  Tooltip,
} from "@heroui/react";
import {
  CheckCircle,
  ChevronDown,
  ArrowRight,
  Key,
  Bot,
  FolderPlus,
  Users,
  Sparkles,
  EyeOff,
  Settings,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSetup } from "../contexts/setup-context";
import { useAuth } from "../contexts/auth-context";

const SetupProgress = ({ isCompact = false, forceShow = false }) => {
  const navigate = useNavigate();

  const { user } = useAuth();
  const dismissedKey = `sensei_setup_dismissed_${user ? user.id : "guest"}`;

  // State management
  const [isExpanded, setIsExpanded] = useState(!isCompact);
  const [isDismissed, setIsDismissed] = useState(false);

  // Use the setup context
  const { setupData, loading } = useSetup();

  // Setup steps configuration
  const setupSteps = [
    {
      id: "api-key",
      title: "Add API Key",
      description:
        "Add an API key for your chosen provider (required to run profiles and use TRACER)",
      icon: Key,
      optional: false,
      completed: setupData.apiKeys.length > 0,
      action: () => navigate("/profile"),
      actionText: "Add API Key",
    },
    {
      id: "connector",
      title: "Create Chatbot Connector",
      description: "Connect to your chatbot API",
      icon: Bot,
      optional: false,
      completed: setupData.connectors.length > 0,
      action: () => navigate("/chatbot-connectors"),
      actionText: "Create Connector",
    },
    {
      id: "project",
      title: "Create Project",
      description: "Set up a project with connector and API",
      icon: FolderPlus,
      optional: false,
      completed: setupData.projects.length > 0,
      action: () => navigate("/projects"),
      actionText: "Create Project",
    },
    {
      id: "profiles",
      title: "Create Profiles",
      description: "Add user profiles manually or with TRACER",
      icon: Users,
      optional: false,
      completed: setupData.profiles.length > 0,
      action: () => navigate("/"),
      actionText: "Create Profiles",
    },
  ];

  // Calculate progress
  const requiredSteps = setupSteps.filter((step) => !step.optional).length;
  const completedRequiredSteps = setupSteps.filter(
    (step) => !step.optional && step.completed,
  ).length;
  const progressPercentage = (completedRequiredSteps / requiredSteps) * 100;

  const nextStep = setupSteps.find((step) => !step.completed && !step.optional);
  const isSetupComplete = completedRequiredSteps === requiredSteps;

  // Load user preferences from localStorage
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(dismissedKey) === "true";
      setIsDismissed(dismissed);
    } catch (error) {
      console.error("Error loading setup dismissal status:", error);
    }
  }, [dismissedKey]);

  // Handle dismissal
  const handleDismiss = () => {
    try {
      localStorage.setItem(dismissedKey, "true");
    } catch {}
    setIsDismissed(true);
  };

  // Determine if component should be visible
  const shouldShow = () => {
    if (forceShow) return true;
    if (isDismissed) return false;
    return true;
  };

  if (!shouldShow()) {
    return null;
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardBody>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Celebration state for completed setup
  if (isSetupComplete && !forceShow) {
    return (
      <Card className="w-full bg-gradient-to-r from-success-50 to-primary-50 border-success-200">
        <CardBody className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-success animate-bounce" />
              <div>
                <span className="text-sm font-semibold text-success-700">
                  🎉 Setup Complete!
                </span>
                <p className="text-xs text-success-600">
                  You're all set to start testing your chatbot
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                color="success"
                variant="solid"
                startContent={<Sparkles className="w-4 h-4" />}
                onPress={() => navigate("/")}
              >
                Start Testing
              </Button>
              {!isCompact && (
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="success"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Setup options">
                    <DropdownItem
                      key="show-details"
                      startContent={<Settings className="w-4 h-4" />}
                      onPress={() => setIsExpanded(true)}
                    >
                      Show Setup Details
                    </DropdownItem>
                    <DropdownItem
                      key="hide-progress"
                      startContent={<EyeOff className="w-4 h-4" />}
                      onPress={handleDismiss}
                      className="text-warning"
                    >
                      Hide Progress
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full relative">
        <CardBody className="py-4">
          <div className="space-y-4">
            {/* Header with improved actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-wrap">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  Setup Progress
                  {nextStep && (
                    <Chip
                      size="sm"
                      color="primary"
                      variant="flat"
                      startContent={<Zap className="w-3 h-3" />}
                    >
                      Action Required
                    </Chip>
                  )}
                </h3>
                <Chip
                  size="sm"
                  color={isSetupComplete ? "success" : "primary"}
                  variant="flat"
                >
                  {completedRequiredSteps}/{requiredSteps} Complete
                </Chip>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Quick next step button */}
                {nextStep && !isExpanded && (
                  <Tooltip content={`Next: ${nextStep.title}`}>
                    <Button
                      size="sm"
                      color="primary"
                      variant="solid"
                      onPress={nextStep.action}
                      startContent={<ArrowRight className="w-3 h-3" />}
                      className="animate-pulse"
                    >
                      Continue
                    </Button>
                  </Tooltip>
                )}

                {/* Settings dropdown */}
                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="light">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Setup options">
                    <DropdownItem
                      key="setup-guide"
                      startContent={<Sparkles className="w-4 h-4" />}
                      onPress={() => navigate("/setup")}
                    >
                      Setup Guide
                    </DropdownItem>
                    <DropdownItem
                      key="hide-progress"
                      startContent={<EyeOff className="w-4 h-4" />}
                      onPress={handleDismiss}
                      className="text-warning"
                    >
                      Hide Progress
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>

                {/* Expand/collapse button */}
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => setIsExpanded(!isExpanded)}
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </Button>
              </div>
            </div>

            {/* Progress Bar - always visible */}
            <div className="space-y-2">
              <Progress
                value={progressPercentage}
                color={isSetupComplete ? "success" : "primary"}
                size="sm"
                showValueLabel={true}
                formatOptions={{ style: "percent" }}
                className="transition-all duration-300"
              />
              <div className="flex justify-between text-xs text-foreground-500">
                <span>Required steps completed</span>
                <span>
                  {completedRequiredSteps}/{requiredSteps}
                </span>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <>
                <Divider />

                {/* Steps List with improved design */}
                <div className="space-y-3">
                  {setupSteps.map((step, index) => {
                    const StepIcon = step.icon;
                    const isActive =
                      !step.completed && !step.optional && step === nextStep;

                    return (
                      <div
                        key={step.id}
                        className={`group relative flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:shadow-md ${
                          step.completed
                            ? "bg-success-50 border-success-200 hover:bg-success-100"
                            : isActive
                              ? "bg-primary-50 border-primary-200 hover:bg-primary-100 ring-2 ring-primary-200"
                              : "bg-default-50 border-default-200 hover:bg-default-100"
                        }`}
                      >
                        {/* Step number indicator */}
                        <div className="flex-shrink-0 relative">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              step.completed
                                ? "bg-success text-white"
                                : isActive
                                  ? "bg-primary text-white"
                                  : "bg-default-300 text-default-600"
                            }`}
                          >
                            {step.completed ? "✓" : index + 1}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          <StepIcon
                            className={`w-5 h-5 transition-colors ${
                              step.completed
                                ? "text-success"
                                : isActive
                                  ? "text-primary"
                                  : "text-default-400"
                            }`}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4
                              className={`text-sm font-medium ${
                                step.completed
                                  ? "text-success-700"
                                  : isActive
                                    ? "text-primary-700"
                                    : "text-default-700"
                              }`}
                            >
                              {step.title}
                            </h4>
                            {step.optional && (
                              <Chip
                                size="sm"
                                variant="bordered"
                                color="default"
                              >
                                Optional
                              </Chip>
                            )}
                          </div>
                          <p className="text-xs text-default-500 mt-1">
                            {step.description}
                          </p>

                          {/* Enhanced Status info */}
                          {step.id === "api-key" &&
                            setupData.apiKeys.length > 0 && (
                              <p className="text-xs text-success-600 mt-1 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                {setupData.apiKeys.length} API key
                                {setupData.apiKeys.length > 1 ? "s" : ""}{" "}
                                configured
                              </p>
                            )}
                          {step.id === "connector" &&
                            setupData.connectors.length > 0 && (
                              <p className="text-xs text-success-600 mt-1 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                {setupData.connectors.length} connector
                                {setupData.connectors.length > 1
                                  ? "s"
                                  : ""}{" "}
                                created
                              </p>
                            )}
                          {step.id === "project" &&
                            setupData.projects.length > 0 && (
                              <p className="text-xs text-success-600 mt-1 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                {setupData.projects.length} project
                                {setupData.projects.length > 1 ? "s" : ""}{" "}
                                created
                              </p>
                            )}
                          {step.id === "profiles" &&
                            setupData.profiles.length > 0 && (
                              <p className="text-xs text-success-600 mt-1 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                {setupData.profiles.length} profile
                                {setupData.profiles.length > 1 ? "s" : ""}{" "}
                                created
                              </p>
                            )}
                        </div>

                        {!step.completed && (
                          <Button
                            size="sm"
                            color={isActive ? "primary" : "default"}
                            variant={isActive ? "solid" : "bordered"}
                            onPress={step.action}
                            endContent={<ArrowRight className="w-3 h-3" />}
                            className="transition-all duration-200 group-hover:shadow-sm"
                          >
                            {step.actionText}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Enhanced Next Step Suggestion */}
                {nextStep && (
                  <>
                    <Divider />
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg border border-primary-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-primary-700">
                            Next: {nextStep.title}
                          </h4>
                          <p className="text-xs text-primary-600">
                            {nextStep.description}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        color="primary"
                        onPress={nextStep.action}
                        endContent={<ArrowRight className="w-3 h-3" />}
                        className="font-medium"
                      >
                        Continue Setup
                      </Button>
                    </div>
                  </>
                )}

                {/* Quick Actions Dropdown - Enhanced */}
                <div className="flex justify-center">
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        size="sm"
                        variant="bordered"
                        endContent={<ChevronDown className="w-3 h-3" />}
                      >
                        Quick Actions
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Quick setup actions">
                      <DropdownItem
                        key="setup-guide"
                        startContent={<Sparkles className="w-4 h-4" />}
                        onPress={() => navigate("/setup")}
                        className="text-primary"
                      >
                        View Full Setup Guide
                      </DropdownItem>
                      <DropdownItem
                        key="profile"
                        startContent={<Key className="w-4 h-4" />}
                        onPress={() => navigate("/profile")}
                      >
                        Manage API Keys
                      </DropdownItem>
                      <DropdownItem
                        key="connectors"
                        startContent={<Bot className="w-4 h-4" />}
                        onPress={() => navigate("/chatbot-connectors")}
                      >
                        Chatbot Connectors
                      </DropdownItem>
                      <DropdownItem
                        key="projects"
                        startContent={<FolderPlus className="w-4 h-4" />}
                        onPress={() => navigate("/projects")}
                      >
                        My Projects
                      </DropdownItem>
                      <DropdownItem
                        key="home"
                        startContent={<Users className="w-4 h-4" />}
                        onPress={() => navigate("/")}
                      >
                        Test Center
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </>
  );
};

export default SetupProgress;
