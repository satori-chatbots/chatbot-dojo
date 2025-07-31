export const customConnectorBasicsSections = {
  "Basic Syntax": {
    items: [
      {
        code: `name: "My Custom Bot"
base_url: "https://api.mychatbot.com"`,
        description:
          "Every connector needs a name and base URL to identify and locate your chatbot API.",
      },
      {
        code: `send_message:
  path: "/chat"
  method: "POST"`,
        description:
          "Define the endpoint path and HTTP method for sending messages to your chatbot.",
      },
      {
        code: `response_path: "response.text"`,
        description:
          "Specify how to extract the bot's reply from the JSON response using dot notation.",
      },
    ],
  },
  "Payload Template": {
    items: [
      {
        code: `payload_template:
  message: "{user_msg}"`,
        description:
          "Use {user_msg} as a placeholder for the user's message in your API payload.",
      },
      {
        code: `payload_template:
  input:
    text: "{user_msg}"
    context: "general"`,
        description:
          "Create nested JSON structures for more complex API requirements.",
      },
    ],
  },
  "Response Path": {
    items: [
      {
        code: `response_path: "message"`,
        description: "Simple path: response[\"message\"]",
      },
      {
        code: `response_path: "data.text"`,
        description: "Nested path: response[\"data\"][\"text\"]",
      },
      {
        code: `response_path: "results.0.content"`,
        description: "Array access: response[\"results\"][0][\"content\"]",
      },
    ],
  },
  "Headers & Authentication": {
    items: [
      {
        code: `headers:
  Authorization: "Bearer your-api-key"
  Content-Type: "application/json"`,
        description:
          "Add custom headers for authentication and content type specification.",
      },
      {
        code: `headers:
  X-API-Key: "your-secret-key"
  User-Agent: "CustomBot/1.0"`,
        description:
          "Include any custom headers required by your chatbot API.",
      },
    ],
  },
};

export const customConnectorDocumentationSections = {
  "Required Fields": {
    items: [
      {
        code: 'name: "My Custom Bot"',
        description: "Friendly name for your chatbot connector (optional but recommended).",
      },
      {
        code: 'base_url: "https://api.mychatbot.com"',
        description: "Base URL of your chatbot API endpoint.",
      },
      {
        code: `send_message:
  path: "/chat"`,
        description: "API endpoint path that will be appended to the base_url.",
      },
      {
        code: `payload_template:
  message: "{user_msg}"`,
        description: "JSON structure defining how to send the user's message to your API.",
      },
      {
        code: 'response_path: "response.text"',
        description: "Dot-separated path to extract the bot's reply from the JSON response.",
      },
    ],
  },
  "Optional Fields": {
    items: [
      {
        code: `send_message:
  method: "POST"`,
        description: "HTTP method (POST, GET, PUT, DELETE). Defaults to POST if not specified.",
      },
      {
        code: `send_message:
  headers:
    Authorization: "Bearer token"
    Content-Type: "application/json"`,
        description: "Custom headers for authentication or API requirements.",
      },
    ],
  },
  "Complete Examples": {
    items: [
      {
        code: `# Simple Echo Bot for Testing
name: "Echo Bot"
base_url: "https://postman-echo.com"
send_message:
  path: "/post"
  method: "POST"
  payload_template:
    message: "{user_msg}"
response_path: "json.message"`,
        description: "Basic configuration for testing your setup with Postman Echo.",
      },
      {
        code: `# Bot with Authentication
name: "Secure Bot"
base_url: "https://api.mychatbot.com"
send_message:
  path: "/chat/send"
  method: "POST"
  headers:
    Authorization: "Bearer your-api-key"
    Content-Type: "application/json"
  payload_template:
    query: "{user_msg}"
    session_id: "user123"
response_path: "response.text"`,
        description: "Configuration with API key authentication and session management.",
      },
      {
        code: `# Complex Nested Response
name: "Advanced Bot"
base_url: "https://api.advancedbot.com"
send_message:
  path: "/v2/chat"
  method: "POST"
  payload_template:
    input:
      text: "{user_msg}"
      context: "general"
response_path: "data.messages.0.content"`,
        description: "Advanced configuration with nested payload and response structures.",
      },
    ],
  },
  "Real-World Example": {
    items: [
      {
        code: `# MillionBot Integration
name: "Ada UAM"
base_url: "https://api.1millionbot.com"
send_message:
  path: "/api/public/messages"
  method: "POST"
  headers:
    Content-Type: "application/json"
    Authorization: "60a3bee2e3987316fed3218f"
  payload_template:
    conversation: "682ce1ce271ce860cffde0fd"
    sender_type: "User"
    sender: "682ce1cefe831160cee700ed"
    bot: "60a3be81f9a6b98f7659a6f9"
    language: "es"
    url: "https://www.uam.es/uam/tecnologias-informacion/servicios-ti/acceso-remoto-red"
    message:
      text: "{user_msg}"
response_path: "response.0.text"`,
        description: "Real example showing integration with MillionBot platform including all required fields.",
      },
    ],
  },
  "Testing Your Configuration": {
    items: [
      {
        code: `from chatbot_connectors.implementations.custom import CustomChatbot

bot = CustomChatbot("your-config.yml")
success, response = bot.execute_with_input("Hello!")
print(response)`,
        description: "Quick way to test your YAML configuration in a Python environment.",
      },
      {
        code: `# Use with ChatbotFactory
from chatbot_connectors.factory import ChatbotFactory

bot = ChatbotFactory.create_chatbot("custom", config_path="your-config.yaml")`,
        description: "Integration with the ChatbotFactory for production use.",
      },
    ],
  },
  "Common Patterns": {
    items: [
      {
        code: `# REST API with JSON
payload_template:
  message: "{user_msg}"
  user_id: "unique_user_id"
  timestamp: "{{current_time}}"`,
        description: "Standard REST API pattern with user identification and timestamps.",
      },
      {
        code: `# GraphQL-style API
payload_template:
  query: "mutation { sendMessage(input: \\"{user_msg}\\") { response } }"`,
        description: "GraphQL mutation pattern for APIs that use GraphQL queries.",
      },
      {
        code: `# Multi-part responses
response_path: "choices.0.message.content"`,
        description: "Common pattern for OpenAI-style APIs with choice arrays.",
      },
    ],
  },
};
