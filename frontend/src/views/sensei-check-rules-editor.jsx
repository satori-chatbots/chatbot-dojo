// Simple YAML syntax highlighting (top-level module scope)
function highlightYaml(yamlCode) {
  return (
    yamlCode
      // Comments first
      .replaceAll(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>')
      // Keys (before colon) - avoid already highlighted content
      .replaceAll(
        /^(\s*)([^#\s<][^:<]*?):/gm,
        '$1<span class="text-red-600 font-semibold">$2</span>:',
      )
      // String values (in quotes)
      .replaceAll(
        /: *(['"])((?:[^'"\\]|\\.)*)?\1/g,
        ': <span class="text-green-600">$1$2$1</span>',
      )
      // Boolean and special values - avoid already highlighted content
      .replaceAll(
        /: *(True|False|true|false|null|all|\d+\.?\d*)(?!\w)/g,
        ': <span class="text-purple-600 font-semibold">$1</span>',
      )
      // Functions - avoid already highlighted content
      .replaceAll(
        /(?<!<[^>]*)\b([a-zA-Z_][a-zA-Z0-9_]*)\(/g,
        '<span class="text-blue-600 font-semibold">$1</span>(',
      )
  );
}
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
  // Edit,
  Loader2,
  BookOpen,
  Settings,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ExternalLink,
} from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  Switch,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  Link,
} from "@heroui/react";
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
import { senseiCheckDocumentationSections } from "../data/sensei-check-documentation";

// Constants
const SCROLL_SENSITIVITY_THRESHOLD = 5;

// Code block component for documentation with syntax highlighting
const CodeBlock = ({ code, description }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  }, [code]);

  return (
    <Card className="w-full">
      <CardBody className="p-4">
        <div className="space-y-3">
          <p className="text-sm text-default-600">{description}</p>
          <div className="relative">
            <pre className="bg-default-100 dark:bg-default-50 p-3 rounded-md text-sm overflow-x-auto font-mono">
              <code
                dangerouslySetInnerHTML={{
                  __html: highlightYaml(code),
                }}
              />
            </pre>
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="absolute top-2 right-2"
              onPress={handleCopy}
              aria-label="Copy code"
            >
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
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
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(
        scrollLeft < scrollWidth - clientWidth - SCROLL_SENSITIVITY_THRESHOLD,
      );
    }
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const container = tabsContainerRef.current;
    if (container) {
      container.addEventListener("scroll", updateScrollButtons);
      window.addEventListener("resize", updateScrollButtons);

      const observer = new ResizeObserver(() => {
        updateScrollButtons();
      });
      observer.observe(container);

      return () => {
        container.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", updateScrollButtons);
        observer.disconnect();
      };
    }
  }, [updateScrollButtons]);

  useEffect(() => {
    const timer = setTimeout(updateScrollButtons, 100);
    return () => clearTimeout(timer);
  }, [sections, updateScrollButtons]);

  const scrollTabs = useCallback((direction) => {
    if (tabsContainerRef.current) {
      const scrollAmount = 250;
      const newScrollLeft =
        direction === "left"
          ? Math.max(0, tabsContainerRef.current.scrollLeft - scrollAmount)
          : Math.min(
              tabsContainerRef.current.scrollWidth -
                tabsContainerRef.current.clientWidth,
              tabsContainerRef.current.scrollLeft + scrollAmount,
            );

      tabsContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });
    }
  }, []);

  return (
    <div className="w-full">
      {/* Tab navigation with scroll arrows */}
      <div className="relative mb-4">
        {/* Left gradient fade when scrollable */}
        {canScrollLeft && (
          <div className="absolute left-8 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-20 pointer-events-none" />
        )}

        {/* Right gradient fade when scrollable */}
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

        {/* Scrollable tab headers container */}
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

      {/* Tab content */}
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

// Basic YAML autocomplete for sensei-check rules
function senseiCheckCompletions(context) {
  const word = context.matchBefore(/\w*/);
  if (word.from === word.to && !context.explicit) {
    return;
  }

  const options = [
    { label: "name", type: "keyword", info: "Rule name identifier" },
    { label: "description", type: "keyword", info: "Rule description" },
    {
      label: "active",
      type: "keyword",
      info: "Enable/disable rule (True/False)",
    },
    {
      label: "conversations",
      type: "keyword",
      info: "Number of conversations to validate (1, 2, 3... or 'all')",
    },
    { label: "oracle", type: "keyword", info: "Validation logic expression" },
    { label: "when", type: "keyword", info: "Condition when rule applies" },
    {
      label: "if",
      type: "keyword",
      info: "If condition for metamorphic rules",
    },
    {
      label: "then",
      type: "keyword",
      info: "Then condition for metamorphic rules",
    },
    { label: "on-error", type: "keyword", info: "Custom error message" },
    { label: "True", type: "value", info: "Boolean true" },
    { label: "False", type: "value", info: "Boolean false" },
    {
      label: "all",
      type: "value",
      info: "All conversations (for global rules)",
    },

    // Text analysis functions
    { label: "language", type: "function", info: "Detect language of phrases" },
    {
      label: "length",
      type: "function",
      info: "Get character length statistics",
    },
    { label: "tone", type: "function", info: "Analyze emotional tone" },
    {
      label: "only_talks_about",
      type: "function",
      info: "Check if chatbot stays on topic",
    },
    {
      label: "missing_outputs",
      type: "function",
      info: "Get output data with no value",
    },
    {
      label: "utterance_index",
      type: "function",
      info: "Find conversation turn about topic",
    },
    {
      label: "chatbot_returns",
      type: "function",
      info: "Select phrases containing pattern",
    },
    {
      label: "repeated_answers",
      type: "function",
      info: "Detect duplicate responses",
    },
    {
      label: "semantic_content",
      type: "function",
      info: "Check semantic agreement",
    },
    {
      label: "is_unique",
      type: "function",
      info: "Check uniqueness across conversations",
    },
    { label: "currency", type: "function", info: "Extract currency from text" },

    // Utility functions
    {
      label: "extract_float",
      type: "function",
      info: "Extract float from text",
    },
    {
      label: "conversation_length",
      type: "function",
      info: "Get conversation length",
    },

    // Built-in variables
    {
      label: "conv",
      type: "variable",
      info: "Conversation array for multi-conversation rules",
    },
    {
      label: "chatbot_phrases",
      type: "variable",
      info: "All chatbot phrases in conversation",
    },
    {
      label: "user_phrases",
      type: "variable",
      info: "All user phrases in conversation",
    },
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
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [selectedProject] = useSelectedProject();
  const { reloadProfiles } = useSetup();
  const { showToast } = useMyCustomToast();

  // Editor state
  const [editorContent, setEditorContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [errorInfo, setErrorInfo] = useState();

  // UI state
  const [fontSize, setFontSize] = useState(14);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [lastSaved, setLastSaved] = useState();
  // editorRef removed (unused)
  const [ruleProject, setRuleProject] = useState();

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sensei-check-sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });

  // Autosave state
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    const saved = localStorage.getItem("sensei-check-autosave-enabled");
    return saved ? JSON.parse(saved) : true;
  });

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem(
      "sensei-check-sidebar-collapsed",
      JSON.stringify(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);

  // Persist autosave setting
  useEffect(() => {
    localStorage.setItem(
      "sensei-check-autosave-enabled",
      JSON.stringify(autosaveEnabled),
    );
  }, [autosaveEnabled]);

  const zoomIn = () => setFontSize((previous) => Math.min(previous + 2, 24));
  const zoomOut = () => setFontSize((previous) => Math.max(previous - 2, 8));

  const senseiCheckYamlLinter = linter(createSenseiCheckYamlLinter());

  // Jump to error location functionality
  // ...existing code...

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading rule configuration...</span>
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
              {ruleId
                ? "Edit Sensei-Check Rule"
                : "Create New Sensei-Check Rule"}
            </h1>
            <p className="text-sm text-foreground-500">
              Conversation Correctness Rules Configuration
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
              {errorInfo ? (
                <div className="flex items-center space-x-2 text-danger-600 bg-danger-50 dark:bg-danger-900/20 px-3 py-1.5 rounded-md text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">
                    YAML Error: {errorInfo.message}
                  </span>
                </div>
              ) : isValid && editorContent.trim() ? (
                <div className="flex items-center space-x-2 text-success-600 bg-success-50 dark:bg-success-900/20 px-3 py-1.5 rounded-md text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">YAML is valid</span>
                </div>
              ) : undefined}
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
                {isSaving ? "Saving..." : "Save"}
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

              {/* Editor Settings */}
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

                    {/* Font Size Controls */}
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

                    {/* Autosave Toggle */}
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
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: false,
                allowMultipleSelections: false,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                highlightSelectionMatches: false,
                searchKeymap: true,
              }}
              placeholder="Enter your Sensei-check rule YAML configuration here..."
              style={{ fontSize: `${fontSize}px` }}
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
                {autosaveEnabled && ruleId && (
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

            {/* Documentation Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <ScrollableTabs sections={senseiCheckDocumentationSections} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SenseiCheckRulesEditor;
