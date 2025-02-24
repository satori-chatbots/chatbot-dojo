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

    const documentationSections = {
        'Basic Configuration': {
            items: [
                {
                    code: 'test_name: "sample_name"',
                    description: 'Unique name for the test suite (avoid duplicates).'
                }
            ]
        },
        'LLM Configuration': {
            items: [
                {
                    code: 'temperature: 0.8',
                    description: '0.0 (deterministic) to 1.0 (creative). Controls response randomness.'
                },
                {
                    code: 'model: gpt-4o-mini',
                    description: 'Choose from OpenAI models available in LangChain.'
                },
                {
                    code: 'format: { type: text }',
                    description: 'Choose between text or speech mode. For speech, provide config file path.'
                }
            ]
        },
        'User Configuration': {
            items: [
                {
                    code: 'language: English',
                    description: 'Set the primary conversation language (defaults to English).'
                },
                {
                    code: 'role: "Define role here"',
                    description: 'Define the user\'s role or behavior (e.g., customer ordering food).'
                },
                {
                    code: 'context: ["personality: path/to/file.yml", "additional context"]',
                    description: 'Add personality files and additional context prompts.'
                },
                {
                    code: `goals:
  - "goal with {{variable_name}}"
  - variable_name:
      function: /* see variable functions */
      type: string|int|float
      data: [value1, value2] | { min: 1, max: 6, step: 2 }`,
                    description: 'Define goals with variables. Variables require function, type, and data.'
                }
            ]
        },
        'Variable Structure': {
            items: [
                {
                    code: `type: string|int|float`,
                    description: 'Specify the variable type (string, integer, or float).'
                },
                {
                    code: `data:
  - value1
  - value2
  - any(prompt)`,
                    description: 'Manual list of values. Use any() for LLM-generated values.'
                },
                {
                    code: `data:
  min: 1
  max: 6
  step: 2`,
                    description: 'For numeric types: define range with min, max, and step.'
                },
                {
                    code: `data:
  file: path/to/function.py
  function_name: function_name
  args: [arg1, arg2]`,
                    description: 'Use custom functions to generate data lists.'
                }
            ]
        },
        'Variable Functions': {
            items: [
                {
                    code: `function: default()`,
                    description: 'Use all values in the data list.'
                },
                {
                    code: `function: forward()
function: forward(other_var)`,
                    description: 'Iterate through values. Can be nested with other variables.'
                },
                {
                    code: `function: random()
function: random(5)
function: random(rand)`,
                    description: 'Pick random value(s). Specify count or use random count.'
                },
                {
                    code: 'function: another()',
                    description: 'Pick different values each time until list is exhausted.'
                }
            ]
        },
        'Chatbot Settings': {
            items: [
                {
                    code: 'is_starter: False',
                    description: 'Set to True if chatbot initiates conversations.'
                },
                {
                    code: 'fallback: "I\'m sorry..."',
                    description: 'Define chatbot\'s error message to avoid loops.'
                },
                {
                    code: `output:
  - variable_name:
      type: string|int|float|money|time|date
      description: "Description for extraction"`,
                    description: 'Define variables to extract from conversations.'
                }
            ]
        },
        'Conversation Control': {
            items: [
                {
                    code: `number: 5 | all_combinations | sample(0.2)`,
                    description: 'Control test volume (specific number, all combinations, or sample percentage).'
                },
                {
                    code: 'max_cost: 1',
                    description: 'Set maximum cost in dollars for entire test execution.'
                },
                {
                    code: `goal_style:
  steps: 5 | random_steps: 35 | all_answered: { limit: 10 }
  max_cost: 0.1`,
                    description: 'Define conversation endpoints with optional per-conversation cost limit.'
                },
                {
                    code: `interaction_style:
  - random:
      - make spelling mistakes
      - all questions
      - change language: [italian, portuguese]`,
                    description: 'Set conversation behaviors. Use random to combine multiple styles.'
                }
            ]
        }
    };

    const yamlBasicsSections = {
        'Basic Syntax': {
            items: [
                {
                    code: `key: value`,
                    description: 'Simple key-value pairs are defined with a colon and space.'
                },
                {
                    code: `quoted: "This is a string"
unquoted: This is also a string`,
                    description: 'Strings can be quoted or unquoted. Use quotes for strings with special characters.'
                },
                {
                    code: `number: 42
boolean: true
float: 3.14`,
                    description: 'Numbers, booleans, and floats are automatically typed.'
                }
            ]
        },
        'Lists': {
            items: [
                {
                    code: `simple_list:
  - item1
  - item2
  - item3`,
                    description: 'Lists are created using hyphens with proper indentation.'
                },
                {
                    code: `nested_list:
  - item1
  - sublist:
    - subitem1
    - subitem2`,
                    description: 'Lists can contain nested elements. Maintain consistent indentation.'
                }
            ]
        },
        'Objects/Maps': {
            items: [
                {
                    code: `person:
  name: John
  age: 30
  city: New York`,
                    description: 'Objects are created using indented key-value pairs.'
                },
                {
                    code: `nested_object:
  person:
  name: John
  address:
    street: 123 Main St
    city: New York`,
                    description: 'Objects can be nested using increased indentation for each level.'
                }
            ]
        },
        'Common Practices': {
            items: [
                {
                    code: `# This is a comment
key: value # Inline comment`,
                    description: 'Comments start with # and can be on their own line or inline.'
                },
                {
                    code: `spaces: 2  # Standard indentation
  not-tabs: true`,
                    description: 'Use spaces for indentation (typically 2 spaces). Do not use tabs.'
                },
                {
                    code: `empty: null
  blank_string: ""
  space_string: " "`,
                    description: 'Different ways to represent empty or null values.'
                }
            ]
        },
        'Multiple Documents': {
            items: [
                {
                    code: `---
document: 1
---
document: 2`,
                    description: 'Use three dashes (---) to separate multiple documents in a single file.'
                }
            ]
        }

    };

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
                            extensions={[yaml(), EditorView.lineWrapping]}
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
