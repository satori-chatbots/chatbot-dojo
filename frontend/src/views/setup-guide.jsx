import React from "react";
import { Card, CardBody, CardHeader, Button } from "@heroui/react";
import { ArrowLeft, BookOpen, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SetupProgress from "../components/setup-progress";
import { useAuth } from "../contexts/auth-context";

const SetupGuide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isProgressHidden, setIsProgressHidden] = React.useState(false);

  // Check if setup progress is hidden
  React.useEffect(() => {
    const dismissedKey = `sensei_setup_dismissed_${user ? user.id : "guest"}`;
    try {
      const dismissed = localStorage.getItem(dismissedKey) === "true";
      setIsProgressHidden(dismissed);
    } catch (error) {
      console.error("Error checking setup progress status:", error);
    }
  }, [user]);

  // Function to show setup progress again
  const handleShowSetupProgress = () => {
    const dismissedKey = `sensei_setup_dismissed_${user ? user.id : "guest"}`;
    try {
      localStorage.setItem(dismissedKey, "false");
    } catch {
      /* ignore */
    }
    setIsProgressHidden(false);
    // Force a page refresh to show the setup progress
    globalThis.location.reload();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          isIconOnly
          variant="light"
          onPress={() => navigate("/")}
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Setup Guide</h1>
        </div>
      </div>

      {/* Setup Progress Restore Option */}
      {isProgressHidden && (
        <Card className="border-primary-200 bg-primary-50">
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary-700">
                  Setup Progress Hidden
                </h3>
                <p className="text-sm text-primary-600">
                  You have hidden the setup progress. Click below to show it
                  again on all pages.
                </p>
              </div>
              <Button
                color="primary"
                variant="solid"
                startContent={<Eye className="w-4 h-4" />}
                onPress={handleShowSetupProgress}
              >
                Show Setup Progress
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Description */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">
            {"Welcome to Sensei's Setup Guide"}
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-foreground/80">
            Sensei is a user simulator that helps you test your chatbots by
            running automated conversations using user profiles. Follow the
            steps below to get started.
          </p>

          <div className="space-y-3">
            <h3 className="text-lg font-medium">{"What you'll set up:"}</h3>
            <ul className="space-y-2 text-sm text-foreground/70 ml-4">
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>API Key:</strong>{" "}
                  {
                    "Add your AI provider API key for running profiles and testing. Make sure to add an API key that matches your profiles LLM model's provider."
                  }
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>Chatbot Connector:</strong>{" "}
                  {
                    "Connect Sensei to your chatbot's API so it can send messages and receive responses."
                  }
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>Project:</strong> Create a project that combines your
                  connector and API key for organized testing.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>User Profiles:</strong> Create user profiles either
                  manually or automatically using TRACER (which explores your
                  chatbot and generates profiles automatically).
                </div>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-primary-700 mb-2">
                💡 Pro Tip
              </h4>
              <p className="text-sm text-primary-600">
                TRACER can automatically generate user profiles by talking to
                your chatbot and learning how it behaves. This saves you time
                and creates more realistic test scenarios.
              </p>
            </div>

            <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-secondary-700 mb-2">
                🎯 Smart Progress Tracking
              </h4>
              <p className="text-sm text-secondary-600">
                The setup progress automatically adapts to your experience
                level. Once you complete setup, it can hide itself or show a
                floating next-step button when needed. You can customize these
                preferences in the settings menu.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Setup Progress Component */}
      <SetupProgress isCompact={false} />

      {/* Additional Help */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Need Help?</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-foreground/70">
            If you encounter any issues during setup, here are some helpful
            resources:
          </p>
          <ul className="space-y-2 text-sm text-foreground/60">
            <li>
              • Check that your chatbot API is accessible and working correctly
            </li>
            <li>
              • Ensure your API key has the necessary permissions for your
              chosen provider
            </li>
            <li>
              • Verify that your YAML profile files are properly formatted
            </li>
            <li>
              • Make sure the provider in your profiles matches your API key
              provider
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
};

export default SetupGuide;
