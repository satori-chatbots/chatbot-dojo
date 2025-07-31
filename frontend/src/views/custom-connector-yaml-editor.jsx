import React, { useEffect, useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@heroui/react";
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

  const zoomIn = () => setFontSize((previous) => Math.min(previous + 2, 24));
  const zoomOut = () => setFontSize((previous) => Math.max(previous - 2, 8));

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
description: "A custom connector for my chatbot"

# Add your connector configuration below
# Example:
# endpoint: "https://api.example.com"
# api_key: "your-api-key"
# model: "gpt-4"
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
description: "A custom connector for my chatbot"

# Add your connector configuration below
# Example:
# endpoint: "https://api.example.com"
# api_key: "your-api-key"
# model: "gpt-4"
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

  const extensions = useMemo(
    () => [
      yaml(),
      EditorView.theme({
        "&": {
          fontSize: `${fontSize}px`,
        },
        ".cm-content": {
          minHeight: "500px",
        },
        ".cm-focused": {
          outline: "none",
        },
      }),
      yamlLinter,
      lintGutter(),
      customKeymap,
    ],
    [fontSize, yamlLinter, customKeymap],
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
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
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

        <div className="flex items-center space-x-2">
          {/* Zoom controls */}
          <Button
            variant="flat"
            size="sm"
            isIconOnly
            onPress={zoomOut}
            isDisabled={fontSize <= 8}
          >
            <ZoomOutIcon className="w-4 h-4" />
          </Button>
          <span className="text-sm px-2">{fontSize}px</span>
          <Button
            variant="flat"
            size="sm"
            isIconOnly
            onPress={zoomIn}
            isDisabled={fontSize >= 24}
          >
            <ZoomInIcon className="w-4 h-4" />
          </Button>

          {/* Save button */}
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
        </div>
      </div>

      {/* Validation status */}
      {errorInfo && (
        <div className="flex items-center space-x-2 p-3 bg-danger-50 dark:bg-danger-900/20 border-b border-danger-200 dark:border-danger-800">
          <AlertCircle className="w-4 h-4 text-danger-600" />
          <span className="text-sm text-danger-700 dark:text-danger-300">
            YAML Error: {errorInfo.message}
          </span>
        </div>
      )}

      {isValid && editorContent.trim() && (
        <div className="flex items-center space-x-2 p-3 bg-success-50 dark:bg-success-900/20 border-b border-success-200 dark:border-success-800">
          <CheckCircle2 className="w-4 h-4 text-success-600" />
          <span className="text-sm text-success-700 dark:text-success-300">
            YAML is valid
          </span>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={editorContent}
          onChange={handleEditorChange}
          theme={isDark ? materialDark : githubLight}
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
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between p-2 text-xs text-foreground-500 border-t border-border bg-background">
        <div className="flex items-center space-x-4">
          <span>YAML</span>
          <span>Lines: {editorContent.split("\n").length}</span>
          {hasUnsavedChanges && (
            <span className="text-warning-600">● Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span>Ctrl+S to save</span>
        </div>
      </div>
    </div>
  );
}

export default CustomConnectorYamlEditor;
