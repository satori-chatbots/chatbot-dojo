import React from "react";
import { Button, Tooltip, Switch } from "@heroui/react";
import { Save, BookOpen, Clock } from "lucide-react";

/**
 * Editor toolbar component with save button, auto-save toggle, and documentation toggle
 */
export const EditorToolbar = ({
  hasUnsavedChanges,
  isSaving,
  fileId,
  onSave,
  sidebarCollapsed,
  onToggleSidebar,
  autosaveEnabled,
  onToggleAutosave,
  lastSaved,
}) => {
  return (
    <div className="flex items-center space-x-2">
      {/* Auto-save Toggle */}
      <div className="flex items-center space-x-2 px-2 py-1 bg-background-100 dark:bg-background-800 rounded-md">
        <Clock className="w-3 h-3 text-foreground-500" />
        <span className="text-xs text-foreground-600">Auto-save</span>
        <Switch
          size="sm"
          isSelected={autosaveEnabled}
          onValueChange={onToggleAutosave}
          aria-label="Toggle auto-save"
        />
        {autosaveEnabled && lastSaved && (
          <span className="text-xs text-foreground-400">
            {new Date(lastSaved).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* Save Button - Primary Action */}
      <Button
        color={hasUnsavedChanges ? "primary" : "default"}
        variant={hasUnsavedChanges ? "solid" : "flat"}
        size="sm"
        isLoading={isSaving}
        isDisabled={!hasUnsavedChanges || isSaving}
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
