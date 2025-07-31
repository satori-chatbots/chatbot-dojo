import React, { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { load as yamlLoad } from "js-yaml";
import { ArrowLeft, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { Button, Link } from "@heroui/react";
import { materialDark } from "@uiw/codemirror-theme-material";
import { githubLight } from "@uiw/codemirror-theme-github";
import { useTheme } from "next-themes";
import { createChatbotConnector } from "../api/chatbot-connector-api";
import apiClient from "../api/api-client";
import { ENDPOINTS } from "../api/config";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { customConnectorDocumentationSections } from "../data/custom-connector-documentation";
import { useYamlEditor } from "../hooks/use-yaml-editor";
import { ValidationStatus } from "../components/yaml/validation-status";
import { EditorToolbar } from "../components/yaml/editor-toolbar";
import { EditorStatusBar } from "../components/yaml/editor-status-bar";
import { DocumentationSidebar } from "../components/yaml/documentation-sidebar";

function CustomConnectorYamlEditor() {
  const { connectorId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useMyCustomToast();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // State for connector metadata
  const [connectorName, setConnectorName] = useState("");

  const onLoad = useCallback(async () => {
    if (!connectorId || connectorId === "new") {
      setConnectorName("New Custom Connector");
      return `# Custom Connector Configuration
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
`;
    }

    try {
      // Fetch connector YAML configuration
      const response = await apiClient(
        `${ENDPOINTS.CHATBOTCONNECTOR}${connectorId}/config/`,
      );
      if (response.ok) {
        const data = await response.json();
        setConnectorName(data.name || "Custom Connector");
        return (
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
`
        );
      } else {
        throw new Error("Failed to load connector configuration");
      }
    } catch (error) {
      showToast({
        title: "Error",
        description: `Failed to load connector: ${error.message}`,
        status: "error",
      });
      throw error;
    }
  }, [connectorId, showToast]);

  const onSave = useCallback(
    async (content) => {
      try {
        let targetConnectorId = connectorId;

        // If this is a new connector, create it first
        if (connectorId === "new") {
          // Extract name from YAML content
          let connectorName = "custom-connector";
          try {
            const yamlData = yamlLoad(content);
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
          `${ENDPOINTS.CHATBOTCONNECTOR}${targetConnectorId}/config/`,
          {
            method: "PUT",
            body: JSON.stringify({
              content: content,
            }),
          },
        );

        if (response.ok) {
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
        const errorMessage =
          error.response?.data?.detail || "Failed to save connector";
        throw new Error(errorMessage);
      }
    },
    [connectorId, navigate, showToast],
  );

  // Use the shared YAML editor hook
  const editor = useYamlEditor({
    onLoad,
    onSave,
    storageKey: `custom-connector-${connectorId}`,
  });

  if (editor.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2 text-foreground">
            Loading Custom Connector Editor
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
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main Editor Area */}
        <div className="flex-1">
          {/* Validation status and toolbar */}
          <div className="mb-3 flex items-start justify-between gap-4">
            {/* Validation Status */}
            <div className="min-h-[32px] flex items-center flex-1">
              <ValidationStatus
                isValidatingYaml={editor.isValidatingYaml}
                isValidatingSchema={editor.isValidatingSchema}
                hasTypedAfterError={editor.hasTypedAfterError}
                isValid={editor.isValid}
                errorInfo={editor.errorInfo}
                serverValidationErrors={editor.serverValidationErrors}
                onJumpToError={editor.jumpToError}
              />
            </div>

            {/* Editor Toolbar */}
            <EditorToolbar
              hasUnsavedChanges={editor.hasUnsavedChanges}
              isSaving={editor.isSaving}
              isValid={editor.isValid}
              fileId={connectorId}
              onSave={editor.handleSave}
              sidebarCollapsed={editor.sidebarCollapsed}
              onToggleSidebar={() =>
                editor.setSidebarCollapsed(!editor.sidebarCollapsed)
              }
            />
          </div>

          {/* Editor */}
          <div className="relative">
            <CodeMirror
              value={editor.editorContent}
              onChange={editor.handleEditorChange}
              theme={isDark ? materialDark : githubLight}
              height="70vh"
              width="100%"
              extensions={editor.extensions}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLineGutter: true,
                highlightActiveLine: true,
                lineWrapping: true,
                autocompletion: true,
              }}
              placeholder="Enter your custom connector YAML configuration here..."
              style={{ fontSize: `${editor.fontSize}px` }}
              ref={editor.setEditorRef}
            />

            {/* Status bar */}
            <EditorStatusBar
              cursorPosition={editor.cursorPosition}
              lineCount={editor.lineCount}
              characterCount={editor.editorContent.length}
              wordCount={editor.wordCount}
              hasUnsavedChanges={editor.hasUnsavedChanges}
              lastSaved={editor.lastSaved}
              fontSize={editor.fontSize}
              onZoomIn={editor.zoomIn}
              onZoomOut={editor.zoomOut}
            />
          </div>

          {/* Error details */}
          {!editor.isValid &&
            editor.errorInfo &&
            editor.errorInfo.isSchemaError && (
              <div className="mt-4 p-3 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20">
                <details>
                  <summary className="cursor-pointer text-red-700 dark:text-red-400 font-medium">
                    Schema Validation Errors ({editor.errorInfo.errors.length})
                  </summary>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    {editor.errorInfo.errors.map((error, index) => (
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
          {editor.serverValidationErrors && (
            <div className="mt-4 p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20">
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center">
                <AlertCircle className="mr-2" />
                Server Validation Failed
              </h3>
              <ul className="list-disc pl-5 mt-2 space-y-1 max-h-60 overflow-y-auto">
                {editor.serverValidationErrors.map((error, index) => (
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
                        onClick={() => editor.jumpToError(error.line)}
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
        <DocumentationSidebar
          collapsed={editor.sidebarCollapsed}
          onToggle={editor.setSidebarCollapsed}
          sections={customConnectorDocumentationSections}
          filterOutTabs={["Testing Your Configuration"]}
          helpTitle="Custom Connector Help"
        >
          <div className="mt-4">
            <Link
              href="https://github.com/Chatbot-TRACER/chatbot-connectors/blob/main/docs/CUSTOM_CONNECTOR_GUIDE.md"
              target="_blank"
              className="flex items-center space-x-1 text-sm text-primary hover:text-primary-600"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Full Documentation</span>
            </Link>
          </div>
        </DocumentationSidebar>
      </div>
    </div>
  );
}

export default CustomConnectorYamlEditor;
