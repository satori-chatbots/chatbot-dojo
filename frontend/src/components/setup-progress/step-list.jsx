import React from "react";
import { Progress } from "@heroui/react";
import StepItem from "./step-item";

const StepList = ({ setupSteps, progressPercentage, nextStep, setupData }) => {
  return (
    <div className="space-y-4">
      <Progress
        value={progressPercentage}
        color="primary"
        size="sm"
        aria-label="Setup progress"
      />
      <ul className="space-y-3">
        {setupSteps.map((step, index) => {
          const isActive =
            !step.completed &&
            !step.optional &&
            nextStep &&
            step.id === nextStep.id;
          return (
            <StepItem
              key={step.id}
              step={step}
              index={index}
              isActive={isActive}
              setupData={setupData}
            />
          );
        })}
      </ul>
    </div>
  );
};

export default StepList;
