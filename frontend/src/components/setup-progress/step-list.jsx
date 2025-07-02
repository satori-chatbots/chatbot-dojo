import React from "react";
import { Button, Progress } from "@heroui/react";
import { CheckCircle } from "lucide-react";

const StepList = ({ setupSteps, progressPercentage }) => {
  return (
    <div className="space-y-4">
      <Progress
        value={progressPercentage}
        color="primary"
        size="sm"
        aria-label="Setup progress"
      />
      <ul className="space-y-3">
        {setupSteps.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            <div className="flex-shrink-0 pt-1">
              {step.completed ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <div className="w-5 h-5 border-2 border-primary rounded-full" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-x-2 gap-y-1">
                <p
                  className={`font-semibold text-sm ${
                    step.completed
                      ? "text-foreground-500 line-through"
                      : "text-foreground"
                  }`}
                >
                  {step.title}
                </p>
                {!step.completed && (
                  <Button
                    size="sm"
                    color="primary"
                    variant="light"
                    onPress={step.action}
                    className="-my-1 -ml-2 sm:my-0 sm:ml-0"
                  >
                    {step.actionText}
                  </Button>
                )}
              </div>
              <p className="text-xs text-foreground-500 mt-0.5">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StepList;
