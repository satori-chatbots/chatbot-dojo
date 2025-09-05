import React from "react";
import {
  Button,
  Chip,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { ArrowRight, ChevronDown, EyeOff, Settings, X } from "lucide-react";

const ProgressHeader = ({
  isExpanded,
  isSetupComplete,
  completedRequiredSteps,
  requiredSteps,
  nextStep,
  onToggleExpand,
  onDismiss,
}) => {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <h3 className="text-base sm:text-lg font-semibold truncate text-foreground dark:text-foreground-dark">
          Setup Progress
        </h3>
        <Chip
          size="sm"
          color={isSetupComplete ? "success" : "primary"}
          variant="flat"
          className="hidden xs:flex"
        >
          {completedRequiredSteps}/{requiredSteps}
        </Chip>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {nextStep && !isExpanded && (
          <Tooltip content={nextStep.description} placement="top">
            <Button
              size="sm"
              color="primary"
              variant="solid"
              onPress={nextStep.action}
              className="hidden sm:flex"
              startContent={<ArrowRight className="w-3 h-3" />}
            >
              Continue
            </Button>
          </Tooltip>
        )}

        {nextStep && !isExpanded && (
          <Button
            size="sm"
            color="primary"
            variant="solid"
            onPress={nextStep.action}
            className="sm:hidden"
            isIconOnly
            aria-label="Continue setup"
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}

        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={onToggleExpand}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          className="hidden sm:flex"
        >
          <ChevronDown
            className={`w-5 h-5 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </Button>

        <Dropdown>
          <DropdownTrigger>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="sm:hidden"
              aria-label="More options"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Setup Options">
            <DropdownItem
              key="expand"
              startContent={
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              }
              onPress={onToggleExpand}
            >
              {isExpanded ? "Collapse" : "Expand"}
            </DropdownItem>
            <DropdownItem
              key="dismiss"
              className="text-danger"
              color="danger"
              startContent={<EyeOff className="w-4 h-4" />}
              onPress={onDismiss}
            >
              Dismiss
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>

        <Tooltip content="Dismiss setup guide" placement="top">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={onDismiss}
            aria-label="Dismiss setup guide"
            className="hidden sm:flex"
          >
            <X className="w-4 h-4" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default ProgressHeader;
