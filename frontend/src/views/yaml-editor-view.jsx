import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import {
  fetchFile,
  updateFile,
  createFile,
  fetchTemplate,
  validateYamlOnServer,
} from "../api/file-api";
import {
  AlertCircle,
  CheckCircle2,
  ZoomInIcon,
  ZoomOutIcon,
  Save,
  Loader2,
  BookOpen,
  Settings,
  ChevronRight as ChevronRightIcon,
  ExternalLink,
} from "lucide-react";
import {
  Button,
  Tabs,
  Tab,
  Accordion,
  AccordionItem,
  Switch,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  Link,
} from "@heroui/react";
import { materialDark } from "@uiw/codemirror-theme-material";
import { githubLight } from "@uiw/codemirror-theme-github";
import { useTheme } from "next-themes";
import useSelectedProject from "../hooks/use-selected-projects";
import { useSetup } from "../contexts/setup-context";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import {
  documentationSections,
  yamlBasicsSections,
} from "../data/yaml-documentation";
import { autocompletion } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  completionsSchema,
  getCursorContext,
} from "../data/yaml-schema";

function myCompletions(context) {
  const word = context.matchBefore(/\w*/);
  if (word.from === word.to && !context.explicit) {
    return;
  }

  const { state } = context;
  const pos = context.pos;
  const contextPath = getCursorContext(state.doc, pos);

  let options = completionsSchema[""] || [];

  if (completionsSchema[contextPath]) {
    options = completionsSchema[contextPath];
  } else {
    const contextParts = contextPath.split(".");
    while (contextParts.length > 0) {
      const parentContext = contextParts.join(".");
      if (completionsSchema[parentContext]) {
        options = completionsSchema[parentContext];
        break;
      }
      contextParts.pop();
    }
  }

  // Enhanced autocomplete with better descriptions
  const enhancedOptions = options.map((option) => ({
    ...option,
    boost: option.type === "keyword" ? 99 : 0, // Prioritize keywords
  }));

  return {
    from: word.from,
    options: enhancedOptions,
  };
}

function YamlEditor() {
  const { fileId } = useParams();
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

  // New state for UI improvements
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState("");

  const [isValidating, setIsValidating] = useState(false);

  // Autosave and data protection state
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  useEffect(() => {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      const saved = globalThis.localStorage.getItem(
        "yamlEditorAutosaveEnabled",
      );
      setAutosaveEnabled(saved === null ? true : JSON.parse(saved));
    }
  }, []);
  const [lastSaved, setLastSaved] = useState();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      const saved = globalThis.localStorage.getItem(
        "profile-editor-sidebar-collapsed",
      );
      setSidebarCollapsed(saved ? JSON.parse(saved) : false);
    }
  }, []);

  // Persist autosave setting
  useEffect(() => {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      globalThis.localStorage.setItem(
        "yamlEditorAutosaveEnabled",
        JSON.stringify(autosaveEnabled),
      );
    }
  }, [autosaveEnabled]);

  useEffect(() => {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      globalThis.localStorage.setItem(
        "profile-editor-sidebar-collapsed",
        JSON.stringify(sidebarCollapsed),
      );
    }
  }, [sidebarCollapsed]);

  // Enhanced status bar state
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const zoomIn = () => setFontSize((previous) => Math.min(previous + 2, 24));
  const zoomOut = () => setFontSize((previous) => Math.max(previous - 2, 8));

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

  const validateYaml = useCallback(
    async (value) => {
      if (!value.trim()) {
        setIsValid(false);
        setErrorInfo(undefined);
        return false;
      }

      setIsValidating(true);
      const validationResult = await validateYamlOnServer(value, "profile");
      setIsValidating(false);

      if (!validationResult.valid) {
        setIsValid(false);
        setErrorInfo({
          message:
            validationResult.errors?.[0]?.message ||
            "Profile does not match the profile schema",
          line: validationResult.errors?.[0]?.line,
          column: validationResult.errors?.[0]?.column,
          errors: validationResult.errors,
        });
        return false;
      }

      setIsValid(true);
      setErrorInfo(undefined);
      return true;
    },
    [setErrorInfo, setIsValid, setIsValidating],
  );

  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true);
      try {
        if (fileId) {
          const response = await fetchFile(fileId);
          setEditorContent(response.yamlContent);
          setOriginalContent(response.yamlContent);
          await validateYaml(response.yamlContent);
        } else {
          const response = await fetchTemplate();
          if (response.template) {
            setEditorContent(response.template);
            setOriginalContent(response.template);
            await validateYaml(response.template);
          }
        }
      } catch (error) {
        console.error("Error loading content:", error);
        showToast(
          "error",
          fileId ? "Failed to load file" : "Failed to load template",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [fileId, showToast, validateYaml]);

  // Debounced validation effect
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      await validateYaml(editorContent);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [editorContent, validateYaml]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Re-validate before saving to ensure we have the latest validation state
      const contentIsValid = await validateYaml(editorContent);
      const hasValidationErrors = !contentIsValid;
      const forceSave = false;

      if (fileId) {
        const response = await updateFile(fileId, editorContent, {
          ignoreValidationErrors: hasValidationErrors || forceSave,
        });
        await reloadProfiles(); // Update setup progress
        setOriginalContent(editorContent);
        setHasUnsavedChanges(false);
        const successMessage =
          hasValidationErrors || forceSave
            ? "File saved with validation errors"
            : "File updated successfully";
        showToast(
          hasValidationErrors || forceSave ? "warning" : "success",
          response.message || successMessage,
        );
        setLastSaved(new Date()); // Track save time
      } else {
        if (!selectedProject) {
          showToast("error", "Please select a project first");
          return;
        }
        const response = await createFile(editorContent, selectedProject.id, {
          ignoreValidationErrors: hasValidationErrors || forceSave,
        });
        if (
          response.uploaded_file_ids &&
          response.uploaded_file_ids.length > 0
        ) {
          const newFileId = response.uploaded_file_ids[0];
          await reloadProfiles(); // Update setup progress
          setOriginalContent(editorContent);
          setHasUnsavedChanges(false);
          const successMessage =
            hasValidationErrors || forceSave
              ? "File created with validation errors"
              : "File created successfully";
          showToast(
            hasValidationErrors || forceSave ? "warning" : "success",
            successMessage,
          );
          setLastSaved(new Date()); // Track save time
          navigate(`/yaml-editor/${newFileId}`);
        } else {
          const errorMessage =
            response.errors && response.errors.length > 0
              ? response.errors[0].error
              : "Failed to create file";
          showToast("error", errorMessage);
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
          showToast("error", "Error saving file");
        }
      } catch {
        showToast("error", "Error saving file");
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    editorContent,
    fileId,
    navigate,
    reloadProfiles,
    selectedProject,
    showToast,
    validateYaml,
  ]);

  // Autosave functionality
  useEffect(() => {
    if (!autosaveEnabled || !hasUnsavedChanges || !fileId || isSaving) {
      return;
    }

    const autosaveTimer = setTimeout(async () => {
      try {
        await handleSave();
        setLastSaved(new Date());
      } catch (error) {
        console.error("Autosave failed:", error);
      }
    }, 5000); // Auto-save every 5 seconds

    return () => clearTimeout(autosaveTimer);
  }, [
    hasUnsavedChanges,
    autosaveEnabled,
    fileId,
    isSaving,
    handleSave,
    showToast,
  ]);

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
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-xl font-semibold">
              {fileId ? "Edit Profile" : "Create New Profile"}
            </h1>
            <p className="text-sm text-foreground-500">
              User Profile Configuration
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="min-h-[32px] flex items-center flex-1">
              {isValidating ? (
                <div className="flex items-center space-x-2 text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-md text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-medium">Validating Profile...</span>
                </div>
              ) : isValid === false ? (
                <div className="flex items-center space-x-2 text-danger-600 bg-danger-50 dark:bg-danger-900/20 px-3 py-1.5 rounded-md text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">
                    Profile Error: {errorInfo?.message || "Validation failed"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-success-600 bg-success-50 dark:bg-success-900/20 px-3 py-1.5 rounded-md text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Profile is valid</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                color={hasUnsavedChanges ? "primary" : "default"}
                variant={hasUnsavedChanges ? "solid" : "flat"}
                onPress={() => handleSave()}
                isLoading={isSaving}
                isDisabled={!hasUnsavedChanges || isSaving}
                startContent={!isSaving && <Save className="w-4 h-4" />}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Tooltip
                content={
                  sidebarCollapsed ? "Show Documentation" : "Hide Documentation"
                }
              >
                <Button
                  variant="flat"
                  size="sm"
                  isIconOnly
                  onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
                  aria-label={
                    sidebarCollapsed
                      ? "Show Documentation"
                      : "Hide Documentation"
                  }
                >
                  <BookOpen className="w-4 h-4" />
                </Button>
              </Tooltip>
              <Popover placement="bottom-end">
                <PopoverTrigger>
                  <Button
                    variant="flat"
                    size="sm"
                    isIconOnly
                    aria-label="Editor Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="px-4 py-3">
                    <h4 className="text-medium font-semibold mb-3">
                      Editor Settings
                    </h4>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Font Size</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="flat"
                          size="sm"
                          isIconOnly
                          onPress={zoomOut}
                          isDisabled={fontSize <= 8}
                          aria-label="Decrease font size"
                        >
                          <ZoomOutIcon className="w-4 h-4" />
                        </Button>
                        <div className="text-sm px-3 py-1 bg-default-100 rounded min-w-[50px] text-center">
                          {fontSize}px
                        </div>
                        <Button
                          variant="flat"
                          size="sm"
                          isIconOnly
                          onPress={zoomIn}
                          isDisabled={fontSize >= 24}
                          aria-label="Increase font size"
                        >
                          <ZoomInIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col flex-1">
                        <span className="text-sm font-medium">Autosave</span>
                        <span className="text-xs text-foreground-500 mt-1">
                          Saves automatically every 5 seconds
                        </span>
                      </div>
                      <div className="flex-shrink-0 pt-1">
                        <Switch
                          isSelected={autosaveEnabled}
                          onValueChange={setAutosaveEnabled}
                          size="sm"
                          aria-label="Toggle autosave"
                        />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
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
                height="70vh"
                width="100%"
                extensions={[
                  yaml(),
                  EditorView.lineWrapping,
                  autocompletion({
                    override: [myCompletions],
                    closeOnBlur: false,
                    activateOnTyping: true,
                    maxRenderedOptions: 20,
                  }),
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
              />
            )}

            <div className="flex justify-between items-center text-xs text-default-500 border-t border-default-200 bg-default-50 px-4 py-2 rounded-b-lg">
              <div className="flex items-center gap-4">
                <span className="font-mono">
                  Line {cursorPosition.line}, Col {cursorPosition.column}
                </span>
                <span>{lineCount} lines</span>
                <span>{editorContent.length} characters</span>
                {editorContent.length > 0 && (
                  <span>{wordCount} words</span>
                )}
                {hasUnsavedChanges && (
                  <span className="text-warning-600 flex items-center gap-1">
                    <div className="w-2 h-2 bg-warning-500 rounded-full" />
                    <span>Unsaved changes</span>
                  </span>
                )}
                {autosaveEnabled && fileId && (
                  <span className="text-success-600 flex items-center gap-1">
                    <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse" />
                    <span>Autosave enabled</span>
                  </span>
                )}
                {lastSaved && (
                  <span className="text-foreground-400">
                    Last saved: {lastSaved.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span>Ctrl+S to save</span>
                <span className="text-default-400">YAML</span>
              </div>
            </div>
          </div>
        </div>
        <div
          className={`${
            sidebarCollapsed ? "hidden lg:hidden" : "w-96"
          } transition-all duration-300`}
        >
          <div className="h-full flex flex-col border border-border bg-background rounded-lg">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Documentation</h2>
                </div>
                <Button
                  variant="flat"
                  size="sm"
                  isIconOnly
                  onPress={() => setSidebarCollapsed(true)}
                  className="lg:hidden"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-2">
                <Link
                  href="https://github.com/sensei-chat/sensei"
                  target="_blank"
                  className="flex items-center space-x-1 text-sm text-primary hover:text-primary-600"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Full Documentation</span>
                </Link>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Tabs defaultValue="profile" className="space-y-3 -mt-1">
              <Tab key="profile" title="User Profile Help">
                <div className="bg-default-50 p-2 sm:p-3 rounded-lg max-h-[60vh] overflow-y-auto">
                  <h2 className="text-base font-semibold mb-2">
                    User Profile Documentation
                  </h2>
                  <Accordion variant="light" className="px-0">
                    {Object.entries(documentationSections).map(
                      ([sectionTitle, section]) => (
                        <AccordionItem
                          key={sectionTitle}
                          title={
                            <span className="text-foreground dark:text-foreground-dark text-sm font-medium">
                              {sectionTitle}
                            </span>
                          }
                        >
                          <div className="space-y-3 pt-1 pb-2">
                            {section.items.map((item, index) => (
                              <div key={index} className="space-y-1.5">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className="relative rounded bg-default-200 px-[0.3rem] py-[0.2rem] font-mono text-xs sm:text-sm whitespace-pre-wrap cursor-pointer hover:bg-default-300 transition-colors overflow-x-auto"
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.code);
                                    showToast(
                                      "success",
                                      "Code copied to clipboard",
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      navigator.clipboard.writeText(item.code);
                                      showToast(
                                        "success",
                                        "Code copied to clipboard",
                                      );
                                    }
                                  }}
                                  title="Click to copy"
                                >
                                  {item.code}
                                </div>
                                <p className="text-xs sm:text-sm text-default-foreground">
                                  {item.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </AccordionItem>
                      ),
                    )}
                  </Accordion>
                </div>
              </Tab>
              <Tab key="yaml" title="YAML Help">
                <div className="bg-default-50 p-2 sm:p-3 rounded-lg max-h-[60vh] overflow-y-auto">
                  <h2 className="text-base font-semibold mb-2">
                    YAML Tutorial
                  </h2>
                  <Accordion variant="light" className="px-0">
                    {Object.entries(yamlBasicsSections).map(
                      ([sectionTitle, section]) => (
                        <AccordionItem
                          key={sectionTitle}
                          title={
                            <span className="text-foreground dark:text-foreground-dark text-sm font-medium">
                              {sectionTitle}
                            </span>
                          }
                        >
                          <div className="space-y-3 pt-1 pb-2">
                            {section.items.map((item, index) => (
                              <div key={index} className="space-y-1.5">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className="relative rounded bg-default-200 px-[0.3rem] py-[0.2rem] font-mono text-xs sm:text-sm whitespace-pre-wrap cursor-pointer hover:bg-default-300 transition-colors overflow-x-auto"
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.code);
                                    showToast(
                                      "success",
                                      "Code copied to clipboard",
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      navigator.clipboard.writeText(item.code);
                                      showToast(
                                        "success",
                                        "Code copied to clipboard",
                                      );
                                    }
                                  }}
                                  title="Click to copy"
                                >
                                  {item.code}
                                </div>
                                <p className="text-xs sm:text-sm text-default-foreground">
                                  {item.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </AccordionItem>
                      ),
                    )}
                  </Accordion>
                </div>
              </Tab>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default YamlEditor;
