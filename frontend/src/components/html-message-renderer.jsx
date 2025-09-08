import React from "react";

// Helper function for creating HTML markup
const createMarkup = (html) => {
  return { __html: html };
};

// Define comprehensive styles for HTML elements to match the agent styling
const getAgentHtmlStyles = () => `
  .agent-html-content * {
    color: inherit !important;
    font-family: inherit !important;
  }

  .agent-html-content a {
    color: rgb(var(--green-800, 6 95 70)) !important; /* fallback to tw-green-800 */
    text-decoration: underline;
    font-weight: 500;
  }

  .dark .agent-html-content a {
    color: rgb(var(--green-400, 52 211 153)) !important; /* fallback to tw-green-400 */
  }

  .agent-html-content strong,
  .agent-html-content b {
    font-weight: 600;
    color: inherit !important;
  }

  .agent-html-content p {
    margin: 0.5rem 0;
    color: inherit !important;
  }

  .agent-html-content p:first-child {
    margin-top: 0;
  }

  .agent-html-content p:last-child {
    margin-bottom: 0;
  }

  .agent-html-content br {
    line-height: 1.5;
  }

  .agent-html-content ul,
  .agent-html-content ol {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    color: inherit !important;
  }

  .agent-html-content li {
    margin: 0.25rem 0;
    color: inherit !important;
  }

  .agent-html-content h1,
  .agent-html-content h2,
  .agent-html-content h3,
  .agent-html-content h4,
  .agent-html-content h5,
  .agent-html-content h6 {
    font-weight: 600;
    color: inherit !important;
    margin: 0.75rem 0 0.5rem 0;
  }

  .agent-html-content h1:first-child,
  .agent-html-content h2:first-child,
  .agent-html-content h3:first-child,
  .agent-html-content h4:first-child,
  .agent-html-content h5:first-child,
  .agent-html-content h6:first-child {
    margin-top: 0;
  }
`;

/**
 * Component to render HTML content with consistent styling for chatbot messages
 * @param {string} htmlContent - The HTML content to render
 * @param {boolean} isAgent - Whether this is an agent message (applies green theme styling)
 * @returns {JSX.Element}
 */
const HTMLMessageRenderer = ({ htmlContent, isAgent = false }) => {
  const agentHtmlStyles = isAgent ? getAgentHtmlStyles() : "";

  return (
    <>
      {isAgent && (
        <style dangerouslySetInnerHTML={{ __html: agentHtmlStyles }} />
      )}
      <div
        className={`mt-1 ${isAgent ? "agent-html-content" : ""}`}
        dangerouslySetInnerHTML={createMarkup(htmlContent)}
      />
    </>
  );
};

/**
 * Utility function to detect if content contains HTML tags
 * @param {string} content - The content to check
 * @returns {boolean}
 */
export const containsHTML = (content) => {
  return (
    content &&
    typeof content === "string" &&
    content.includes("<") &&
    content.includes(">")
  );
};

export default HTMLMessageRenderer;
