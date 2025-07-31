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
  AlertCircle,
  CheckCircle2,
  ZoomInIcon,
  ZoomOutIcon,
  Save,
  ArrowLeft,
  Loader2,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Settings,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  Link,
  Switch,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
} from "@heroui/react";
import { load as yamlLoad } from "js-yaml";
import { materialDark } from "@uiw/codemirror-theme-material";
import { githubLight } from "@uiw/codemirror-theme-github";
import { useTheme } from "next-themes";
import { createChatbotConnector } from "../api/chatbot-connector-api";
import apiClient from "../api/api-client";
import API_BASE_URL, { ENDPOINTS } from "../api/config";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { keymap } from "@codemirror/view";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { linter, lintGutter } from "@codemirror/lint";
import { searchKeymap } from "@codemirror/search";
import { customConnectorDocumentationSections } from "../data/custom-connector-documentation";

// Constants
const SCROLL_SENSITIVITY_THRESHOLD = 5;
const AUTOSAVE_DELAY_MS = 10_000;

// YAML syntax highlighter for code examples
const highlightYamlCode = (yaml) => {
  let highlighted = yaml
    // Comments
    .replaceAll(
      /(#.*$)/gm,
      '<span class="text-success-600 dark:text-success-400">$1</span>',
    )
    // Keys (before colon)
    .replaceAll(
      /^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gm,
      '$1<span class="text-primary-600 dark:text-primary-400 font-semibold">$2</span>:',
    )
    // String values (quoted)
    .replaceAll(
      /:\s*["']([^"']*?)["']/g,
      ': <span class="text-warning-600 dark:text-warning-400">"$1"</span>',
    )
    // URLs and placeholders
    .replaceAll(
      /(https?:\/\/[^\s]+)/g,
      '<span class="text-secondary-600 dark:text-secondary-400 underline">$1</span>',
    )
    .replaceAll(
      /(\{[^}]+\})/g,
      '<span class="text-danger-600 dark:text-danger-400 font-medium">$1</span>',
    )
    // Numbers
    .replaceAll(
      /:\s*(\d+\.?\d*)\s*$/gm,
      ': <span class="text-secondary-600 dark:text-secondary-400">$1</span>',
    )
    // Booleans
    .replaceAll(
      /:\s*(true|false)\s*$/gm,
      ': <span class="text-danger-600 dark:text-danger-400">$1</span>',
    )
    // Array items
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
      console.error("Failed to copy code:", error);
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

          {/* Copy button */}
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

      // Also update when tabs are rendered
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

  // Update scroll buttons when sections change
  useEffect(() => {
    const timer = setTimeout(updateScrollButtons, 100); // Small delay to ensure DOM is updated
    return () => clearTimeout(timer);
  }, [sections, updateScrollButtons]);

  const scrollTabs = useCallback((direction) => {
    if (tabsContainerRef.current) {
      const scrollAmount = 250; // Increased scroll amount for better UX
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

  // Filter out the 'Testing Your Configuration' tab
  const filteredSections = Object.fromEntries(
    Object.entries(sections).filter(
      ([key]) => key !== "Testing Your Configuration",
    ),
  );

  return (
    <div className="w-full">
      {/* Tab navigation with scroll arrows - ONLY affects the tab headers */}
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

        {/* Scrollable tab headers container - ONLY scrolls the tab navigation */}
        <div
          ref={tabsContainerRef}
          className="overflow-x-auto"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <div className="flex gap-1 border-b border-divider min-w-max">
            {Object.keys(filteredSections).map((sectionName) => (
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

      {/* Tab content - SEPARATE from scrollable area */}
      <div className="space-y-4">
        {activeTab && filteredSections[activeTab] && (
          <div className="space-y-3">
            {filteredSections[activeTab].items.map((item, index) => (
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

function CustomConnectorYamlEditor() {
  const { connectorId } = useParams();
  const [editorContent, setEditorContent] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [errorInfo, setErrorInfo] = useState();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const { showToast } = useMyCustomToast();

  // State for UI improvements
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState("");
  const [connectorName, setConnectorName] = useState("");

  // New state for sidebar and responsive design
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("custom-connector-sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Autosave and data protection state
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    const saved = localStorage.getItem("custom-connector-autosave-enabled");
    return saved ? JSON.parse(saved) : true;
  });
  const [lastSaved, setLastSaved] = useState();

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem(
      "custom-connector-sidebar-collapsed",
      JSON.stringify(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);

  // Persist autosave setting
  useEffect(() => {
    localStorage.setItem(
      "custom-connector-autosave-enabled",
      JSON.stringify(autosaveEnabled),
    );
  }, [autosaveEnabled]);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };

    handleResize(); // Check on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Basic YAML linter
  const yamlLinter = linter((view) => {
    const diagnostics = [];
    const content = view.state.doc.toString();

    if (!content.trim()) {
      return diagnostics;
    }

    try {
      yamlLoad(content);
    } catch (error) {
      const match = error.message.match(/at line (\d+)/);
      const line = match ? Number.parseInt(match[1]) - 1 : 0;
      const pos = view.state.doc.line(Math.max(1, line + 1));

      diagnostics.push({
        from: pos.from,
        to: pos.to,
        severity: "error",
        message: error.message,
      });
    }

    return diagnostics;
  });

  const customKeymap = keymap.of([
    {
      key: "Enter",
      run: insertNewlineAndIndent,
    },
    ...searchKeymap,
  ]);

  const validateYaml = useCallback((value) => {
    if (!value.trim()) {
      setIsValid(true);
      setErrorInfo(undefined);
      return;
    }

    try {
      yamlLoad(value);
      setIsValid(true);
      setErrorInfo(undefined);
    } catch (error) {
      setIsValid(false);
      setErrorInfo({
        message: error.message,
        line: error.mark?.line || 0,
        column: error.mark?.column || 0,
      });
    }
  }, []);

  // Load connector data
  useEffect(() => {
    const loadConnector = async () => {
      if (!connectorId || connectorId === "new") {
        setEditorContent(`# Custom Connector Configuration
# Define your custom connector configuration here

name: "my-custom-connector"
base_url: "https://api.example.com"

send_message:
  path: "/chat"
  method: "POST"
  headers:
    Content-Type: "application/json"
    # Authorization: "Bearer your-api-key"
  payload_template:
    message: "{user_msg}"
    # user_id: "unique_user_id"

response_path: "response.text"

# Examples of response_path for different APIs:
# OpenAI-style: "choices.0.message.content"
# Simple response: "message"
# Nested response: "data.response.text"
# Array response: "responses.0.content"
`);
        setOriginalContent("");
        setConnectorName("New Custom Connector");
        return;
      }

      setIsLoading(true);
      try {
        // Fetch connector YAML configuration
        const response = await apiClient(
          `${API_BASE_URL}${ENDPOINTS.CHATBOTCONNECTOR}${connectorId}/config/`,
        );
        if (response.ok) {
          const data = await response.json();
          setEditorContent(
            data.content ||
              `# Custom Connector Configuration
# Define your custom connector configuration here

name: "${data.name || "my-custom-connector"}"
base_url: "https://api.example.com"

send_message:
  path: "/chat"
  method: "POST"
  headers:
    Content-Type: "application/json"
    # Authorization: "Bearer your-api-key"
  payload_template:
    message: "{user_msg}"
    # user_id: "unique_user_id"

response_path: "response.text"

# Examples of response_path for different APIs:
# OpenAI-style: "choices.0.message.content"
# Simple response: "message"
# Nested response: "data.response.text"
# Array response: "responses.0.content"
`,
          );
          setOriginalContent(data.content || "");
          setConnectorName(data.name || "Custom Connector");
        } else {
          throw new Error("Failed to load connector configuration");
        }
      } catch (error) {
        showToast({
          title: "Error",
          description: `Failed to load connector: ${error.message}`,
          status: "error",
        });
        setEditorContent("");
        setOriginalContent("");
      } finally {
        setIsLoading(false);
      }
    };

    loadConnector();
  }, [connectorId, showToast]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(editorContent !== originalContent);
  }, [editorContent, originalContent]);

  // Validate YAML on content change
  useEffect(() => {
    const timer = setTimeout(() => {
      validateYaml(editorContent);
    }, 300);

    return () => clearTimeout(timer);
  }, [editorContent, validateYaml]);

  const handleSave = useCallback(async () => {
    if (!isValid) {
      showToast({
        title: "Invalid YAML",
        description: "Please fix YAML syntax errors before saving.",
        status: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      let targetConnectorId = connectorId;

      // If this is a new connector, create it first
      if (connectorId === "new") {
        // Extract name from YAML content
        let connectorName = "custom-connector";
        try {
          const yamlData = yamlLoad(editorContent);
          if (yamlData && yamlData.name) {
            connectorName = yamlData.name;
          }
        } catch {
          // Use default name if YAML parsing fails
          console.warn("Could not extract name from YAML, using default");
        }

        // Create the connector first
        const newConnector = await createChatbotConnector({
          name: connectorName,
          technology: "custom",
          parameters: {},
        });

        targetConnectorId = newConnector.id;
        setConnectorName(newConnector.name);
      }

      // Save connector YAML configuration
      const response = await apiClient(
        `${API_BASE_URL}${ENDPOINTS.CHATBOTCONNECTOR}${targetConnectorId}/config/`,
        {
          method: "PUT",
          body: JSON.stringify({
            content: editorContent,
          }),
        },
      );

      if (response.ok) {
        setOriginalContent(editorContent);
        setLastSaved(new Date());
        showToast({
          title: "Success",
          description: "Custom connector configuration saved successfully!",
          status: "success",
        });

        if (connectorId === "new") {
          navigate(`/custom-connector-editor/${targetConnectorId}`);
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save configuration");
      }
    } catch (error) {
      showToast({
        title: "Error",
        description: `Failed to save: ${error.message}`,
        status: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }, [editorContent, isValid, connectorId, navigate, showToast]);

  // Autosave functionality
  useEffect(() => {
    if (
      !hasUnsavedChanges ||
      !autosaveEnabled ||
      connectorId === "new" ||
      isSaving
    ) {
      return;
    }

    const autosaveTimer = setTimeout(async () => {
      try {
        await handleSave();
        showToast({
          title: "Auto-saved",
          description: "Changes saved automatically",
          status: "success",
          duration: 2000,
        });
      } catch (error) {
        console.error("Autosave failed:", error);
      }
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(autosaveTimer);
  }, [
    hasUnsavedChanges,
    autosaveEnabled,
    connectorId,
    isSaving,
    handleSave,
    showToast,
  ]);

  // Prevent data loss on page leave
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

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

  const handleEditorChange = (value) => {
    setEditorContent(value);
  };

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

  const extensions = useMemo(
    () => [
      yaml(),
      EditorView.theme({
        "&": {
          fontSize: `${fontSize}px`,
        },
        ".cm-content": {
          padding: "10px",
        },
        ".cm-focused": {
          outline: "none",
        },
        ".cm-scroller": {
          fontFamily: "inherit",
        },
      }),
      yamlLinter,
      lintGutter(),
      customKeymap,
      cursorPositionExtension,
    ],
    [fontSize, yamlLinter, customKeymap, cursorPositionExtension],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading connector configuration...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="flat"
            size="sm"
            startContent={<ArrowLeft className="w-4 h-4" />}
            onPress={() => navigate("/chatbot-connectors")}
          >
            Back to Connectors
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{connectorName}</h1>
            <p className="text-sm text-foreground-500">
              Custom Connector Configuration
            </p>
          </div>
        </div>

        {/* Removed duplicate save button from header */}
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
                          Saves automatically every 10 seconds
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
              extensions={extensions}
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
              placeholder="Enter your custom connector YAML configuration here..."
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
                {autosaveEnabled && connectorId !== "new" && (
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
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-2">
                <Link
                  href="https://github.com/Chatbot-TRACER/chatbot-connectors/blob/main/docs/CUSTOM_CONNECTOR_GUIDE.md"
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
              <ScrollableTabs sections={customConnectorDocumentationSections} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomConnectorYamlEditor;
