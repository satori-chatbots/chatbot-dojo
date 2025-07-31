import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  Copy,
  Check,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  BookOpen,
} from "lucide-react";
import { Button, Card, CardBody, Tooltip } from "@heroui/react";
import { load as yamlLoad } from "js-yaml";
import { materialDark } from "@uiw/codemirror-theme-material";
import { githubLight } from "@uiw/codemirror-theme-github";
import { useTheme } from "next-themes";
import useSelectedProject from "../hooks/use-selected-projects";
import { useSetup } from "../contexts/setup-context";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { documentationSections } from "../data/yaml-documentation";
import { autocompletion } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { linter, lintGutter } from "@codemirror/lint";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  completionsSchema,
  getCursorContext,
  createYamlTypoLinter,
} from "../data/yaml-schema";

// Constants
const SCROLL_SENSITIVITY_THRESHOLD = 5;

// YAML syntax highlighter for code examples
const highlightYamlCode = (yaml) => {
  let highlighted = yaml
    .replaceAll(
      /(#.*$)/gm,
      '<span class="text-success-600 dark:text-success-400">$1</span>',
    )
    .replaceAll(
      /^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gm,
      '$1<span class="text-primary-600 dark:text-primary-400 font-semibold">$2</span>:',
    )
    .replaceAll(
      /:\s*["']([^"']*?)["']/g,
      ': <span class="text-warning-600 dark:text-warning-400">"$1"</span>',
    )
    .replaceAll(
      /(https?:\/\/[^\s]+)/g,
      '<span class="text-secondary-600 dark:text-secondary-400 underline">$1</span>',
    )
    .replaceAll(
      /(\{[^}]+\})/g,
      '<span class="text-danger-600 dark:text-danger-400 font-medium">$1</span>',
    )
    .replaceAll(
      /:\s*(\d+\.?\d*)\s*$/gm,
      ': <span class="text-secondary-600 dark:text-secondary-400">$1</span>',
    )
    .replaceAll(
      /:\s*(true|false)\s*$/gm,
      ': <span class="text-danger-600 dark:text-danger-400">$1</span>',
    )
    .replaceAll(
      /^(\s*)-\s+/gm,
      '$1<span class="text-default-600 dark:text-default-400">-</span> ',
    );

  return highlighted;
};

// Code block component with syntax highlighting and copy functionality
const CodeBlock = ({ code, description }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [code]);

  return (
    <Card className="border border-border">
      <CardBody className="p-3">
        <div className="relative group">
          <pre className="text-xs bg-content2 p-3 rounded overflow-x-auto mb-2 border border-default-200">
            <code
              dangerouslySetInnerHTML={{
                __html: highlightYamlCode(code),
              }}
            />
          </pre>

          <Tooltip content={copied ? "Copied!" : "Copy code"}>
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              onPress={handleCopy}
              aria-label="Copy code"
            >
              {copied ? (
                <Check className="w-3 h-3 text-success" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </Tooltip>
        </div>

        <p className="text-xs text-foreground-600">{description}</p>
      </CardBody>
    </Card>
  );
};

// Scrollable tabs component
const ScrollableTabs = ({ sections }) => {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeTab, setActiveTab] = useState(Object.keys(sections)[0]);
  const tabsContainerRef = useRef(null);

  const updateScrollButtons = useCallback(() => {
    if (tabsContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
      setCanScrollLeft(scrollLeft > SCROLL_SENSITIVITY_THRESHOLD);
      setCanScrollRight(
        scrollLeft < scrollWidth - clientWidth - SCROLL_SENSITIVITY_THRESHOLD,
      );
    }
  }, []);

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (container) {
      updateScrollButtons();
      container.addEventListener("scroll", updateScrollButtons);
      window.addEventListener("resize", updateScrollButtons);

      return () => {
        container.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", updateScrollButtons);
      };
    }
  }, [updateScrollButtons]);

  // Update scroll buttons when sections change
  useEffect(() => {
    setTimeout(updateScrollButtons, 100);
  }, [sections, updateScrollButtons]);

  const scrollTabs = useCallback((direction) => {
    if (tabsContainerRef.current) {
      const scrollAmount = 200;
      tabsContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  }, []);

  return (
    <div className="w-full">
      <div className="relative mb-4">
        {canScrollLeft && (
          <div className="absolute left-8 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-20 pointer-events-none" />
        )}

        {canScrollRight && (
          <div className="absolute right-8 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-20 pointer-events-none" />
        )}

        {canScrollLeft && (
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-background/90 backdrop-blur-sm shadow-md border border-default-200 hover:bg-default-100"
            onPress={() => scrollTabs("left")}
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}

        {canScrollRight && (
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-background/90 backdrop-blur-sm shadow-md border border-default-200 hover:bg-default-100"
            onPress={() => scrollTabs("right")}
            aria-label="Scroll tabs right"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        )}

        <div
          ref={tabsContainerRef}
          className="overflow-x-auto"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <div className="flex gap-1 border-b border-divider min-w-max">
            {Object.keys(sections).map((sectionName) => (
              <button
                key={sectionName}
                className={`flex items-center space-x-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                  activeTab === sectionName
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-foreground-600 hover:text-foreground hover:border-default-300"
                }`}
                onClick={() => setActiveTab(sectionName)}
              >
                <BookOpen className="w-4 h-4" />
                <span>{sectionName}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {activeTab && sections[activeTab] && (
          <div className="space-y-3">
            {sections[activeTab].items.map((item, index) => (
              <CodeBlock
                key={index}
                code={item.code}
                description={item.description}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

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
  const [serverValidationErrors, setServerValidationErrors] = useState();

  // New state for UI improvements
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      const saved = globalThis.localStorage.getItem(
        "yamlEditorSidebarCollapsed",
      );
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [isValidatingYaml, setIsValidatingYaml] = useState(false);
  const [isValidatingSchema, setIsValidatingSchema] = useState(false);
  const [hasTypedAfterError, setHasTypedAfterError] = useState(false);

  // Autosave and data protection state
  const [lastSaved, setLastSaved] = useState();

  // Persist sidebar state
  useEffect(() => {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      localStorage.setItem(
        "yamlEditorSidebarCollapsed",
        JSON.stringify(sidebarCollapsed),
      );
    }
  }, [sidebarCollapsed]);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Enhanced status bar state
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [editorRef, setEditorRef] = useState();

  const zoomIn = () => setFontSize((previous) => Math.min(previous + 2, 24));
  const zoomOut = () => setFontSize((previous) => Math.max(previous - 2, 8));

  const yamlTypoLinter = linter(createYamlTypoLinter());

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

  const validateYaml = useCallback(
    async (value) => {
      setIsValidatingYaml(true);

      try {
        // First check YAML syntax
        yamlLoad(value);
        setIsValid(true);
        setErrorInfo(undefined);
        setHasTypedAfterError(false);

        // If YAML is valid, check schema on server
        if (value.trim()) {
          setIsValidatingSchema(true);
          try {
            const validationResult = await validateYamlOnServer(value);
            if (validationResult.valid) {
              setServerValidationErrors(undefined);
              return { isValid: true, serverValidationErrors: undefined };
            }
            setServerValidationErrors(validationResult.errors);
            return {
              isValid: true,
              serverValidationErrors: validationResult.errors,
            };
          } catch (error) {
            console.error("Schema validation error:", error);
            // On server-side validation error, we don't have new errors.
            return { isValid: true, serverValidationErrors: undefined };
          } finally {
            setIsValidatingSchema(false);
          }
        } else {
          // YAML is empty, so it's valid with no server errors.
          setServerValidationErrors(undefined);
          return { isValid: true, serverValidationErrors: undefined };
        }
      } catch (error) {
        setIsValid(false);
        setServerValidationErrors(undefined); // Clear server errors if YAML syntax is invalid
        const errorLines = error.message.split("\n");
        const errorMessage = errorLines[0];
        const codeContext = errorLines.slice(1).join("\n");
        setErrorInfo({
          message: errorMessage,
          line: error.mark ? error.mark.line + 1 : undefined,
          column: error.mark ? error.mark.column + 1 : undefined,
          codeContext: codeContext,
          isSchemaError: false,
        });
        setHasTypedAfterError(false);
        console.error("Invalid YAML:", error);
        return { isValid: false, serverValidationErrors: undefined };
      } finally {
        setIsValidatingYaml(false);
      }
    },
    [
      setHasTypedAfterError,
      setErrorInfo,
      setIsValid,
      setIsValidatingSchema,
      setIsValidatingYaml,
      setServerValidationErrors,
    ],
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
    setHasTypedAfterError(false);
    try {
      // Re-validate before saving to ensure we have the latest validation state
      const validationResults = await validateYaml(editorContent);

      const hasValidationErrors =
        !validationResults.isValid ||
        (validationResults.serverValidationErrors &&
          validationResults.serverValidationErrors.length > 0);
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

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(editorContent !== originalContent);
  }, [editorContent, originalContent]);

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

    // If there were previous errors (client or server), mark that user is typing
    if (!isValid || serverValidationErrors) {
      setHasTypedAfterError(true);
    }

    // Clear server validation errors when user starts typing (they'll be re-checked by debounced validation)
    if (serverValidationErrors) {
      setServerValidationErrors(undefined);
    }

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2 text-foreground">
            Loading YAML Editor
          </h2>
          <p className="text-foreground-600">
            Please wait while we prepare your workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-xl font-semibold">
              {fileId ? "Edit YAML File" : "Create New YAML"}
            </h1>
            <p className="text-sm text-foreground-500">
              YAML Profile Configuration
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main Editor Area */}
        <div className="flex-1">
          {/* Validation status and toolbar */}
          <div className="mb-3 flex items-start justify-between gap-4">
            {/* Validation Status */}
            <div className="min-h-[32px] flex items-center flex-1">
              {isValidatingYaml ? (
                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="font-medium">Validating YAML...</span>
                </div>
              ) : isValidatingSchema ? (
                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="font-medium">Validating Profile...</span>
                </div>
              ) : hasTypedAfterError ? (
                <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-md text-sm">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="font-medium">Checking...</span>
                </div>
              ) : isValid === false ? (
                <div className="flex items-start gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-md text-sm">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Invalid YAML</div>
                    {errorInfo && !errorInfo.isSchemaError && (
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
              ) : serverValidationErrors &&
                serverValidationErrors.length > 0 ? (
                <div className="flex items-start gap-2 text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-md text-sm">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Invalid Profile</div>
                    <div className="text-xs opacity-75 mt-0.5">
                      {serverValidationErrors.length} validation{" "}
                      {serverValidationErrors.length === 1 ? "error" : "errors"}
                      {serverValidationErrors.some((error) => error.line) &&
                        " (click to jump)"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-md text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="font-medium">Valid Profile</span>
                </div>
              )}
            </div>

            {/* Editor Toolbar */}
            <div className="flex items-center space-x-2">
              {/* Save Button - Primary Action */}
              <Button
                color={hasUnsavedChanges ? "primary" : "default"}
                variant={hasUnsavedChanges ? "solid" : "flat"}
                size="sm"
                isLoading={isSaving}
                isDisabled={!hasUnsavedChanges || !isValid || isSaving}
                startContent={!isSaving && <Save className="w-4 h-4" />}
                onPress={handleSave}
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
            </div>
          </div>

          {/* Editor */}
          <div className="relative">
            <CodeMirror
              value={editorContent}
              onChange={handleEditorChange}
              theme={isDark ? materialDark : githubLight}
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
                yamlTypoLinter,
                lintGutter(),
                customKeymap,
                highlightSelectionMatches(),
                cursorPositionExtension,
              ]}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLineGutter: true,
                highlightActiveLine: true,
                lineWrapping: true,
                autocompletion: true,
              }}
              placeholder="Enter your YAML configuration here..."
              style={{ fontSize: `${fontSize}px` }}
              ref={setEditorRef}
            />

            {/* Status bar directly under editor */}
            <div className="flex justify-between items-center text-xs text-default-500 border-t border-default-200 bg-default-50 px-4 py-2 rounded-b-lg">
              <div className="flex items-center gap-4">
                <span className="font-mono">
                  Line {cursorPosition.line}, Col {cursorPosition.column}
                </span>
                <span>{lineCount} lines</span>
                <span>{editorContent.length} characters</span>
                {editorContent.length > 0 && <span>{wordCount} words</span>}
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
              </div>
              <div className="flex items-center gap-3">
                {/* Zoom controls */}
                <div className="flex items-center gap-1">
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
                <span>Ctrl+S to save</span>
                <span className="text-default-400">YAML</span>
              </div>
            </div>
          </div>

          {/* Error details */}
          {!isValid && errorInfo && errorInfo.isSchemaError && (
            <div className="mt-4 p-3 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20">
              <details>
                <summary className="cursor-pointer text-red-700 dark:text-red-400 font-medium">
                  Schema Validation Errors ({errorInfo.errors.length})
                </summary>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  {errorInfo.errors.map((error, index) => (
                    <li
                      key={index}
                      className="text-red-600 dark:text-red-300 text-sm"
                    >
                      {error}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}

          {/* Server validation errors */}
          {serverValidationErrors && (
            <div className="mt-4 p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20">
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center">
                <AlertCircle className="mr-2" />
                Server Validation Failed
              </h3>
              <ul className="list-disc pl-5 mt-2 space-y-1 max-h-60 overflow-y-auto">
                {serverValidationErrors.map((error, index) => (
                  <li
                    key={index}
                    className={`text-red-600 dark:text-red-300 ${
                      error.line ? "" : "ml-6"
                    }`}
                  >
                    {error.line ? (
                      <button
                        type="button"
                        className="text-left underline decoration-dotted hover:text-red-800 dark:hover:text-red-100"
                        onClick={() => jumpToError(error.line)}
                        title={`Click to jump to line ${error.line}`}
                      >
                        {error.message}
                        <span className="font-mono"> at line {error.line}</span>
                        {error.path && (
                          <span className="font-mono text-red-500 dark:text-red-400">
                            {" "}
                            ({error.path})
                          </span>
                        )}
                      </button>
                    ) : (
                      <>
                        {error.message}
                        {error.path && (
                          <span className="font-mono text-red-500 dark:text-red-400">
                            {" "}
                            ({error.path})
                          </span>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Documentation Sidebar */}
        <div
          className={`${
            sidebarCollapsed ? "hidden lg:hidden" : "w-96"
          } transition-all duration-300`}
        >
          <div className="h-full flex flex-col border border-border bg-background rounded-lg">
            {/* Sidebar Header */}
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
            </div>

            {/* Documentation Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">
                    User Profile Help
                  </h3>
                  <div className="text-xs text-foreground-600 mb-4 space-y-1">
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
                  <ScrollableTabs sections={documentationSections} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default YamlEditor;
