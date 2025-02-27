import { EditorView } from '@uiw/react-codemirror';

export function addColonAndIndent(view, completion, from, to) {
    const line = view.state.doc.lineAt(from);
    const currentIndent = line.text.match(/^\s*/)[0];
    const extraIndent = "  ";
    const newIndent = currentIndent + extraIndent;
    const insertText = `${completion.label}: \n${newIndent}`;
    view.dispatch({
        changes: { from, to, insert: insertText },
        selection: { anchor: from + insertText.length }
    });
}

export function addColonIndentAndList(view, completion, from, to) {
    const line = view.state.doc.lineAt(from);
    const currentIndent = line.text.match(/^\s*/)[0];
    const extraIndent = "  -";
    const newIndent = currentIndent + extraIndent;
    const insertText = `${completion.label}: \n${newIndent} `;
    view.dispatch({
        changes: { from, to, insert: insertText },
        selection: { anchor: from + insertText.length }
    });
}

export function addColonAndQuotes(view, completion, from, to) {
    const insertText = `${completion.label}: ""`;
    view.dispatch({
        changes: { from, to, insert: insertText },
        selection: { anchor: from + insertText.length - 1 }
    });
}

export function addColonAndBrackets(view, completion, from, to) {
    const insertText = `${completion.label}()`;
    view.dispatch({
        changes: { from, to, insert: insertText },
        selection: { anchor: from + insertText.length - 1 }
    });
}

export function addColonAndSpace(view, completion, from, to) {
    const insertText = `${completion.label}: `;
    view.dispatch({
        changes: { from, to, insert: insertText },
        selection: { anchor: from + insertText.length }
    });
}

export const completionsSchema = {
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
    "llm.format.type": [
        { label: "text", type: "value", info: "Text output format" },
        { label: "speech", type: "value", info: "Speech output format" },
    ],
    // User section
    "user": [
        { label: "language", type: "keyword", info: "The language of the user", apply: addColonAndSpace },
        { label: "role", type: "keyword", info: "Define the user's role/behavior", apply: addColonAndSpace },
        { label: "context", type: "keyword", info: "List of additional background information", apply: addColonIndentAndList },
        { label: "goals", type: "keyword", info: "Define the user's goals and variables", apply: addColonIndentAndList },
    ],
    "user.context": [
        { label: "personality", type: "keyword", info: "Path to the personality file", apply: addColonAndSpace },
    ],
    "user.goals": [
        { label: "function", type: "keyword", info: "Function types: default(), random(), random(n), random(rand), another(), forward()", apply: addColonAndSpace },
        { label: "type", type: "keyword", info: "Variable type (string, int, float)", apply: addColonAndSpace },
        { label: "data", type: "keyword", info: "Data can be a list of values or a range", apply: addColonAndIndent },
    ],
    "user.goals.function": [
        { label: "default", type: "function", apply: addColonAndBrackets, info: "Use all values in the data list" },
        { label: "random", type: "function", apply: addColonAndBrackets, info: "Pick random value(s). Specify count or use random count" },
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

export const requiredSchema = {
    // Define required fields
    required: ["test_name", "llm", "user", "conversation"],
    // Define nested required fields
    nested: {
        "llm": ["model", "temperature", "format"],
        "llm.format": ["type"],
        "user": ["language", "role", "context", "goals"],
        "chatbot": ["is_starter", "fallback", "output"],
        "conversation": ["number", "max_cost", "goal_style", "interaction_style"],
    }
};

export function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));

    // Initialize first column and row of the matrix
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    // Fill in the matrix
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,         // deletion
                matrix[i][j - 1] + 1,         // insertion
                matrix[i - 1][j - 1] + cost   // substitution
            );
        }
    }

    return matrix[a.length][b.length];
}


// Function to get similar valid keywords
export function findSimilarKeywords(word) {
    // Don't do it for 3 or less chars
    if (word.length <= 3) return [];

    // Collect all keywords from the schema
    const allKeywords = Object.values(completionsSchema)
        .flat()
        .map(item => item.label);

    // If the word is an exact match with any keyword, return empty array
    // This is because we have both step and steps and they get confused
    if (allKeywords.includes(word)) {
        return [];
    }

    // Find similar keywords (with distance ≤ 2)
    const similarKeywords = allKeywords.filter(keyword => {
        const distance = levenshteinDistance(word, keyword);
        return distance > 0 && distance <= 2;  // Allow up to 2 character differences
    });

    return similarKeywords;
}

export function createYamlTypoLinter() {
    return (view) => {
        const diagnostics = [];
        const text = view.state.doc.toString();
        const lines = text.split('\n');

        lines.forEach((line, lineIndex) => {
            // Check both regular keys and keys in list items
            // Pattern 1: Regular keys - ^\s*([a-zA-Z_][a-zA-Z0-9_]*):
            // Pattern 2: List item keys - ^\s*-\s+([a-zA-Z_][a-zA-Z0-9_]*):
            const regularKeyMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*):/);
            const listItemKeyMatch = line.match(/^\s*-\s+([a-zA-Z_][a-zA-Z0-9_]*):/);

            let key, startPos;

            if (regularKeyMatch) {
                key = regularKeyMatch[1];
                startPos = line.indexOf(key);
            } else if (listItemKeyMatch) {
                key = listItemKeyMatch[1];
                startPos = line.indexOf(key);
            } else {
                return; // No key found in this line
            }

            const from = view.state.doc.line(lineIndex + 1).from + startPos;
            const to = from + key.length;

            const similarKeywords = findSimilarKeywords(key);
            if (similarKeywords.length > 0) {
                diagnostics.push({
                    from,
                    to,
                    severity: "warning",
                    message: `Possible typo: did you mean ${similarKeywords.join(' or ')}?`,
                    actions: similarKeywords.map(keyword => ({
                        name: `Change to '${keyword}'`,
                        apply(view, from, to) {
                            view.dispatch({
                                changes: { from, to, insert: keyword }
                            });
                        }
                    }))
                });
            }
        });

        return diagnostics;
    };
}

// Function to get the current context of the cursor
export function getCursorContext(doc, pos) {
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
export function getParentContext(lines, currentIndent) {
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
