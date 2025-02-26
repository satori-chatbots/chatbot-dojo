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

    // Utility function to insert colon, newline, and extra indent
    function addColonAndIndent(view, completion, from, to) {
        // Get the current line at the insertion point
        const line = view.state.doc.lineAt(from);
        // Get the current line's indentation (spaces/tabs at the beginning)
        const currentIndent = line.text.match(/^\s*/)[0];
        // Define extra indent (adjust as needed, e.g., two spaces)
        const extraIndent = "  ";
        const newIndent = currentIndent + extraIndent;
        // Construct the text to insert
        const insertText = `${completion.label}: \n${newIndent}`;
        // Dispatch the change to the editor
        view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + insertText.length }
        });
    }

    // Inserts the keywords, make a new line with the proper indentation and starts a new list inside the keyword
    function addColonIndentAndList(view, completion, from, to) {
        // Get the current line at the insertion point
        const line = view.state.doc.lineAt(from);
        // Get the current line's indentation (spaces/tabs at the beginning)
        const currentIndent = line.text.match(/^\s*/)[0];
        // Define extra indent and start the list
        const extraIndent = "  -";
        const newIndent = currentIndent + extraIndent;
        const insertText = `${completion.label}: \n${newIndent} `;
        // Dispatch the change to the editor
        view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + insertText.length }
        })
    }

    // Insert the keyword, semicolon, space and double quotes and places the cursor between
    function addColonAndQuotes(view, completion, from, to) {
        const insertText = `${completion.label}: ""`;
        // Insert the text and place cursor between quotes
        view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + insertText.length - 1 }
        });
    }

    // Insert the keyword, semicolon, space and brackets for functions
    function addColonAndBrackets(view, completion, from, to) {
        const insertText = `${completion.label}()`;
        // Insert the text and place cursor between brackets
        view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + insertText.length - 1 }
        });
    }

    // Insert the keyword, semicolon and space inline
    function addColonAndSpace(view, completion, from, to) {
        const insertText = `${completion.label}: `;
        view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + insertText.length }
        });
    }



    // Define the complete schema for autocompletion
    const completionsSchema = {
        // Top level
        "": [
            { label: "test_name", type: "keyword", info: "Unique name to identify this profile", apply: addColonAndQuotes },
            { label: "llm", type: "keyword", info: "LLM Configuration", apply: addColonAndIndent },
            { label: "user", type: "keyword", info: "User Configuration", apply: addColonAndIndent },
            { label: "chatbot", type: "keyword", info: "Chatbot Configuration", apply: addColonAndIndent },
            { label: "conversation", type: "keyword", info: "Conversation Configuration", apply: addColonAndIndent },
        ],
        // LLM section
        "llm": [
            { label: "temperature", type: "keyword", info: "Controls randomness (0.0 to 1.0)", apply: addColonAndSpace },
            { label: "model", type: "keyword", info: "Model to use (e.g., 'gpt-4o-mini')", apply: addColonAndSpace },
            { label: "format", type: "keyword", info: "Output format configuration", apply: addColonAndIndent },
        ],
        "llm.format": [
            { label: "type", type: "keyword", info: "Format type (text or speech)", apply: addColonAndSpace },
            { label: "config", type: "keyword", info: "Path to speech configuration file (if type is speech)", apply: addColonAndSpace },
        ],
        // User section
        "user": [
            { label: "language", type: "keyword", info: "The language of the user", apply: addColonAndSpace },
            { label: "role", type: "keyword", info: "Define the user's role/behavior", apply: addColonAndSpace },
            { label: "context", type: "keyword", info: "List of additional background information", apply: addColonIndentAndList },
            { label: "goals", type: "keyword", info: "Define the user's goals and variables", apply: addColonIndentAndList },
        ],
        "user.context": [
            { label: "personality", type: "keyword", info: "Path to the personality file" },
        ],
        "user.goals": [
            { label: "function", type: "keyword", info: "Function types: default(), random(), random(n), random(rand), another(), forward()", apply: addColonAndSpace },
            { label: "type", type: "keyword", info: "Variable type (string, int, float)", apply: addColonAndSpace },
            { label: "data", type: "keyword", info: "Data can be a list of values or a range", apply: addColonAndIndent },
        ],
        "user.goals.function": [
            { label: "default", type: "function", apply: addColonAndBrackets, info: "Use all values in the data list" },
            { label: "random", type: "function", apply: addColonAndBrackets, info: "Pick random value(s). Specify count or use random count"},
            { label: "another", type: "function", apply: addColonAndBrackets, info: "Pick different values each time until list is exhausted" },
            { label: "forward", type: "function", apply: addColonAndBrackets, info: "Iterate through values. Can be nested with other variables" },

        ],
        "user.goals.type": [
            { label: "string", type: "value", info: "String type" },
            { label: "float", type: "value", info: "Floating point number type" },
            { label: "int", type: "value", info: "Integer number type" },
        ],
        "user.goals.data": [
            { label: "step", type: "keyword", info: "Step value for numeric ranges", apply: addColonAndSpace },
            { label: "min", type: "keyword", info: "Minimum value for numeric ranges", apply: addColonAndSpace },
            { label: "max", type: "keyword", info: "Maximum value for numeric ranges", apply: addColonAndSpace },
            { label: "any", type: "function", info: "Create a variable with the LLM: any(\"prompt\")", apply: addColonAndBrackets },
        ],
        // Chatbot section
        "chatbot": [
            { label: "is_starter", type: "keyword", info: "Set to True if the chatbot starts the conversation", apply: addColonAndSpace },
            { label: "fallback", type: "keyword", info: "Fallback when the input was not understood", apply: addColonAndSpace },
            { label: "output", type: "keyword", info: "Variables to extract from the conversation", apply: addColonIndentAndList },
        ],
        "chatbot.output": [
            { label: "type", type: "keyword", info: "Types: int, float, money, str, time, date", apply: addColonAndSpace },
            { label: "description", type: "keyword", info: "Description of the variable for LLM extraction", apply: addColonAndSpace },
        ],
        // Conversation section
        "conversation": [
            { label: "number", type: "keyword", info: "Can be: number, sample(0.0 to 1.0), or all_combinations", apply: addColonAndSpace },
            { label: "max_cost", type: "keyword", info: "Maximum cost in dollars of the total execution", apply: addColonAndSpace },
            { label: "goal_style", type: "keyword", info: "Defines how to decide when a conversation is finished", apply: addColonAndIndent },
            { label: "interaction_style", type: "keyword", info: "Conversation behavior modifiers", apply: addColonIndentAndList },
        ],
        "conversation.goal_style": [
            { label: "steps", type: "keyword", info: "Number of steps before conversation ends", apply: addColonAndSpace },
            { label: "random_steps", type: "keyword", info: "Random number of steps between 1 and specified number", apply: addColonAndSpace },
            { label: "all_answered", type: "keyword", info: "Continue until all user goals are met", apply: addColonAndIndent },
            { label: "default", type: "keyword", info: "Default conversation style" },
            { label: "max_cost", type: "keyword", info: "Maximum cost in dollars of the conversation", apply: addColonAndSpace },
        ],
        "conversation.goal_style.all_answered": [
            { label: "limit", type: "keyword", info: "Maximum number of steps before the conversation ends", apply: addColonAndSpace },
        ],
        "conversation.interaction_style": [
            { label: "long phrase", type: "value", info: "Use longer phrases" },
            { label: "change your mind", type: "value", info: "Change opinions during conversation" },
            { label: "change language", type: "value", info: "Change language during conversation (provide list)", apply: addColonIndentAndList },
            { label: "make spelling mistakes", type: "value", info: "Introduce spelling errors" },
            { label: "single question", type: "value", info: "Ask only one question at a time" },
            { label: "all questions", type: "value", info: "Ask all questions at once" },
            { label: "default", type: "value", info: "Default conversation style without modifications" },
            { label: "random", type: "keyword", info: "Select a random interaction style from a list", apply: addColonIndentAndList },
        ],
        "conversation.interaction_style.random": [
            { label: "long phrase", type: "value", info: "Use longer phrases" },
            { label: "change your mind", type: "value", info: "Change opinions during conversation" },
            { label: "change language", type: "value", info: "Change language during conversation (provide list)", apply: addColonIndentAndList },
            { label: "make spelling mistakes", type: "value", info: "Introduce spelling errors" },
            { label: "single question", type: "value", info: "Ask only one question at a time" },
            { label: "all questions", type: "value", info: "Ask all questions at once" },
            { label: "default", type: "value", info: "Default conversation style without modifications" },
        ],
        "conversation.interaction_style.change language": [
            { label: "english", type: "value", info: "English language" },
            { label: "spanish", type: "value", info: "Spanish language" },
            { label: "french", type: "value", info: "French language" },
            { label: "german", type: "value", info: "German language" },
            { label: "italian", type: "value", info: "Italian language" },
            { label: "portuguese", type: "value", info: "Portuguese language" },
            { label: "chinese", type: "value", info: "Chinese language" },
            { label: "japanese", type: "value", info: "Japanese language" },
        ],
    };

    // Function to get the current context of the cursor
    function getCursorContext(doc, pos) {
        // Get all text up to cursor position
        const textUpToCursor = doc.sliceString(0, pos);
        const lines = textUpToCursor.split('\n');

        // Get current line details
        const currentLine = lines[lines.length - 1];
        const currentLineIndent = currentLine.match(/^\s*/)[0].length;
        const currentLineContent = currentLine.trim();

        // Check if we're typing after a colon on the current line
        const colonMatch = currentLineContent.match(/^([^:]+):\s*$/);
        if (colonMatch) {
            // We're right after a colon, use this as part of the context
            const currentKey = colonMatch[1].trim();
            const parentContext = getParentContext(lines.slice(0, -1), currentLineIndent);
            return parentContext ? `${parentContext}.${currentKey}` : currentKey;
        }

        // Support both '-' and '*' as list markers
        const isListItem = /^[-*]\s/.test(currentLineContent);

        // Build a hierarchy of parent keys from previous lines
        let contextPath = getParentContext(lines.slice(0, -1), currentLineIndent);

        // If we're in a list item, process the current line
        if (isListItem) {
            const inlineMatch = currentLineContent.match(/^[-*]\s*([^:]+):\s*$/);
            if (inlineMatch) {
                const inlineKey = inlineMatch[1].trim();
                contextPath = contextPath ? `${contextPath}.${inlineKey}` : inlineKey;
            }
        }

        return contextPath;
    }

    // Helper function to get the parent context
    function getParentContext(lines, currentIndent) {
        let contextPath = [];
        let currentIndentLevel = currentIndent;

        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (line.trim() === "") continue;
            const lineIndent = line.match(/^\s*/)[0].length;
            const lineContent = line.trim();
            if (lineContent.startsWith('#')) continue;

            // Check for list items
            const isLineListItem = /^[-*]\s/.test(lineContent);
            if (isLineListItem && lineIndent <= currentIndentLevel) continue;

            // Process regular key-value pairs
            const keyMatch = lineContent.match(/^([^:]+):/);
            if (keyMatch && lineIndent < currentIndentLevel) {
                const key = keyMatch[1].trim();
                contextPath.unshift(key);
                currentIndentLevel = lineIndent;
            }
        }

        return contextPath.join('.');
    }



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
            if (fileId) {
                // Update existing file
                const response = await updateFile(fileId, editorContent);
                showToast('success', response.message || 'File updated successfully');
            } else {
                // Create new file
                if (!selectedProject) {
                    showToast('error', 'Please select a project first');
                    return;
                }
                const response = await createFile(editorContent, selectedProject.id);
                if (response.uploaded_file_ids && response.uploaded_file_ids.length > 0) {
                    // Get the first file ID since we are only uploading one
                    const newFileId = response.uploaded_file_ids[0];
                    showToast('success', 'File created successfully');
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
