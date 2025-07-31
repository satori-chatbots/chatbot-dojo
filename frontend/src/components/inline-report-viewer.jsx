import React, { useState, useEffect, useCallback } from "react";
import {
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  Card,
  CardBody,
} from "@heroui/react";
import { FileText, ArrowLeft, AlertCircle } from "lucide-react";
import { fetchTracerAnalysisReport } from "../api/file-api";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

// Simple markdown renderer for the report content
const renderMarkdown = (text) => {
  // Split text into lines for better processing
  const lines = text.split("\n");
  let html = "";
  let inList = false;
  let listItems = [];

  for (const line of lines) {
    let processedLine = line;

    // Handle headers (process from most specific to least specific)
    if (/^#### (.*)$/.test(line)) {
      // Close any open list
      if (inList) {
        html += `<ul class="list-none space-y-1 my-4">${listItems.join("")}</ul>`;
        listItems = [];
        inList = false;
      }
      processedLine = line.replace(
        /^#### (.*)$/,
        '<h4 class="text-base font-semibold mt-4 mb-2 text-foreground">$1</h4>',
      );
    } else if (/^### (.*)$/.test(line)) {
      // Close any open list
      if (inList) {
        html += `<ul class="list-none space-y-1 my-4">${listItems.join("")}</ul>`;
        listItems = [];
        inList = false;
      }
      processedLine = line.replace(
        /^### (.*)$/,
        '<h3 class="text-lg font-semibold mt-6 mb-3 text-foreground">$1</h3>',
      );
    } else if (/^## (.*)$/.test(line)) {
      // Close any open list
      if (inList) {
        html += `<ul class="list-none space-y-1 my-4">${listItems.join("")}</ul>`;
        listItems = [];
        inList = false;
      }
      processedLine = line.replace(
        /^## (.*)$/,
        '<h2 class="text-xl font-semibold mt-8 mb-4 text-foreground">$1</h2>',
      );
    } else if (/^# (.*)$/.test(line)) {
      // Close any open list
      if (inList) {
        html += `<ul class="list-none space-y-1 my-4">${listItems.join("")}</ul>`;
        listItems = [];
        inList = false;
      }
      processedLine = line.replace(
        /^# (.*)$/,
        '<h1 class="text-2xl font-bold mt-8 mb-6 text-foreground">$1</h1>',
      );
    }
    // Handle list items (both - and • bullets)
    else if (/^[•-] (.*)$/.test(line)) {
      const listContent = line.replace(/^[•-] (.*)$/, "$1");
      listItems.push(`<li class="ml-4 mb-1">• ${listContent}</li>`);
      inList = true;
      processedLine = ""; // Don't add to html yet, we'll add when list is complete
    }
    // Handle numbered lists
    else if (/^\d+\. (.*)$/.test(line)) {
      // Close any bullet list and start numbered list if needed
      if (inList) {
        html += `<ul class="list-none space-y-1 my-4">${listItems.join("")}</ul>`;
        listItems = [];
        inList = false;
      }
      const listContent = line.replace(/^\d+\. (.*)$/, "$1");
      processedLine = `<li class="ml-4 mb-1 list-decimal">${listContent}</li>`;
    }
    // Empty line - close any open list
    else if (line.trim() === "") {
      if (inList) {
        html += `<ul class="list-none space-y-1 my-4">${listItems.join("")}</ul>`;
        listItems = [];
        inList = false;
      }
      processedLine = "<br />";
    }
    // Regular line - close any open list
    else if (inList && !/^[•-] /.test(line)) {
      html += `<ul class="list-none space-y-1 my-4">${listItems.join("")}</ul>`;
      listItems = [];
      inList = false;
    }

    // Add processed line to html if not empty
    if (processedLine) {
      html += processedLine + "\n";
    }
  }

  // Close any remaining open list
  if (inList) {
    html += `<ul class="list-none space-y-1 my-4">${listItems.join("")}</ul>`;
  }

  // Convert bold text
  html = html.replaceAll(
    /\*\*(.*?)\*\*/gim,
    '<strong class="font-semibold">$1</strong>',
  );

  // Convert italic text (but avoid matching ** patterns)
  html = html.replaceAll(
    /(?<!\*)\*([^*]+)\*(?!\*)/gim,
    '<em class="italic">$1</em>',
  );

  // Convert code blocks
  html = html.replaceAll(
    /```([\s\S]*?)```/gim,
    '<pre class="bg-default-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto my-4 font-modern-mono"><code class="text-sm text-default-700 dark:text-gray-100">$1</code></pre>',
  );

  // Convert inline code
  html = html.replaceAll(
    /`([^`]+)`/gim,
    '<code class="bg-default-100 dark:bg-gray-800 text-default-700 dark:text-gray-100 px-2 py-1 rounded text-sm font-modern-mono">$1</code>',
  );

  // Convert tables
  const tableRegex = /\|(.+)\|\n\|[-\s|]+\|\n((\|.+\|\n?)*)/gim;
  html = html.replaceAll(tableRegex, (match, header, body) => {
    const headerCells = header
      .split("|")
      .filter((cell) => cell.trim())
      .map(
        (cell) =>
          `<th class="px-3 py-2 text-left font-semibold border-b border-default-200">${cell.trim()}</th>`,
      )
      .join("");

    const bodyRows = body
      .trim()
      .split("\n")
      .map((row) => {
        const cells = row
          .split("|")
          .filter((cell) => cell.trim())
          .map(
            (cell) =>
              `<td class="px-3 py-2 border-b border-default-100">${cell.trim()}</td>`,
          )
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    return `<table class="w-full my-4 border-collapse"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  // Convert horizontal rules
  html = html.replaceAll(/^---$/gm, '<hr class="my-6 border-default-200" />');

  // Clean up multiple consecutive <br /> tags
  html = html.replaceAll(/(<br \/>\s*){3,}/g, "<br /><br />");

  return html;
};

const MarkdownRenderer = ({ content }) => {
  return (
    <div
      className="prose prose-sm max-w-none text-foreground"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
};

const InlineReportViewer = ({ execution, onClose }) => {
  const [reportData, setReportData] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  const { showToast } = useMyCustomToast();

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const data = await fetchTracerAnalysisReport(execution.id);
      setReportData(data);
    } catch (error) {
      console.error("Error loading TRACER report:", error);
      setError("Failed to load the analysis report");
      showToast("Failed to load analysis report", "error");
    } finally {
      setLoading(false);
    }
  }, [execution.id, showToast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <>
      <ModalHeader className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">TRACER Analysis Report</h2>
            <p className="text-sm text-default-500">
              {execution.execution_name} -{" "}
              {reportData?.project_name || execution.project_name}
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner size="lg" />
            <p className="text-default-500">Loading analysis report...</p>
          </div>
        )}

        {error && (
          <Card className="border-danger-200 bg-danger-50 dark:bg-danger-900/20">
            <CardBody className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-danger mb-2">
                Failed to Load Report
              </h3>
              <p className="text-danger-600 dark:text-danger-400 mb-4">
                {error}
              </p>
              <Button
                color="danger"
                variant="light"
                onPress={loadReport}
                size="sm"
              >
                Try Again
              </Button>
            </CardBody>
          </Card>
        )}

        {reportData && !loading && !error && (
          <div className="space-y-4">
            <Card className="border-default-200">
              <CardBody>
                <MarkdownRenderer content={reportData.report_content} />
              </CardBody>
            </Card>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          color="primary"
          variant="light"
          startContent={<ArrowLeft className="w-4 h-4" />}
          onPress={onClose}
        >
          Back to Dashboard
        </Button>
      </ModalFooter>
    </>
  );
};

export default InlineReportViewer;
