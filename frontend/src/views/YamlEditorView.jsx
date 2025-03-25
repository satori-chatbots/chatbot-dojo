import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { yaml } from '@codemirror/lang-yaml';
import { fetchFile, updateFile, createFile, fetchTemplate, validateYamlOnServer } from '../api/fileApi';
import {
    AlertCircle,
    CheckCircle2,
    ZoomInIcon,
    ZoomOutIcon,
    Save,
    Edit,
} from 'lucide-react';
import { Button, Tabs, Tab, Accordion, AccordionItem } from '@heroui/react';
import { load as yamlLoad } from "js-yaml"
import { materialDark, materialLight } from '@uiw/codemirror-theme-material';
import { tomorrow } from 'thememirror';
import { useTheme } from 'next-themes';
import useSelectedProject from '../hooks/useSelectedProject';
import { useMyCustomToast } from '../contexts/MyCustomToastContext';
import { documentationSections, yamlBasicsSections } from '../data/yamlDocumentation';
import { autocompletion } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import { defaultKeymap, insertNewlineAndIndent } from '@codemirror/commands';
import { linter, lintGutter } from '@codemirror/lint';
import { isEqual } from 'lodash';
import {
    completionsSchema,
    requiredSchema,
    getCursorContext,
    findSimilarKeywords,
    createYamlTypoLinter
} from '../data/yamlSchema';



function YamlEditor() {
    const { fileId } = useParams();
    const [editorContent, setEditorContent] = useState('')
    const [isValid, setIsValid] = useState(true);
    const [fontSize, setFontSize] = useState(14);
    const [errorInfo, setErrorInfo] = useState(null);
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const navigate = useNavigate();
    const [selectedProject] = useSelectedProject();
    const { showToast } = useMyCustomToast();
    const [serverValidationErrors, setServerValidationErrors] = useState(null);

    const zoomIn = () => setFontSize((prev) => Math.min(prev + 2, 24))
    const zoomOut = () => setFontSize((prev) => Math.max(prev - 2, 8))

    // Create a YAML linter for typo detection
    const yamlTypoLinter = linter(createYamlTypoLinter());

    const customKeymap = keymap.of([{
        key: "Enter",
        run: insertNewlineAndIndent
    }]);


    function myCompletions(context) {
        let word = context.matchBefore(/\w*/);
        if (word.from == word.to && !context.explicit) {
            return null;
        }

        // Get editor state and cursor position
        const { state } = context;
        const pos = context.pos;

        // Determine which context we're in
        const contextPath = getCursorContext(state.doc, pos);
        console.log("Current context:", contextPath); // Add this for debugging

        // Choose appropriate completions based on context
        let options = completionsSchema[""] || []; // Default to top level

        // Try to find completions for the exact context
        if (completionsSchema[contextPath]) {
            options = completionsSchema[contextPath];
        } else {
            // Try to find the closest parent context
            const contextParts = contextPath.split('.');
            while (contextParts.length > 0) {
                const parentContext = contextParts.join('.');
                if (completionsSchema[parentContext]) {
                    options = completionsSchema[parentContext];
                    break;
                }
                contextParts.pop();
            }
        }

        return {
            from: word.from,
            options: options
        };
    }

    useEffect(() => {
        // Fetch the template for new files
        if (!fileId) {
            fetchTemplate()
                .then(response => {
                    if (response.template) {
                        setEditorContent(response.template);
                        validateYaml(response.template);
                    }
                })
                .catch(err => {
                    console.error('Error fetching template:', err);
                    showToast('error', 'Failed to load template');
                });
        }

        validateYaml(editorContent);
    }, []);

    useEffect(() => {
        if (fileId) {
            fetchFile(fileId)
                .then(response => {
                    setEditorContent(response.yamlContent);
                    validateYaml(response.yamlContent);
                })
                .catch(err => console.error('Error fetching file:', err));
        }
    }, [fileId]);

    const handleSave = async () => {
        try {
            setServerValidationErrors(null);
            let hasValidationErrors = false;
            let forceSave = false;

            // Only validate on server if there are no syntax errors
            if (!forceSave) {
                try {
                    const validationResult = await validateYamlOnServer(editorContent);
                    if (!validationResult.valid) {
                        setServerValidationErrors(validationResult.errors);
                        hasValidationErrors = true;
                    }
                } catch (validationErr) {
                    // If server validation fails, continue with the save operation
                    console.error("Server validation error:", validationErr);
                    hasValidationErrors = true;
                }
            }

            if (fileId) {
                // Update existing file
                const response = await updateFile(fileId, editorContent, {
                    ignoreValidationErrors: hasValidationErrors || forceSave
                });
                const successMessage = (hasValidationErrors || forceSave)
                    ? 'File saved with validation errors'
                    : 'File updated successfully';

                if (hasValidationErrors || forceSave) {
                    showToast('warning', successMessage);
                } else {
                    showToast('success', response.message || successMessage);
                }
            } else {
                // Create new file
                if (!selectedProject) {
                    showToast('error', 'Please select a project first');
                    return;
                }
                const response = await createFile(editorContent, selectedProject.id, {
                    ignoreValidationErrors: hasValidationErrors || forceSave
                });
                if (response.uploaded_file_ids && response.uploaded_file_ids.length > 0) {
                    // Get the first file ID since we are only uploading one
                    const newFileId = response.uploaded_file_ids[0];
                    const successMessage = (hasValidationErrors || forceSave)
                        ? 'File created with validation errors'
                        : 'File created successfully';
                    showToast(hasValidationErrors || forceSave ? 'warning' : 'success', successMessage);
                    // Navigate to the edit view of the new file
                    navigate(`/yaml-editor/${newFileId}`);
                    return;
                } else {
                    // Extract error message from the response
                    const errorMessage = response.errors && response.errors.length > 0
                        ? response.errors[0].error
                        : 'Failed to create file';
                    showToast('error', errorMessage);
                }
            }
        } catch (err) {
            try {
                const errorObj = JSON.parse(err.message);
                if (errorObj.errors) {
                    // Display all error messages
                    const errorMessages = errorObj.errors.map(err =>
                        `Error: ${err.error}`
                    ).join('\n');
                    showToast('error', errorMessages);
                } else if (errorObj.error) {
                    // Display the error message
                    showToast('error', `Error: ${errorObj.error}`);
                } else {
                    showToast('error', 'Error saving file');
                }
            } catch (e) {
                showToast('error', 'Error saving file');
            }
        }
    };

    // Updates the content of the editor and validates the YAML
    const handleEditorChange = (value) => {
        setEditorContent(value);
        validateYaml(value);
        setServerValidationErrors(null);
    }


    const validateYamlSchema = (yamlData) => {
        const errors = [];

        // Check top-level required fields
        requiredSchema.required.forEach(field => {
            if (!yamlData || yamlData[field] === undefined) {
                errors.push(`Required field "${field}" is missing`);
            }
        });

        // Check nested required fields
        Object.keys(requiredSchema.nested).forEach(parentField => {
            const pathParts = parentField.split('.');
            let currentObj = yamlData;

            // Navigate to the nested object
            for (const part of pathParts) {
                if (!currentObj || currentObj[part] === undefined) {
                    errors.push(`Required section "${parentField}" is missing`);
                    return; // Skip checking children if parent doesn't exist
                }
                currentObj = currentObj[part];
            }

            // Check required children
            requiredSchema.nested[parentField].forEach(childField => {
                if (currentObj[childField] === undefined) {
                    errors.push(`Required field "${childField}" is missing in "${parentField}"`);
                }
            });
        });

        return {
            valid: errors.length === 0,
            errors
        };
    };

    // Validates the YAML content
    const validateYaml = (value) => {
        try {
            // Just parse the YAML to check for syntax errors
            const parsedYaml = yamlLoad(value);
            setIsValid(true);
            setErrorInfo(null);
        } catch (e) {
            setIsValid(false);

            // Parse error message to extract useful information
            const errorLines = e.message.split('\n');
            const errorMessage = errorLines[0];

            // Get code context if available
            const codeContext = errorLines.slice(1).join('\n');

            setErrorInfo({
                message: errorMessage,
                line: e.mark ? e.mark.line + 1 : null,
                column: e.mark ? e.mark.column + 1 : null,
                codeContext: codeContext,
                isSchemaError: false
            });
            console.error('Invalid YAML:', e);
        }
    };

    return (
        <div className="container mx-auto p-4">

            <h1 className="text-2xl font-bold mb-4">{fileId ? 'Edit YAML File' : 'Create New YAML'}</h1>
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

                            {/* Display schema errors if any */}
                            {!isValid && errorInfo && errorInfo.isSchemaError && (
                                <div className="ml-2 text-red-500 text-sm">
                                    <details>
                                        <summary>Schema Validation Errors ({errorInfo.errors.length})</summary>
                                        <ul className="list-disc pl-5 mt-1">
                                            {errorInfo.errors.map((err, idx) => (
                                                <li key={idx}>{err}</li>
                                            ))}
                                        </ul>
                                    </details>
                                </div>
                            )}

                            {/* Display syntax error if any */}
                            {!isValid && errorInfo && !errorInfo.isSchemaError && (
                                <div className="ml-2 text-red-500 text-sm">
                                    {errorInfo.message}
                                    {errorInfo.line && ` at line ${errorInfo.line}`}
                                </div>
                            )}

                            {/* Display simplified server validation errors message */}
                            {serverValidationErrors && (
                                <div className="ml-2 text-red-500 text-sm">
                                    {serverValidationErrors.length} server validation {serverValidationErrors.length === 1 ? 'error' : 'errors'} - see details below
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
                                customKeymap
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
                                {serverValidationErrors.map((err, idx) => (
                                    <li key={idx} className="text-red-600 dark:text-red-300">
                                        {err.message}
                                        {err.line && <span className="font-mono"> at line {err.line}</span>}
                                        {err.path && <span className="font-mono text-red-500 dark:text-red-400"> ({err.path})</span>}
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
                                <h2 className="text-lg font-semibold mb-2">User Profile Documentation</h2>
                                <Accordion>
                                    {Object.entries(documentationSections).map(([sectionTitle, section]) => (
                                        <AccordionItem key={sectionTitle} title={sectionTitle}>
                                            <div className="space-y-4 pt-2">
                                                {section.items.map((item, index) => (
                                                    <div key={index} className="space-y-1.5">
                                                        <pre className="relative rounded bg-default-200 px-[0.3rem] py-[0.2rem] font-mono text-sm whitespace-pre-wrap">
                                                            {item.code}
                                                        </pre>
                                                        <p className="text-sm text-default-foreground/70">{item.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </Tab>
                        <Tab key="yaml" title="YAML Help">
                            <div className="bg-default-50 p-4 rounded-lg">
                                <h2 className="text-lg font-semibold mb-2">YAML Tutorial</h2>
                                <Accordion>
                                    {Object.entries(yamlBasicsSections).map(([sectionTitle, section]) => (
                                        <AccordionItem key={sectionTitle} title={sectionTitle}>
                                            <div className="space-y-4 pt-2">
                                                {section.items.map((item, index) => (
                                                    <div key={index} className="space-y-1.5">
                                                        <pre className="relative rounded bg-default-200 px-[0.3rem] py-[0.2rem] font-mono text-sm whitespace-pre-wrap">
                                                            {item.code}
                                                        </pre>
                                                        <p className="text-sm text-default-foreground/70">{item.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </Tab>
                    </Tabs>
                </div>
            </div>
        </div >
    );
}

export default YamlEditor;
