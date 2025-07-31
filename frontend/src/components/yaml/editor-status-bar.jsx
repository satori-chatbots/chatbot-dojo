import React from "react";
import { Button } from "@heroui/react";
import { ZoomInIcon, ZoomOutIcon } from "lucide-react";

/**
 * Editor status bar component showing cursor position, file stats, and zoom controls
 */
export const EditorStatusBar = ({
  cursorPosition,
  lineCount,
  characterCount,
  wordCount,
  hasUnsavedChanges,
  lastSaved,
  fontSize,
  onZoomIn,
  onZoomOut,
  showAutosaveInfo = false,
  autosaveEnabled = false,
}) => {
  return (
    <div className="flex justify-between items-center text-xs text-default-500 border-t border-default-200 bg-default-50 px-4 py-2 rounded-b-lg">
      <div className="flex items-center gap-4">
        <span className="font-mono">
          Line {cursorPosition.line}, Col {cursorPosition.column}
        </span>
        <span>{lineCount} lines</span>
        <span>{characterCount} characters</span>
        {characterCount > 0 && <span>{wordCount} words</span>}
        {hasUnsavedChanges && (
          <span className="text-warning-600 flex items-center gap-1">
            <div className="w-2 h-2 bg-warning-500 rounded-full" />
            <span>Unsaved changes</span>
          </span>
        )}
        {lastSaved && (
          <span className="text-foreground-400">
            Last saved: {lastSaved.toLocaleTimeString()}
          </span>
        )}
        {showAutosaveInfo && (
          <span className="text-foreground-400">
            Autosave: {autosaveEnabled ? "On" : "Off"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="light"
            size="sm"
            onPress={onZoomOut}
            aria-label="Zoom out"
            className="h-5 w-5 min-w-0 p-0 text-default-500 hover:text-default-700"
          >
            <ZoomOutIcon className="w-3 h-3" />
          </Button>
          <span className="text-default-400 text-xs font-mono">
            {fontSize}px
          </span>
          <Button
            variant="light"
            size="sm"
            onPress={onZoomIn}
            aria-label="Zoom in"
            className="h-5 w-5 min-w-0 p-0 text-default-500 hover:text-default-700"
          >
            <ZoomInIcon className="w-3 h-3" />
          </Button>
        </div>
        <span className="text-default-400">YAML</span>
      </div>
    </div>
  );
};
