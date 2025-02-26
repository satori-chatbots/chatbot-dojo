import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { yaml } from '@codemirror/lang-yaml';
import { fetchFile, updateFile, createFile, fetchTemplate } from '../api/fileApi';
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


    const zoomIn = () => setFontSize((prev) => Math.min(prev + 2, 24))
    const zoomOut = () => setFontSize((prev) => Math.max(prev - 2, 8))

    const completions = [
        { label: "match", type: "keyword" },
        { label: "hello", type: "variable", info: "(World)" },
        { label: "magic", type: "text", apply: "⠁⭒*.✩.*⭒⠁", detail: "macro" }
    ]

    function myCompletions(context) {
        let word = context.matchBefore(/\w*/)
        if (word.from == word.to && !context.explicit)
            return null
        return {
            from: word.from,
            options: completions
        }
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
            if (fileId) {
                // Update existing file
                const response = await updateFile(fileId, editorContent);
                //alert(response.message || 'File updated successfully');
                showToast('success', response.message || 'File updated successfully');
            } else {
                // Create new file
                if (!selectedProject) {
                    //alert('Please select a project first');
                    showToast('error', 'Please select a project first');
                    return;
                }
                const response = await createFile(editorContent, selectedProject.id);
                if (response.uploaded_file_ids && response.uploaded_file_ids.length > 0) {
                    // Get the first file ID since we are only uploading one
                    const newFileId = response.uploaded_file_ids[0];
                    //alert('File created successfully');
                    showToast('success', 'File created successfully');
                    // Navigate to the edit view of the new file
                    navigate(`/yaml-editor/${newFileId}`);
                    return;
                } else {
                    // Extract error message from the response
                    const errorMessage = response.errors && response.errors.length > 0
                        ? response.errors[0].error
                        : 'Failed to create file';
                    //alert(errorMessage);
                    showToast('error', errorMessage);
                }
            }
        } catch (err) {
            // The error is already being displayed by fileApi.js
            //console.error('Error saving file:', err);
            try {
                const errorObj = JSON.parse(err.message);
                if (errorObj.errors) {
                    // Display all error messages
                    const errorMessages = errorObj.errors.map(err =>
                        `Error: ${err.error}`
                    ).join('\n');
                    //alert(errorMessages);
                    showToast('error', errorMessages);
                } else if (errorObj.error) {
                    // Display the error message
                    //alert(`Error: ${errorObj.error}`);
                    showToast('error', `Error: ${errorObj.error}`);
                }

                else {
                    //alert('Error saving file');
                    showToast('error', 'Error saving file');
                }
            } catch (e) {
                //alert('Error saving file');
                showToast('error', 'Error saving file');
            }
        }
    };

    // Updates the content of the editor and validates the YAML
    const handleEditorChange = (value) => {
        setEditorContent(value);
        validateYaml(value);
    }

    // Validates the YAML content
    const validateYaml = (value) => {
        try {
            yamlLoad(value);
            setIsValid(true);
            setErrorInfo(null);
        } catch (e) {
            setIsValid(false);
            setErrorInfo({
                message: e.message,
                line: e.mark ? e.mark.line + 1 : null,
                column: e.mark ? e.mark.column + 1 : null
            });
            console.error('Invalid YAML:', e);
        }
    }

    return (
        <div className="container mx-auto p-4">

            <h1 className="text-2xl font-bold mb-4">{fileId ? 'Edit YAML File' : 'Create New YAML'}</h1>
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="mr-2">YAML Validity:</span>
                            {isValid ? <CheckCircle2 className="text-green-500" /> : <AlertCircle className="text-red-500" />}
                        </div>
                        <Button
                            className="text-sm"
                            color="primary"
                            onPress={() => handleSave()}
                            isDisabled={!isValid}
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
                            extensions={[yaml(), EditorView.lineWrapping, autocompletion({ override: [myCompletions] })]}
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
