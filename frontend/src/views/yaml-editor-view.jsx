import React, { useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import {
  fetchFile,
  updateFile,
  createFile,
  fetchTemplate,
  validateYamlOnServer,
} from "../api/file-api";
import { AlertCircle, Loader2 } from "lucide-react";
import { materialDark } from "@uiw/codemirror-theme-material";
import { githubLight } from "@uiw/codemirror-theme-github";
import { useTheme } from "next-themes";
import useSelectedProject from "../hooks/use-selected-projects";
import { useSetup } from "../contexts/setup-context";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { documentationSections } from "../data/yaml-documentation";
import { autocompletion } from "@codemirror/autocomplete";
import { linter } from "@codemirror/lint";
import {
  completionsSchema,
  getCursorContext,
  createYamlTypoLinter,
} from "../data/yaml-schema";
import { useYamlEditor } from "../hooks/use-yaml-editor";
import { ValidationStatus } from "../components/yaml/validation-status";
import { EditorToolbar } from "../components/yaml/editor-toolbar";
import { EditorStatusBar } from "../components/yaml/editor-status-bar";
import { DocumentationSidebar } from "../components/yaml/documentation-sidebar";

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
  const navigate = useNavigate();
  const [selectedProject] = useSelectedProject();
  const { reloadProfiles } = useSetup();
  const { showToast } = useMyCustomToast();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const yamlTypoLinter = linter(createYamlTypoLinter());

  // Custom validation function for this editor
  const createValidationFunction = useCallback(() => {
    return async (value, setIsValidatingSchema) => {
      try {
        // First check YAML syntax
        const { load: yamlLoad } = await import("js-yaml");
        yamlLoad(value);

        // If YAML is valid, check schema on server
        if (value.trim()) {
          try {
            // Set schema validation state before making request
            if (setIsValidatingSchema) {
              setIsValidatingSchema(true);
            }

            const validationResult = await validateYamlOnServer(value);
            if (validationResult.valid) {
              return { isValid: true, serverValidationErrors: undefined };
            }
            return {
              isValid: true,
              serverValidationErrors: validationResult.errors,
            };
          } catch (error) {
            console.error("Schema validation error:", error);
            return { isValid: true, serverValidationErrors: undefined };
          } finally {
            // Clear schema validation state after request completes
            if (setIsValidatingSchema) {
              setIsValidatingSchema(false);
            }
          }
        } else {
          return { isValid: true, serverValidationErrors: undefined };
        }
      } catch (error) {
        const errorLines = error.message.split("\n");
        const errorMessage = errorLines[0];
        const codeContext = errorLines.slice(1).join("\n");
        const errorInfo = {
          message: errorMessage,
          line: error.mark ? error.mark.line + 1 : undefined,
          column: error.mark ? error.mark.column + 1 : undefined,
          codeContext: codeContext,
          isSchemaError: false,
        };
        console.error("Invalid YAML:", error);
        return { isValid: false, errorInfo };
      }
    };
  }, []);

  const onLoad = useCallback(async () => {
    if (fileId) {
      const response = await fetchFile(fileId);
      return response.yamlContent;
    } else {
      const response = await fetchTemplate();
      return response.template || "";
    }
  }, [fileId]);

  const onSave = useCallback(
    async (content) => {
      // Re-validate before saving to ensure we have the latest validation state
      const validationFunction = createValidationFunction();
      const validationResults = await validationFunction(content);

      const hasValidationErrors =
        !validationResults.isValid ||
        (validationResults.serverValidationErrors &&
          validationResults.serverValidationErrors.length > 0);

      if (fileId) {
        const response = await updateFile(fileId, content, {
          ignoreValidationErrors: hasValidationErrors,
        });
        await reloadProfiles();
        const successMessage = hasValidationErrors
          ? "File saved with validation errors"
          : "File updated successfully";
        showToast(
          hasValidationErrors ? "warning" : "success",
          response.message || successMessage,
        );
        return response;
      } else {
        if (!selectedProject) {
          throw new Error("Please select a project first");
        }
        const response = await createFile(content, selectedProject.id, {
          ignoreValidationErrors: hasValidationErrors,
        });
        if (
          response.uploaded_file_ids &&
          response.uploaded_file_ids.length > 0
        ) {
          const newFileId = response.uploaded_file_ids[0];
          await reloadProfiles();
          const successMessage = hasValidationErrors
            ? "File created with validation errors"
            : "File created successfully";
          showToast(
            hasValidationErrors ? "warning" : "success",
            successMessage,
          );
          navigate(`/yaml-editor/${newFileId}`);
          return response;
        } else {
          const errorMessage =
            response.errors && response.errors.length > 0
              ? response.errors[0].error
              : "Failed to create file";
          throw new Error(errorMessage);
        }
      }
    },
    [
      fileId,
      selectedProject,
      reloadProfiles,
      showToast,
      navigate,
      createValidationFunction,
    ],
  );

  // Use the shared YAML editor hook
  const editor = useYamlEditor({
    onLoad,
    onSave,
    validateYamlFunction: undefined, // Will be set after initialization
    storageKey: "yamlEditor",
    enableAutosave: true,
    autosaveDelay: 3000, // Auto-save after 3 seconds of inactivity
  });

  // Update the editor's validation function with the custom validation
  useEffect(() => {
    const validationFunction = createValidationFunction();

    editor.validateYaml = async (value) => {
      editor.setIsValidatingYaml(true);
      try {
        const result = await validationFunction(
          value,
          editor.setIsValidatingSchema,
        );

        // Update state based on validation result
        editor.setIsValid(result.isValid);
        editor.setErrorInfo(result.errorInfo);
        editor.setServerValidationErrors(result.serverValidationErrors);
        editor.setHasTypedAfterError(false);

        return result;
      } catch (error) {
        console.error("Validation function error:", error);
        editor.setIsValid(false);
        editor.setErrorInfo({
          message: "Validation failed",
          isSchemaError: false,
        });
        editor.setServerValidationErrors(undefined);
        editor.setHasTypedAfterError(false);
        return { isValid: false };
      } finally {
        editor.setIsValidatingYaml(false);
      }
    };
  }, [createValidationFunction, editor]);

  // Enhanced extensions with autocomplete and linter
  const enhancedExtensions = useMemo(
    () => [
      ...editor.extensions,
      autocompletion({
        override: [myCompletions],
        closeOnBlur: false,
        activateOnTyping: true,
        maxRenderedOptions: 20,
      }),
      yamlTypoLinter,
    ],
    [editor.extensions, yamlTypoLinter],
  );

  if (editor.isLoading) {
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
              fileId={fileId}
              onSave={editor.handleSave}
              sidebarCollapsed={editor.sidebarCollapsed}
              onToggleSidebar={() =>
                editor.setSidebarCollapsed(!editor.sidebarCollapsed)
              }
              autosaveEnabled={editor.autosaveEnabled}
              onToggleAutosave={editor.setAutosaveEnabled}
              lastSaved={editor.lastSaved}
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
              extensions={enhancedExtensions}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLineGutter: true,
                highlightActiveLine: true,
                lineWrapping: true,
                autocompletion: true,
              }}
              placeholder="Enter your YAML configuration here..."
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
                        <span className="font-modern-mono">
                          {" "}
                          at line {error.line}
                        </span>
                        {error.path && (
                          <span className="font-modern-mono text-red-500 dark:text-red-400">
                            {" "}
                            ({error.path})
                          </span>
                        )}
                      </button>
                    ) : (
                      <>
                        {error.message}
                        {error.path && (
                          <span className="font-modern-mono text-red-500 dark:text-red-400">
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
          sections={documentationSections}
        />
      </div>
    </div>
  );
}

export default YamlEditor;
