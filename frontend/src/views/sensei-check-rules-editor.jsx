import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import {
  fetchSenseiCheckRule,
  updateSenseiCheckRule,
  createSenseiCheckRule,
  fetchSenseiCheckRuleTemplate,
} from "../api/file-api";
import {
  AlertCircle,
  CheckCircle2,
  ZoomInIcon,
  ZoomOutIcon,
  Save,
  Edit,
  Loader2,
} from "lucide-react";
import { Button, Tabs, Tab, Accordion, AccordionItem } from "@heroui/react";
import { load as yamlLoad } from "js-yaml";
import { materialDark } from "@uiw/codemirror-theme-material";
import { githubLight } from "@uiw/codemirror-theme-github";
import { useTheme } from "next-themes";
import useSelectedProject from "../hooks/use-selected-projects";
import { useSetup } from "../contexts/setup-context";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { autocompletion } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { linter, lintGutter } from "@codemirror/lint";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";

// Basic YAML autocomplete for sensei-check rules
function senseiCheckCompletions(context) {
  const word = context.matchBefore(/\w*/);
  if (word.from === word.to && !context.explicit) {
    return;
  }

  const options = [
    { label: "rules", type: "keyword", info: "Array of validation rules" },
    { label: "name", type: "keyword", info: "Rule name identifier" },
    { label: "description", type: "keyword", info: "Rule description" },
    { label: "enabled", type: "keyword", info: "Enable/disable rule" },
    { label: "conditions", type: "keyword", info: "Array of conditions" },
    { label: "field", type: "keyword", info: "Field to validate" },
    { label: "operator", type: "keyword", info: "Validation operator" },
    { label: "value", type: "keyword", info: "Expected value" },
    { label: "contains", type: "value", info: "Contains operator" },
    { label: "equals", type: "value", info: "Equals operator" },
    { label: "matches", type: "value", info: "Regex matches operator" },
    { label: "response", type: "value", info: "Response field" },
    { label: "true", type: "value", info: "Boolean true" },
    { label: "false", type: "value", info: "Boolean false" },
  ];

  return {
    from: word.from,
    options: options.map((option) => ({
      ...option,
      boost: option.type === "keyword" ? 99 : 0,
    })),
  };
}

// Basic YAML linter for sensei-check rules
function createSenseiCheckYamlLinter() {
  return (view) => {
    const diagnostics = [];
    const doc = view.state.doc.toString();

    try {
      yamlLoad(doc);
    } catch (error) {
      if (error.mark) {
        const from =
          view.state.doc.line(error.mark.line + 1).from + error.mark.column;
        const to = Math.min(from + 1, view.state.doc.length);
        diagnostics.push({
          from,
          to,
          severity: "error",
          message: error.message,
        });
      }
    }

    return diagnostics;
  };
}

function SenseiCheckRulesEditor() {
  const { ruleId } = useParams();
  const [editorContent, setEditorContent] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [errorInfo, setErrorInfo] = useState();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const [selectedProject] = useSelectedProject();
  const { reloadProfiles } = useSetup();
  const { showToast } = useMyCustomToast();

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState("");
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState();
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [editorRef, setEditorRef] = useState();
  const [ruleProject, setRuleProject] = useState();

  const zoomIn = () => setFontSize((previous) => Math.min(previous + 2, 24));
  const zoomOut = () => setFontSize((previous) => Math.max(previous - 2, 8));

  const senseiCheckYamlLinter = linter(createSenseiCheckYamlLinter());

  // Jump to error location functionality
  const jumpToError = useCallback(
    (line) => {
      if (editorRef && editorRef.view) {
        try {
          const lineNumber = Math.max(
            1,
            Math.min(line, editorRef.view.state.doc.lines),
          );
          const pos = editorRef.view.state.doc.line(lineNumber).from;
          editorRef.view.dispatch({
            selection: { anchor: pos },
            scrollIntoView: true,
          });
          editorRef.view.focus();
        } catch (error) {
          console.error("Error jumping to line:", error);
        }
      }
    },
    [editorRef],
  );

  // Track cursor position
  const cursorPositionExtension = EditorView.updateListener.of((update) => {
    if (update.selectionSet) {
      const pos = update.state.selection.main.head;
      const line = update.state.doc.lineAt(pos);
      setCursorPosition({
        line: line.number,
        column: pos - line.from + 1,
      });
    }
  });

  const customKeymap = keymap.of([
    {
      key: "Enter",
      run: insertNewlineAndIndent,
    },
    ...searchKeymap,
  ]);

  const validateYaml = useCallback((value) => {
    try {
      yamlLoad(value);
      setIsValid(true);
      setErrorInfo(undefined);
      return true;
    } catch (error) {
      setIsValid(false);
      const errorLines = error.message.split("\n");
      const errorMessage = errorLines[0];
      const codeContext = errorLines.slice(1).join("\n");
      setErrorInfo({
        message: errorMessage,
        line: error.mark ? error.mark.line + 1 : undefined,
        column: error.mark ? error.mark.column + 1 : undefined,
        codeContext: codeContext,
      });
      console.error("Invalid YAML:", error);
      return false;
    }
  }, []);

  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true);
      try {
        if (ruleId) {
          const response = await fetchSenseiCheckRule(ruleId);
          // Store the project information for updates
          setRuleProject(response.project);
          // For now, try to read from the file URL if available
          let content = "";
          if (response.file_url) {
            try {
              const fileResponse = await fetch(response.file_url);
              content = await fileResponse.text();
            } catch (error) {
              console.error("Error reading file content:", error);
              content =
                "# Error loading file content\n# Please contact support";
            }
          } else {
            content = "# No file content available\n# Please contact support";
          }
          setEditorContent(content);
          setOriginalContent(content);
          validateYaml(content);
        } else {
          const response = await fetchSenseiCheckRuleTemplate();
          if (response.template) {
            setEditorContent(response.template);
            setOriginalContent(response.template);
            validateYaml(response.template);
          }
        }
      } catch (error) {
        console.error("Error loading content:", error);
        showToast(
          "error",
          ruleId
            ? "Failed to load sensei-check rule"
            : "Failed to load template",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [ruleId, showToast, validateYaml]);

  // Debounced validation effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateYaml(editorContent);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [editorContent, validateYaml]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (ruleId) {
        const projectIdToUse = ruleProject || selectedProject?.id;
        if (!projectIdToUse) {
          showToast("error", "Project information not available");
          return;
        }
        // We don't need the response object here; await the update and proceed.
        await updateSenseiCheckRule(ruleId, editorContent, projectIdToUse, {
          ignoreValidationErrors: !isValid,
        });
        await reloadProfiles();
        setOriginalContent(editorContent);
        setHasUnsavedChanges(false);
        const successMessage = isValid
          ? "Sensei-check rule updated successfully"
          : "Sensei-check rule saved with validation errors";
        showToast(isValid ? "success" : "warning", successMessage);
        setLastSaved(new Date());
      } else {
        if (!selectedProject) {
          showToast("error", "Please select a project first");
          return;
        }
        const createResponse = await createSenseiCheckRule(
          editorContent,
          selectedProject.id,
          {
            ignoreValidationErrors: !isValid,
          },
        );
        if (createResponse && createResponse.length > 0) {
          const newRuleId = createResponse[0].id;
          await reloadProfiles();
          setOriginalContent(editorContent);
          setHasUnsavedChanges(false);
          const successMessage = isValid
            ? "Sensei-check rule created successfully"
            : "Sensei-check rule created with validation errors";
          showToast(isValid ? "success" : "warning", successMessage);
          setLastSaved(new Date());
          navigate(`/sensei-check-rules/${newRuleId}`);
        } else {
          showToast("error", "Failed to create sensei-check rule");
        }
      }
    } catch (error) {
      try {
        const errorObject = JSON.parse(error.message);
        if (errorObject.errors) {
          const errorMessages = errorObject.errors
            .map((error_) => `Error: ${error_.error}`)
            .join("\n");
          showToast("error", errorMessages);
        } else if (errorObject.error) {
          showToast("error", `Error: ${errorObject.error}`);
        } else {
          showToast("error", "Error saving sensei-check rule");
        }
      } catch {
        showToast("error", "Error saving sensei-check rule");
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    editorContent,
    ruleId,
    ruleProject,
    navigate,
    reloadProfiles,
    selectedProject,
    showToast,
    isValid,
  ]);

  // Autosave functionality
  useEffect(() => {
    if (!autosaveEnabled || !hasUnsavedChanges || !ruleId || isSaving) {
      return;
    }

    const autosaveTimer = setTimeout(async () => {
      try {
        await handleSave();
        setLastSaved(new Date());
      } catch (error) {
        console.error("Autosave failed:", error);
      }
    }, 5000);

    return () => clearTimeout(autosaveTimer);
  }, [hasUnsavedChanges, autosaveEnabled, ruleId, isSaving, handleSave]);

  // Prevent data loss on page leave
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleEditorChange = (value) => {
    setEditorContent(value);
    setHasUnsavedChanges(value !== originalContent);
  };

  // Keyboard shortcut for save (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  const wordCount = useMemo(
    () =>
      editorContent
        ? editorContent.split(/\s+/).filter((word) => word.length > 0).length
        : 0,
    [editorContent],
  );

  const lineCount = useMemo(
    () => editorContent.split("\n").length,
    [editorContent],
  );

  return (
    <div className="container mx-auto p-2 sm:p-4">
      <div className="flex items-center mb-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <h1 className="text-lg sm:text-2xl font-bold">
            {ruleId ? "Edit Sensei-Check Rule" : "Create New Sensei-Check Rule"}
          </h1>
          {isLoading && (
            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md">
              <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 animate-spin" />
              <span className="text-xs sm:text-sm font-medium">Loading...</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4">
            <div className="min-h-[32px] flex items-center flex-1 w-full">
              {isValid ? (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm w-full sm:w-auto">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="font-medium">Valid YAML</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm w-full sm:w-auto">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Invalid YAML</div>
                    {errorInfo && (
                      <div
                        role="button"
                        tabIndex={0}
                        className="text-xs opacity-75 mt-0.5 cursor-pointer hover:opacity-100 underline decoration-dotted"
                        onClick={() =>
                          errorInfo.line && jumpToError(errorInfo.line)
                        }
                        onKeyDown={(e) => {
                          if (
                            (e.key === "Enter" || e.key === " ") &&
                            errorInfo.line
                          ) {
                            jumpToError(errorInfo.line);
                          }
                        }}
                        title={
                          errorInfo.line
                            ? `Click to jump to line ${errorInfo.line}`
                            : undefined
                        }
                      >
                        {errorInfo.message}
                        {errorInfo.line && ` at line ${errorInfo.line}`}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end w-full sm:w-auto">
              <Button
                size="sm"
                color="primary"
                variant={hasUnsavedChanges ? "solid" : "flat"}
                onPress={() => handleSave()}
                isLoading={isSaving}
                isDisabled={isLoading}
                className="h-8 px-3 text-sm w-full sm:w-auto"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : ruleId ? (
                  <>
                    <Edit className="mr-1.5 h-3.5 w-3.5" />
                    {hasUnsavedChanges ? "Update*" : "Update"}
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {hasUnsavedChanges ? "Save*" : "Save"}
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-[70vh] bg-default-100 rounded-lg">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-default-500">Loading editor...</p>
                </div>
              </div>
            ) : (
              <CodeMirror
                value={editorContent}
                height="60vh"
                width="100%"
                extensions={[
                  yaml(),
                  EditorView.lineWrapping,
                  autocompletion({
                    override: [senseiCheckCompletions],
                    closeOnBlur: false,
                    activateOnTyping: true,
                    maxRenderedOptions: 20,
                  }),
                  senseiCheckYamlLinter,
                  lintGutter(),
                  customKeymap,
                  highlightSelectionMatches(),
                  cursorPositionExtension,
                ]}
                onChange={handleEditorChange}
                theme={isDark ? materialDark : githubLight}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLineGutter: true,
                  highlightActiveLine: true,
                  lineWrapping: true,
                  autocompletion: true,
                }}
                style={{ fontSize: `${fontSize}px` }}
                ref={setEditorRef}
              />
            )}

            {/* Status Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-default-500 border-t border-default-200 bg-default-50 px-2 sm:px-4 py-2 rounded-b-lg gap-2 sm:gap-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <span className="font-mono">
                  Line {cursorPosition.line}, Col {cursorPosition.column}
                </span>
                <span>{lineCount} lines</span>
                <span className="hidden sm:inline">
                  {editorContent.length} characters
                </span>
                {editorContent.length > 0 && (
                  <span className="hidden sm:inline">{wordCount} words</span>
                )}

                {/* Zoom controls */}
                <div className="flex items-center gap-1 sm:ml-2 sm:border-l sm:border-default-300 sm:pl-3">
                  <Button
                    variant="light"
                    size="sm"
                    onPress={zoomOut}
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
                    onPress={zoomIn}
                    aria-label="Zoom in"
                    className="h-5 w-5 min-w-0 p-0 text-default-500 hover:text-default-700"
                  >
                    <ZoomInIcon className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Autosave controls */}
                {ruleId && (
                  <label className="flex items-center gap-1 sm:gap-2 cursor-pointer text-default-600 hover:text-default-700">
                    <input
                      type="checkbox"
                      checked={autosaveEnabled}
                      onChange={(e) => setAutosaveEnabled(e.target.checked)}
                      className="w-3 h-3"
                    />
                    <span className="hidden sm:inline">Auto-save</span>
                    <span className="sm:hidden">Auto</span>
                  </label>
                )}
                {hasUnsavedChanges ? (
                  autosaveEnabled && ruleId ? (
                    <span className="text-amber-600 flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      <span className="hidden sm:inline">
                        Auto-save pending
                      </span>
                      <span className="sm:hidden">Pending</span>
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-500 rounded-full" />
                      <span>Unsaved</span>
                    </span>
                  )
                ) : lastSaved ? (
                  <span className="text-green-600">
                    <span className="hidden sm:inline">
                      Saved: {lastSaved.toLocaleTimeString()}
                    </span>
                    <span className="sm:hidden">Saved</span>
                  </span>
                ) : undefined}
                <span className="text-default-400">YAML</span>
              </div>
            </div>
          </div>
        </div>

        {/* Documentation Panel */}
        <div className="w-full lg:w-1/3">
          <div className="sticky top-4">
            <Tabs defaultValue="sensei-rules" className="space-y-3 -mt-1">
              <Tab key="sensei-rules" title="Sensei-Check Rules Help">
                <div className="bg-default-50 p-2 sm:p-3 rounded-lg max-h-[60vh] overflow-y-auto">
                  <h2 className="text-base font-semibold mb-2">
                    Sensei-Check Rules Documentation
                  </h2>
                  <div className="text-xs text-default-500 mb-3 space-y-1">
                    <div>
                      Use{" "}
                      <kbd className="bg-default-200 px-1.5 py-0.5 rounded text-xs">
                        Ctrl+F
                      </kbd>{" "}
                      to search in editor
                    </div>
                    <div>
                      Use{" "}
                      <kbd className="bg-default-200 px-1.5 py-0.5 rounded text-xs">
                        Ctrl+S
                      </kbd>{" "}
                      to save the file
                    </div>
                    <div>Click any code example to copy it</div>
                  </div>
                  <Accordion variant="light" className="px-0">
                    <AccordionItem
                      key="placeholder"
                      title={
                        <span className="text-foreground dark:text-foreground-dark text-sm font-medium">
                          Documentation Placeholder
                        </span>
                      }
                    >
                      <div className="space-y-3 pt-1 pb-2">
                        <p className="text-xs sm:text-sm text-default-foreground">
                          Detailed documentation for Sensei-Check rules will be
                          added here. This section will include examples, best
                          practices, and configuration options.
                        </p>
                        <div className="space-y-1.5">
                          <div
                            role="button"
                            tabIndex={0}
                            className="relative rounded bg-default-200 px-[0.3rem] py-[0.2rem] font-mono text-xs sm:text-sm whitespace-pre-wrap cursor-pointer hover:bg-default-300 transition-colors overflow-x-auto"
                            onClick={() => {
                              const exampleCode = `rules:
  - name: "response_validation"
    description: "Validate response content"
    enabled: true
    conditions:
      - field: "response"
        operator: "contains"
        value: "success"`;
                              navigator.clipboard.writeText(exampleCode);
                              showToast("success", "Code copied to clipboard");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                const exampleCode = `rules:
  - name: "response_validation"
    description: "Validate response content"
    enabled: true
    conditions:
      - field: "response"
        operator: "contains"
        value: "success"`;
                                navigator.clipboard.writeText(exampleCode);
                                showToast(
                                  "success",
                                  "Code copied to clipboard",
                                );
                              }
                            }}
                            title="Click to copy"
                          >
                            {`rules:
  - name: "response_validation"
    description: "Validate response content"
    enabled: true
    conditions:
      - field: "response"
        operator: "contains"
        value: "success"`}
                          </div>
                          <p className="text-xs sm:text-sm text-default-foreground">
                            Example rule structure for validating responses.
                          </p>
                        </div>
                      </div>
                    </AccordionItem>
                  </Accordion>
                </div>
              </Tab>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SenseiCheckRulesEditor;
