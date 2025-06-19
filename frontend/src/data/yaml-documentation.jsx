export const yamlBasicsSections = {
  "Basic Syntax": {
    items: [
      {
        code: `key: value`,
        description:
          "Simple key-value pairs are defined with a colon and space.",
      },
      {
        code: `quoted: "This is a string"
unquoted: This is also a string`,
        description:
          "Strings can be quoted or unquoted. Use quotes for strings with special characters.",
      },
      {
        code: `number: 42
boolean: true
float: 3.14`,
        description: "Numbers, booleans, and floats are automatically typed.",
      },
    ],
  },
  Lists: {
    items: [
      {
        code: `simple_list:
  - item1
  - item2
  - item3`,
        description: "Lists are created using hyphens with proper indentation.",
      },
      {
        code: `nested_list:
  - item1
  - sublist:
    - subitem1
    - subitem2`,
        description:
          "Lists can contain nested elements. Maintain consistent indentation.",
      },
    ],
  },
  "Objects/Maps": {
    items: [
      {
        code: `person:
  name: John
  age: 30
  city: New York`,
        description: "Objects are created using indented key-value pairs.",
      },
      {
        code: `nested_object:
  person:
  name: John
  address:
    street: 123 Main St
    city: New York`,
        description:
          "Objects can be nested using increased indentation for each level.",
      },
    ],
  },
  "Common Practices": {
    items: [
      {
        code: `# This is a comment
key: value # Inline comment`,
        description:
          "Comments start with # and can be on their own line or inline.",
      },
      {
        code: `spaces: 2  # Standard indentation
  not-tabs: true`,
        description:
          "Use spaces for indentation (typically 2 spaces). Do not use tabs.",
      },
      {
        code: `empty: null
  blank_string: ""
  space_string: " "`,
        description: "Different ways to represent empty or null values.",
      },
    ],
  },
  "Multiple Documents": {
    items: [
      {
        code: `---
document: 1
---
document: 2`,
        description:
          "Use three dashes (---) to separate multiple documents in a single file.",
      },
    ],
  },
};

export const documentationSections = {
  "Basic Configuration": {
    items: [
      {
        code: 'test_name: "sample_name"',
        description: "Unique name for the test suite (avoid duplicates).",
      },
    ],
  },
  "LLM Configuration": {
    items: [
      {
        code: "temperature: 0.8",
        description:
          "0.0 (deterministic) to 1.0 (creative). Controls response randomness.",
      },
      {
        code: "model: gpt-4o-mini",
        description: "Choose from OpenAI models available in LangChain.",
      },
      {
        code: "format: { type: text }",
        description:
          "Choose between text or speech mode. For speech, provide config file path.",
      },
    ],
  },
  "User Configuration": {
    items: [
      {
        code: "language: English",
        description:
          "Set the primary conversation language (defaults to English).",
      },
      {
        code: 'role: "Define role here"',
        description:
          "Define the user's role or behavior (e.g., customer ordering food).",
      },
      {
        code: 'context: ["personality: path/to/file.yml", "additional context"]',
        description: "Add personality files and additional context prompts.",
      },
      {
        code: `goals:
- "goal with {{variable_name}}"
- variable_name:
  function: /* see variable functions */
  type: string|int|float
  data: [value1, value2] | { min: 1, max: 6, step: 2 }`,
        description:
          "Define goals with variables. Variables require function, type, and data.",
      },
    ],
  },
  "Variable Structure": {
    items: [
      {
        code: `type: string|int|float`,
        description: "Specify the variable type (string, integer, or float).",
      },
      {
        code: `data:
- value1
- value2
- any(prompt)`,
        description:
          "Manual list of values. Use any() for LLM-generated values.",
      },
      {
        code: `data:
min: 1
max: 6
step: 2`,
        description: "For numeric types: define range with min, max, and step.",
      },
      {
        code: `data:
file: path/to/function.py
function_name: function_name
args: [arg1, arg2]`,
        description: "Use custom functions to generate data lists.",
      },
    ],
  },
  "Variable Functions": {
    items: [
      {
        code: `function: default()`,
        description: "Use all values in the data list.",
      },
      {
        code: `function: forward()
function: forward(other_var)`,
        description:
          "Iterate through values. Can be nested with other variables.",
      },
      {
        code: `function: random()
function: random(5)
function: random(rand)`,
        description: "Pick random value(s). Specify count or use random count.",
      },
      {
        code: "function: another()",
        description: "Pick different values each time until list is exhausted.",
      },
    ],
  },
  "Chatbot Settings": {
    items: [
      {
        code: "is_starter: False",
        description: "Set to True if chatbot initiates conversations.",
      },
      {
        code: 'fallback: "I\'m sorry..."',
        description: "Define chatbot's error message to avoid loops.",
      },
      {
        code: `output:
- variable_name:
  type: string|int|float|money|time|date
  description: "Description for extraction"`,
        description: "Define variables to extract from conversations.",
      },
    ],
  },
  "Conversation Control": {
    items: [
      {
        code: `number: 5 | all_combinations | sample(0.2)`,
        description:
          "Control test volume (specific number, all combinations, or sample percentage).",
      },
      {
        code: "max_cost: 1",
        description: "Set maximum cost in dollars for entire test execution.",
      },
      {
        code: `goal_style:
steps: 5 | random_steps: 35 | all_answered: { limit: 10 }
max_cost: 0.1`,
        description:
          "Define conversation endpoints with optional per-conversation cost limit.",
      },
      {
        code: `interaction_style:
- random:
  - make spelling mistakes
  - all questions
  - change language: [italian, portuguese]`,
        description:
          "Set conversation behaviors. Use random to combine multiple styles.",
      },
    ],
  },
};
