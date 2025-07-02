import React from "react";
import { Button, Chip } from "@heroui/react";
import { CheckCircle, ArrowRight } from "lucide-react";

const stepSummaryConfig = {
  "api-key": {
    data: (setupData) => setupData.apiKeys,
    noun: "API key",
    verb: "configured",
  },
  connector: {
    data: (setupData) => setupData.connectors,
    noun: "connector",
    verb: "created",
  },
  project: {
    data: (setupData) => setupData.projects,
    noun: "project",
    verb: "created",
  },
  profiles: {
    data: (setupData) =>
      setupData.profiles.filter((file) => file.is_valid !== false),
    noun: "profile",
    verb: "created",
  },
};

const renderStepSummary = (stepId, setupData) => {
  const config = stepSummaryConfig[stepId];
  if (!config) {
    // eslint-disable-next-line unicorn/no-null
    return null;
  }

  const items = config.data(setupData);
  const count = items.length;

  if (count > 0) {
    return (
      <p className="text-xs text-success-600 mt-1 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        {count} {config.noun}
        {count > 1 ? "s" : ""} {config.verb}
      </p>
    );
  }

  // eslint-disable-next-line unicorn/no-null
  return null;
};

const StepItem = ({ step, index, isActive, setupData }) => {
  const StepIcon = step.icon;
  return (
    <li
      className={`group relative flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:shadow-md ${
        step.completed
          ? "bg-success-50 border-success-200 hover:bg-success-100"
          : isActive
            ? "bg-primary-50 border-primary-200 hover:bg-primary-100 ring-2 ring-primary-200"
            : "bg-default-50 border-default-200 hover:bg-default-100"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
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
                    : "text-foreground"
              }`}
            >
              {step.title}
            </h4>
            {step.optional && (
              <Chip size="sm" variant="bordered" color="default">
                Optional
              </Chip>
            )}
          </div>
          <p className="text-xs text-foreground-500 mt-1">{step.description}</p>
          {renderStepSummary(step.id, setupData)}
        </div>
      </div>

      {!step.completed && (
        <div className="flex justify-end sm:justify-start mt-2 sm:mt-0">
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
        </div>
      )}
    </li>
  );
};

export default StepItem;
