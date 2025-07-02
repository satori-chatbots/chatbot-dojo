import React, { useState, useEffect } from "react";
import { Card, CardBody, Divider } from "@heroui/react";
import { Key, Bot, FolderPlus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSetup } from "../contexts/setup-context";
import { useAuth } from "../contexts/auth-context";
import ProgressHeader from "./setup-progress/progress-header";
import StepList from "./setup-progress/step-list";
import CelebrationBanner from "./setup-progress/celebration-banner";

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
      completed: setupData.profiles.some((file) => file.is_valid !== false),
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
    const updateDismissalStatus = () => {
      try {
        const dismissed = localStorage.getItem(dismissedKey) === "true";
        setIsDismissed(dismissed);
      } catch (error) {
        console.error("Error loading setup dismissal status:", error);
      }
    };
    updateDismissalStatus();
    globalThis.addEventListener(
      "sensei:setupDismissedChange",
      updateDismissalStatus,
    );
    return () => {
      globalThis.removeEventListener(
        "sensei:setupDismissedChange",
        updateDismissalStatus,
      );
    };
  }, [dismissedKey]);

  // Handle dismissal
  const handleDismiss = () => {
    try {
      localStorage.setItem(dismissedKey, "true");
      globalThis.dispatchEvent(new Event("sensei:setupDismissedChange"));
    } catch {
      /* ignore */
    }
  };

  // Determine if component should be visible
  const shouldShow = () => {
    if (forceShow) return true;
    if (isDismissed) return false;
    return true;
  };

  if (!shouldShow()) {
    // eslint-disable-next-line unicorn/no-null
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
  if (isSetupComplete && !forceShow && !isDismissed) {
    return (
      <CelebrationBanner
        onDismiss={handleDismiss}
        onNavigate={() => navigate("/")}
      />
    );
  }

  return (
    <>
      <Card className="w-full relative">
        <CardBody className="py-4">
          <div className="space-y-4">
            <ProgressHeader
              isExpanded={isExpanded}
              isSetupComplete={isSetupComplete}
              completedRequiredSteps={completedRequiredSteps}
              requiredSteps={requiredSteps}
              nextStep={nextStep}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
              onDismiss={handleDismiss}
            />
            {isExpanded && (
              <>
                <Divider className="my-3" />
                <StepList
                  setupSteps={setupSteps}
                  progressPercentage={progressPercentage}
                />
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </>
  );
};

export default SetupProgress;
