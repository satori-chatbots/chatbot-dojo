import React from "react";
import { Card, CardBody, Button } from "@heroui/react";
import { CheckCircle, Sparkles, X } from "lucide-react";

const CelebrationBanner = ({ onDismiss, onNavigate }) => {
  return (
    <Card className="w-full bg-gradient-to-r from-success-50 to-primary-50 dark:from-success-900/20 dark:to-primary-900/20 border-success-200 dark:border-success-800 shadow-glass rounded-2xl backdrop-blur-md">
      <CardBody className="py-3 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-success animate-bounce" />
            <div>
              <span className="text-sm font-semibold text-success-700 dark:text-success-300">
                🎉 Setup Complete!
              </span>
              <p className="text-xs text-success-600 dark:text-success-400">
                {"You're all set to start testing your chatbot"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              color="success"
              variant="solid"
              startContent={<Sparkles className="w-4 h-4" />}
              onPress={onNavigate}
            >
              Start Testing
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="success"
              onPress={onDismiss}
              aria-label="Close celebration banner"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default CelebrationBanner;
