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
} from "lucide-react";
import { Button, Tabs, Tab, Accordion, AccordionItem } from "@heroui/react";
import { load as yamlLoad } from "js-yaml";
import { materialDark } from "@uiw/codemirror-theme-material";
import { tomorrow } from "thememirror";
import { useTheme } from "next-themes";
import useSelectedProject from "../hooks/use-selected-projects";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import {
  documentationSections,
  yamlBasicsSections,
} from "../data/yaml-documentation";
import { autocompletion } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { linter, lintGutter } from "@codemirror/lint";
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

  return {
    from: word.from,
    options: options,
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
  const { showToast } = useMyCustomToast();
  const [serverValidationErrors, setServerValidationErrors] = useState();

  const zoomIn = () => setFontSize((previous) => Math.min(previous + 2, 24));
  const zoomOut = () => setFontSize((previous) => Math.max(previous - 2, 8));

  const yamlTypoLinter = linter(createYamlTypoLinter());

  const customKeymap = keymap.of([
    {
      key: "Enter",
      run: insertNewlineAndIndent,
    },
  ]);

  const validateYaml = useCallback((value) => {
    try {
      yamlLoad(value);
      setIsValid(true);
      setErrorInfo(undefined);
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
        isSchemaError: false,
      });
      console.error("Invalid YAML:", error);
    }
  }, []);

  useEffect(() => {
    if (fileId) {
      fetchFile(fileId)
        .then((response) => {
          setEditorContent(response.yamlContent);
          validateYaml(response.yamlContent);
          validateYamlOnServer(response.yamlContent)
            .then((validationResult) => {
              if (!validationResult.valid) {
                setServerValidationErrors(validationResult.errors);
              }
            })
            .catch((error) => {
              console.error("Error validating YAML on server:", error);
            });
        })
        .catch((error) => console.error("Error fetching file:", error));
    } else {
      fetchTemplate()
        .then((response) => {
          if (response.template) {
            setEditorContent(response.template);
            validateYaml(response.template);
          }
        })
        .catch((error) => {
          console.error("Error fetching template:", error);
          showToast("error", "Failed to load template");
        });
    }
  }, [fileId, showToast, validateYaml]);

  const handleSave = async () => {
    try {
      setServerValidationErrors(undefined);
      let hasValidationErrors = false;
      const forceSave = false;

      if (!forceSave) {
        try {
          const validationResult = await validateYamlOnServer(editorContent);
          if (!validationResult.valid) {
            setServerValidationErrors(validationResult.errors);
            hasValidationErrors = true;
          }
        } catch (error) {
          console.error("Server validation error:", error);
          hasValidationErrors = true;
        }
      }

      if (fileId) {
        const response = await updateFile(fileId, editorContent, {
          ignoreValidationErrors: hasValidationErrors || forceSave,
        });
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
    }
  };

  const handleEditorChange = (value) => {
    setEditorContent(value);
    validateYaml(value);
    setServerValidationErrors(undefined);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        {fileId ? "Edit YAML File" : "Create New YAML"}
      </h1>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center">
              <span className="mr-2">YAML Validity:</span>
              {isValid && !serverValidationErrors ? (
                <CheckCircle2 className="text-green-500" />
              ) : (
                <AlertCircle className="text-red-500" />
              )}

              {!isValid && errorInfo && errorInfo.isSchemaError && (
                <div className="ml-2 text-red-500 text-sm">
                  <details>
                    <summary>
                      Schema Validation Errors ({errorInfo.errors.length})
                    </summary>
                    <ul className="list-disc pl-5 mt-1">
                      {errorInfo.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}

              {!isValid && errorInfo && !errorInfo.isSchemaError && (
                <div className="ml-2 text-red-500 text-sm">
                  {errorInfo.message}
                  {errorInfo.line && ` at line ${errorInfo.line}`}
                </div>
              )}

              {serverValidationErrors && (
                <div className="ml-2 text-red-500 text-sm">
                  {serverValidationErrors.length} server validation{" "}
                  {serverValidationErrors.length === 1 ? "error" : "errors"} -
                  see details below
                </div>
              )}
            </div>
            <Button
              className="text-sm"
              color="primary"
              onPress={() => handleSave()}
            >
              {fileId ? (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Update YAML
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save YAML
                </>
              )}
            </Button>
          </div>
          <div className="relative">
            <CodeMirror
              value={editorContent}
              height="70vh"
              width="100%"
              extensions={[
                yaml(),
                EditorView.lineWrapping,
                autocompletion({ override: [myCompletions] }),
                yamlTypoLinter,
                lintGutter(),
                customKeymap,
              ]}
              onChange={handleEditorChange}
              theme={isDark ? materialDark : tomorrow}
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
            <div className="absolute bottom-2 right-6 flex space-x-2">
              <Button
                variant="outline"
                onPress={zoomOut}
                aria-label="Zoom out"
                className="bg-black/10 dark:bg-black/80 backdrop-blur-sm text-sm"
              >
                <ZoomOutIcon className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                onPress={zoomIn}
                aria-label="Zoom in"
                className="bg-black/10 dark:bg-black/80 backdrop-blur-sm text-sm"
              >
                <ZoomInIcon className="w-5 h-5" />
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
        <div className="w-full lg:w-1/3">
          <Tabs defaultValue="profile" className="space-y-4">
            <Tab key="profile" title="User Profile Help">
              <div className="bg-default-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-2">
                  User Profile Documentation
                </h2>
                <Accordion>
                  {Object.entries(documentationSections).map(
                    ([sectionTitle, section]) => (
                      <AccordionItem key={sectionTitle} title={sectionTitle}>
                        <div className="space-y-4 pt-2">
                          {section.items.map((item, index) => (
                            <div key={index} className="space-y-1.5">
                              <pre className="relative rounded bg-default-200 px-[0.3rem] py-[0.2rem] font-mono text-sm whitespace-pre-wrap">
                                {item.code}
                              </pre>
                              <p className="text-sm text-default-foreground/70">
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
              <div className="bg-default-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-2">YAML Tutorial</h2>
                <Accordion>
                  {Object.entries(yamlBasicsSections).map(
                    ([sectionTitle, section]) => (
                      <AccordionItem key={sectionTitle} title={sectionTitle}>
                        <div className="space-y-4 pt-2">
                          {section.items.map((item, index) => (
                            <div key={index} className="space-y-1.5">
                              <pre className="relative rounded bg-default-200 px-[0.3rem] py-[0.2rem] font-mono text-sm whitespace-pre-wrap">
                                {item.code}
                              </pre>
                              <p className="text-sm text-default-foreground/70">
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
  );
}

export default YamlEditor;
