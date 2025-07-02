import React, { useEffect, useState, useCallback } from "react";
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
  Edit,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button, Tabs, Tab, Accordion, AccordionItem } from "@heroui/react";
import { load as yamlLoad } from "js-yaml";
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
import { linter, lintGutter } from "@codemirror/lint";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  completionsSchema,
  getCursorContext,
  createYamlTypoLinter,
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
  const [serverValidationErrors, setServerValidationErrors] = useState();

  // New state for UI improvements
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isValidatingYaml, setIsValidatingYaml] = useState(false);
  const [isValidatingSchema, setIsValidatingSchema] = useState(false);
  const [hasTypedAfterError, setHasTypedAfterError] = useState(false);

  const zoomIn = () => setFontSize((previous) => Math.min(previous + 2, 24));
  const zoomOut = () => setFontSize((previous) => Math.max(previous - 2, 8));

  const yamlTypoLinter = linter(createYamlTypoLinter());

  const customKeymap = keymap.of([
    {
      key: "Enter",
      run: insertNewlineAndIndent,
    },
    ...searchKeymap,
  ]);

  const validateYaml = useCallback(async (value) => {
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
          } else {
            setServerValidationErrors(validationResult.errors);
          }
        } catch (error) {
          console.error("Schema validation error:", error);
        } finally {
          setIsValidatingSchema(false);
        }
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
    } finally {
      setIsValidatingYaml(false);
    }
  }, []);

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

  const handleSave = async () => {
    setIsSaving(true);
    setHasTypedAfterError(false);
    try {
      // Re-validate before saving to ensure we have the latest validation state
      await validateYaml(editorContent);

      let hasValidationErrors =
        isValid === false ||
        (serverValidationErrors && serverValidationErrors.length > 0);
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
  };

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

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">
            {fileId ? "Edit YAML File" : "Create New YAML"}
          </h1>
          {isLoading && (
            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Loading...</span>
            </div>
          )}
        </div>
        <Button
          variant="light"
          size="sm"
          onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="lg:hidden"
        >
          {sidebarCollapsed ? <Eye /> : <EyeOff />}
          {sidebarCollapsed ? "Show Help" : "Hide Help"}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className="mb-3 flex items-start justify-between gap-4">
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
                      <div className="text-xs opacity-75 mt-0.5">
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

            <Button
              size="sm"
              color="primary"
              variant={hasUnsavedChanges ? "solid" : "flat"}
              onPress={() => handleSave()}
              isLoading={isSaving}
              isDisabled={isLoading}
              className="h-8 px-3 text-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : fileId ? (
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

          {!isValid && errorInfo && errorInfo.isSchemaError && (
            <div className="mb-4 p-3 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20">
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
                  yamlTypoLinter,
                  lintGutter(),
                  customKeymap,
                  highlightSelectionMatches(),
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
                  searchKeymap: true,
                }}
                style={{ fontSize: `${fontSize}px` }}
              />
            )}
            <div className="absolute bottom-2 right-6 flex space-x-1.5">
              <Button
                variant="outline"
                size="sm"
                onPress={zoomOut}
                aria-label="Zoom out"
                className="bg-black/10 dark:bg-black/80 backdrop-blur-sm h-7 w-7 min-w-0 p-0"
              >
                <ZoomOutIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={zoomIn}
                aria-label="Zoom in"
                className="bg-black/10 dark:bg-black/80 backdrop-blur-sm h-7 w-7 min-w-0 p-0"
              >
                <ZoomInIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {serverValidationErrors && (
            <div className="mt-4 p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20">
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center">
                <AlertCircle className="mr-2" />
                Server Validation Failed
              </h3>
              <ul className="list-disc pl-5 mt-2 space-y-1 max-h-60 overflow-y-auto">
                {serverValidationErrors.map((error, index) => (
                  <li key={index} className="text-red-600 dark:text-red-300">
                    {error.message}
                    {error.line && (
                      <span className="font-mono"> at line {error.line}</span>
                    )}
                    {error.path && (
                      <span className="font-mono text-red-500 dark:text-red-400">
                        {" "}
                        ({error.path})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div
          className={`w-full lg:w-1/3 ${sidebarCollapsed ? "hidden lg:block" : ""}`}
        >
          <div className="sticky top-4">
            <Tabs defaultValue="profile" className="space-y-3 -mt-1">
              <Tab key="profile" title="User Profile Help">
                <div className="bg-default-50 p-3 rounded-lg max-h-[70vh] overflow-y-auto">
                  <h2 className="text-base font-semibold mb-2">
                    User Profile Documentation
                  </h2>
                  <div className="text-xs text-default-500 mb-3 space-y-1">
                    <div>
                      Use{" "}
                      <kbd className="bg-default-200 px-1.5 py-0.5 rounded text-xs">
                        Ctrl+F
                      </kbd>{" "}
                      to search in editor
                    </div>
                    <div>Click any code example to copy it</div>
                  </div>
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
                                  className="relative rounded bg-default-200 px-[0.3rem] py-[0.2rem] font-mono text-sm whitespace-pre-wrap cursor-pointer hover:bg-default-300 transition-colors"
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
                                <p className="text-sm text-default-foreground">
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
                <div className="bg-default-50 p-3 rounded-lg max-h-[70vh] overflow-y-auto">
                  <h2 className="text-base font-semibold mb-2">
                    YAML Tutorial
                  </h2>
                  <div className="text-xs text-default-500 mb-3 space-y-1">
                    <div>
                      Use{" "}
                      <kbd className="bg-default-200 px-1.5 py-0.5 rounded text-xs">
                        Ctrl+F
                      </kbd>{" "}
                      to search in editor
                    </div>
                    <div>Click any code example to copy it</div>
                  </div>
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
                                  className="relative rounded bg-default-200 px-[0.3rem] py-[0.2rem] font-mono text-sm whitespace-pre-wrap cursor-pointer hover:bg-default-300 transition-colors"
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
                                <p className="text-sm text-default-foreground">
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
  );
}

export default YamlEditor;
