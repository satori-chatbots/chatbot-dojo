import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { yaml } from '@codemirror/lang-yaml';
import { fetchFile, updateFile } from '../api/fileApi';
import { AlertCircle, CheckCircle2, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { Button, Tabs, Tab } from '@heroui/react';
import { load as yamlLoad } from "js-yaml"
import { materialDark, materialLight } from '@uiw/codemirror-theme-material';
import { tomorrow } from 'thememirror';
import { useTheme } from 'next-themes';

const initialYaml = `test_name: "pizza_order_test_custom"`

function YamlEditor() {
    const { fileId } = useParams();
    const [editorContent, setEditorContent] = useState(initialYaml)
    const [isValid, setIsValid] = useState(true);
    const [fontSize, setFontSize] = useState(14);
    const [errorInfo, setErrorInfo] = useState(null);
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const zoomIn = () => setFontSize((prev) => Math.min(prev + 2, 24))
    const zoomOut = () => setFontSize((prev) => Math.max(prev - 2, 8))


    useEffect(() => {
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
        console.log("Button pressed");
        if (fileId) {
            // Update the existing file
            try {
                await updateFile(fileId, editorContent);
                alert('File updated successfully');
            } catch (err) {
                console.error('Error updating file:', err);
                alert('Failed to update file');
            }
        } else {
            // Create a new file (not yet implemented)
            alert('Creating a new file is not implemented yet');
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
                        <Button className="text-sm" onPress={
                            () => handleSave()
                        } isDisabled={!isValid}>
                            {fileId ? "Update" : "Save"} YAML
                        </Button>
                    </div>
                    <div className="relative">
                        <CodeMirror
                            value={editorContent}
                            height="70vh"
                            width="100%"
                            extensions={[yaml(), EditorView.lineWrapping]}
                            onChange={handleEditorChange}
                            theme={isDark ? materialDark : tomorrow}
                            basicSetup={{
                                lineNumbers: true,
                                foldGutter: true,
                                highlightActiveLineGutter: true,
                                highlightActiveLine: true,
                                lineWrapping: true,
                            }}
                            style={{ fontSize: `${fontSize}px` }}
                        />
                        <div className="absolute bottom-2 right-6 flex space-x-2">
                            <Button
                                variant="outline"
                                onPress={zoomOut}
                                aria-label="Zoom out"
                                className="bg-background/80 backdrop-blur-sm text-sm"
                            >
                                <ZoomOutIcon className="w-5 h-5" />
                            </Button>
                            <Button
                                variant="outline"
                                onPress={zoomIn}
                                aria-label="Zoom in"
                                className="bg-background/80 backdrop-blur-sm text-sm"
                            >
                                <ZoomInIcon className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="w-full md:w-1/3">
                    <Tabs defaultValue="profile" className="space-y-4">
                        <Tab key="profile" title="User Profile Help">
                            <div className="bg-default-50 p-4 rounded-lg">

                                <h2 className="text-lg font-semibold mb-2">YAML Syntax Help</h2>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>
                                        Use <code className="bg-default-200 p-1 rounded">test_name: name</code> to name your profile
                                    </li>
                                </ul>
                            </div>
                        </Tab>
                        <Tab key="yaml" title="YAML Help">
                            <div className="bg-default-50 p-4 rounded-lg">
                                <h2 className="text-lg font-semibold mb-2">YAML Syntax Help</h2>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>
                                        Use <code className="bg-default-200 p-1 rounded">key: value</code> for simple key-value
                                        pairs
                                    </li>
                                    <li>Use indentation (2 spaces) for nesting</li>
                                    <li>
                                        Start lists with <code className="bg-default-200 p-1 rounded">-</code>
                                    </li>
                                    <li>
                                        Use <code className="bg-default-200 p-1 rounded">#</code> for comments
                                    </li>
                                    <li>Strings don't usually need quotes</li>
                                    <li>
                                        Use <code className="bg-default-200 p-1 rounded">true</code> or{" "}
                                        <code className="bg-default-200 p-1 rounded">false</code> for booleans
                                    </li>
                                    <li>
                                        Use <code className="bg-default-200 p-1 rounded">null</code> for null values
                                    </li>
                                </ul>
                            </div>
                        </Tab>
                    </Tabs>
                </div>
            </div>
        </div >
    );
}

export default YamlEditor;
