import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { fetchFile } from '../api/fileApi';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button, Tabs, Tab } from '@heroui/react';
import { load as yamlLoad } from "js-yaml"

const initialYaml = `test_name "pizza_order_test_custom"`

function YamlEditor() {
    const { fileId } = useParams();
    const [editorContent, setEditorContent] = useState(initialYaml)
    const [isValid, setIsValid] = useState(true);

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
        if (fileId) {
            // Update existing file
            // e.g. updateFile(fileId, { content });
        } else {
            // Create a new file
            // e.g. createFile({ content });
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
            yamlLoad(value)
            setIsValid(true)
        } catch (e) {
            setIsValid(false)
            console.error('Invalid YAML:', e)
        }
    }

    return (
        <div className="container mx-auto p-4">

            <h1 className="text-2xl font-bold mb-4">{fileId ? 'Edit YAML File' : 'Create New YAML'}</h1>
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="mr-2">YAML Validity:</span>
                            {isValid ? <CheckCircle2 className="text-green-500" /> : <AlertCircle className="text-red-500" />}
                        </div>
                        <Button onPress={handleSave} disabled={!isValid}>
                            {fileId ? "Update" : "Save"} YAML
                        </Button>
                    </div>
                    <CodeMirror
                        value={editorContent}
                        height="70vh"
                        extensions={[yaml()]}
                        onChange={handleEditorChange}
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            highlightActiveLineGutter: true,
                            highlightActiveLine: true,
                        }}
                    />
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
        </div>
    );
}

export default YamlEditor;
