import React from "react";
import { Button, Tooltip } from "@heroui/react";
import { Save, BookOpen } from "lucide-react";

/**
 * Editor toolbar component with save button and documentation toggle
 */
export const EditorToolbar = ({
  hasUnsavedChanges,
  isSaving,
  isValid,
  fileId,
  onSave,
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  return (
    <div className="flex items-center space-x-2">
      {/* Save Button - Primary Action */}
      <Button
        color={hasUnsavedChanges ? "primary" : "default"}
        variant={hasUnsavedChanges ? "solid" : "flat"}
        size="sm"
        isLoading={isSaving}
        isDisabled={!hasUnsavedChanges || !isValid || isSaving}
        startContent={!isSaving && <Save className="w-4 h-4" />}
        onPress={onSave}
      >
        {isSaving
          ? "Saving..."
          : fileId
            ? hasUnsavedChanges
              ? "Update*"
              : "Update"
            : hasUnsavedChanges
              ? "Save*"
              : "Save"}
      </Button>

      {/* Documentation Toggle */}
      <Tooltip
        content={sidebarCollapsed ? "Show Documentation" : "Hide Documentation"}
      >
        <Button
          variant="flat"
          size="sm"
          isIconOnly
          onPress={onToggleSidebar}
          aria-label={
            sidebarCollapsed ? "Show Documentation" : "Hide Documentation"
          }
        >
          <BookOpen className="w-4 h-4" />
        </Button>
      </Tooltip>
    </div>
  );
};
