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
} from "@heroui/react";
import {
  CheckCircle,
  Circle,
  ChevronDown,
  ArrowRight,
  Key,
  Bot,
  FolderPlus,
  Users,
  Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getUserApiKeys } from "../api/authentication-api";
import { fetchChatbotConnectors } from "../api/chatbot-connector-api";
import useFetchProjects from "../hooks/use-fetch-projects";
import useFetchFiles from "../hooks/use-fetch-files";
import useSelectedProject from "../hooks/use-selected-projects";

const SetupProgress = ({ isCompact = false }) => {
  const navigate = useNavigate();
  const [setupData, setSetupData] = useState({
    apiKeys: [],
    connectors: [],
    projects: [],
    profiles: [],
  });
  const [isExpanded, setIsExpanded] = useState(!isCompact);
  const [loading, setLoading] = useState(true);

  // Using existing hooks for projects
  const { projects, loadingProjects } = useFetchProjects("owned");
  const [selectedProject] = useSelectedProject();
  const { files } = useFetchFiles(selectedProject?.id);

  const setupSteps = [
    {
      id: "api-key",
      title: "Add API Key",
      description: "Add an API key for your chosen provider (required to run profiles)",
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

  const loadSetupData = async () => {
    try {
      setLoading(true);
      const [apiKeysData, connectorsData] = await Promise.all([
        getUserApiKeys().catch(() => []),
        fetchChatbotConnectors().catch(() => []),
      ]);

      setSetupData({
        apiKeys: apiKeysData,
        connectors: connectorsData,
        projects: projects || [],
        profiles: files || [],
      });
    } catch (error) {
      console.error("Error loading setup data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSetupData();
  }, [projects, files]);

  const completedSteps = setupSteps.filter(step => step.completed).length;
  const requiredSteps = setupSteps.filter(step => !step.optional).length;
  const completedRequiredSteps = setupSteps.filter(step => !step.optional && step.completed).length;
  const progressPercentage = (completedRequiredSteps / requiredSteps) * 100;

  const nextStep = setupSteps.find(step => !step.completed && !step.optional);
  const nextOptionalStep = setupSteps.find(step => !step.completed && step.optional);

  const isSetupComplete = completedRequiredSteps === requiredSteps;

  if (loading && !loadingProjects) {
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

  if (isSetupComplete && isCompact) {
    return (
      <Card className="w-full bg-success-50 border-success-200">
        <CardBody className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              <span className="text-sm font-medium text-success-700">Setup Complete!</span>
            </div>
            <Button
              size="sm"
              color="success"
              variant="light"
              startContent={<Sparkles className="w-4 h-4" />}
              onPress={() => navigate("/")}
            >
              Start Testing
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardBody className="py-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">Setup Progress</h3>
                             <Chip size="sm" color={isSetupComplete ? "success" : "primary"} variant="flat">
                 {completedRequiredSteps}/{requiredSteps} Complete
               </Chip>
            </div>

                         {isCompact && (
               <div className="flex items-center gap-2">
                 <Button
                   size="sm"
                   variant="light"
                   onPress={() => navigate("/setup")}
                   startContent={<Sparkles className="w-3 h-3" />}
                 >
                   Setup Guide
                 </Button>
                 <Button
                   isIconOnly
                   size="sm"
                   variant="light"
                   onPress={() => setIsExpanded(!isExpanded)}
                 >
                   <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                 </Button>
               </div>
             )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress
              value={progressPercentage}
              color={isSetupComplete ? "success" : "primary"}
              size="sm"
              showValueLabel={true}
              formatOptions={{ style: "percent" }}
            />
            <div className="flex justify-between text-xs text-foreground-500">
              <span>Required steps completed</span>
              <span>{completedRequiredSteps}/{requiredSteps}</span>
            </div>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <>
              <Divider />

              {/* Steps List */}
              <div className="space-y-3">
                {setupSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = !step.completed && (
                    (!step.optional && step === nextStep) ||
                    (step.optional && !nextStep && step === nextOptionalStep)
                  );

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        step.completed
                          ? "bg-success-50 border-success-200"
                          : isActive
                            ? "bg-primary-50 border-primary-200"
                            : "bg-default-50 border-default-200"
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {step.completed ? (
                          <CheckCircle className="w-5 h-5 text-success" />
                        ) : (
                          <Circle className="w-5 h-5 text-default-400" />
                        )}
                      </div>

                      <div className="flex-shrink-0">
                        <StepIcon className={`w-5 h-5 ${
                          step.completed ? "text-success" : isActive ? "text-primary" : "text-default-400"
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-medium ${
                            step.completed ? "text-success-700" : isActive ? "text-primary-700" : "text-default-700"
                          }`}>
                            {step.title}
                          </h4>
                          {step.optional && (
                            <Chip size="sm" variant="bordered" color="default">
                              Optional
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-default-500 mt-1">{step.description}</p>

                        {/* Status info */}
                        {step.id === "api-key" && setupData.apiKeys.length > 0 && (
                          <p className="text-xs text-success-600 mt-1">
                            {setupData.apiKeys.length} API key{setupData.apiKeys.length > 1 ? "s" : ""} configured
                          </p>
                        )}
                        {step.id === "connector" && setupData.connectors.length > 0 && (
                          <p className="text-xs text-success-600 mt-1">
                            {setupData.connectors.length} connector{setupData.connectors.length > 1 ? "s" : ""} created
                          </p>
                        )}
                        {step.id === "project" && setupData.projects.length > 0 && (
                          <p className="text-xs text-success-600 mt-1">
                            {setupData.projects.length} project{setupData.projects.length > 1 ? "s" : ""} created
                          </p>
                        )}
                        {step.id === "profiles" && setupData.profiles.length > 0 && (
                          <p className="text-xs text-success-600 mt-1">
                            {setupData.profiles.length} profile{setupData.profiles.length > 1 ? "s" : ""} created
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
                        >
                          {step.actionText}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Next Step Suggestion */}
              {(nextStep || nextOptionalStep) && (
                <>
                  <Divider />
                  <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg border border-primary-200">
                    <div>
                      <h4 className="text-sm font-medium text-primary-700">
                        {isSetupComplete ? "Ready to Start!" : `Next: ${(nextStep || nextOptionalStep)?.title}`}
                      </h4>
                      <p className="text-xs text-primary-600">
                        {isSetupComplete ? "All setup steps completed. You can now run tests with your profiles." : (nextStep || nextOptionalStep)?.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      color={isSetupComplete ? "success" : "primary"}
                      onPress={isSetupComplete ? () => navigate("/") : (nextStep || nextOptionalStep)?.action}
                      endContent={<ArrowRight className="w-3 h-3" />}
                    >
                      {isSetupComplete ? "Start Testing" : "Continue"}
                    </Button>
                  </div>
                </>
              )}

              {/* If no next step but setup is not complete, show first incomplete step */}
              {!nextStep && !nextOptionalStep && !isSetupComplete && (
                <>
                  <Divider />
                  <div className="flex items-center justify-between p-3 bg-warning-50 rounded-lg border border-warning-200">
                    <div>
                      <h4 className="text-sm font-medium text-warning-700">
                        Setup Incomplete
                      </h4>
                      <p className="text-xs text-warning-600">
                        Please complete all required steps to use Sensei.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      color="warning"
                      onPress={() => navigate("/setup")}
                      endContent={<ArrowRight className="w-3 h-3" />}
                    >
                      View Guide
                    </Button>
                  </div>
                </>
              )}

              {/* Quick Actions Dropdown */}
              <div className="flex justify-center gap-2">
                <Dropdown>
                  <DropdownTrigger>
                    <Button size="sm" variant="bordered" endContent={<ChevronDown className="w-3 h-3" />}>
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
  );
};

export default SetupProgress;
