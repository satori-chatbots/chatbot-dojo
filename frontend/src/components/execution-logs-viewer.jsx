import React, { useState, useEffect, useCallback } from "react";
import {
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  Card,
  CardBody,
  Tabs,
  Tab,
  Chip,
} from "@heroui/react";
import { Terminal, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import { fetchTracerExecutionLogs } from "../api/file-api";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { getErrorTypeInfo } from "../utils/error-types";

const LogContent = React.memo(({ content, variant }) => {
  // Memoise log lines to avoid re-splitting on every render
  const lines = React.useMemo(
    () => (content ? content.split("\n") : []),
    [content],
  );
  const upperType = variant?.toUpperCase?.();

  if (!content || content.trim() === "") {
    return (
      <div className="text-center py-8 text-default-500">
        <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No {variant} output available</p>
      </div>
    );
  }

  const isError = upperType === "STDERR";
  const consoleStyle = isError
    ? "bg-gray-900 border-red-500/30"
    : "bg-gray-900 border-green-500/30";
  const textStyle = isError ? "text-red-400" : "text-green-400";
  const headerTitle = isError ? "Error Output" : "Standard Output";

  return (
    <div className={`${consoleStyle} rounded-lg border-2 overflow-hidden`}>
      {/* Console header */}
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-gray-400" />
        <span className="text-gray-300 text-sm font-medium">{headerTitle}</span>
        <div className="flex gap-1 ml-auto">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
      </div>

      {/* Console content */}
      <div className="p-4 overflow-auto max-h-96">
        <div className={`${textStyle} text-sm font-mono leading-relaxed`}>
          {lines.map((line, index) => (
            <div key={index} className="flex">
              <span className="text-gray-500 select-none mr-4 text-xs w-10 text-right">
                {String(index + 1).padStart(3, " ")}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-words">
                {line}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

LogContent.displayName = "LogContent";

const ExecutionLogsViewer = ({ execution, onClose }) => {
  const [logsData, setLogsData] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  const [selectedTab, setSelectedTab] = useState("summary");
  const { showToast } = useMyCustomToast();

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const data = await fetchTracerExecutionLogs(execution.id);
      setLogsData(data);

      // Auto-select stderr tab if execution failed and has stderr content
      if (execution.status === "ERROR" && data.stderr && data.stderr.trim()) {
        setSelectedTab("stderr");
      } else if (data.stdout && data.stdout.trim()) {
        setSelectedTab("stdout");
      }
    } catch (error) {
      console.error("Error loading TRACER logs:", error);
      setError("Failed to load the execution logs");
      showToast("Failed to load execution logs", "error");
    } finally {
      setLoading(false);
    }
  }, [execution.id, execution.status, showToast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Cache line counts to prevent repeated split operations
  const stdoutLinesCount = React.useMemo(
    () => (logsData?.stdout ? logsData.stdout.split("\n").length : 0),
    [logsData?.stdout],
  );

  const stderrLinesCount = React.useMemo(
    () => (logsData?.stderr ? logsData.stderr.split("\n").length : 0),
    [logsData?.stderr],
  );

  return (
    <>
      <ModalHeader className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-default-100 dark:bg-default-800">
            <Terminal className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">TRACER Execution Logs</h2>
            <p className="text-sm text-default-500">
              {execution.execution_name} -{" "}
              {logsData?.project_name || execution.project_name}
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Spinner size="lg" />
            <p className="text-default-500">Loading execution logs...</p>
          </div>
        ) : error ? (
          <Card className="border-danger-200 bg-danger-50 dark:bg-danger-900/20">
            <CardBody className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-danger mb-2">
                Error Loading Logs
              </h3>
              <p className="text-danger-600 dark:text-danger-400">{error}</p>
              <Button
                color="danger"
                variant="flat"
                className="mt-4"
                onPress={loadLogs}
              >
                Try Again
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Error Summary Section */}
            {execution.status === "FAILURE" && logsData?.error_type && (
              <Card className="border-danger-200 bg-danger-50 dark:bg-danger-900/20">
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-semibold text-danger">
                          Execution Failed
                        </h4>
                        <Chip color="danger" variant="flat" size="sm">
                          {getErrorTypeInfo(logsData.error_type).name}
                        </Chip>
                      </div>
                      <p className="text-danger-700 dark:text-danger-300 mb-2">
                        {getErrorTypeInfo(logsData.error_type).description}
                      </p>
                      {logsData.error_message && (
                        <p className="text-sm text-danger-600 dark:text-danger-400 bg-danger-100 dark:bg-danger-800 p-3 rounded-md">
                          {logsData.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Logs Tabs */}
            <Card className="border-default-200">
              <CardBody className="p-0">
                <Tabs
                  selectedKey={selectedTab}
                  onSelectionChange={setSelectedTab}
                  className="w-full"
                >
                  <Tab
                    key="summary"
                    title={
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Summary
                      </div>
                    }
                  >
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-default-600 mb-1">
                            Status
                          </h4>
                          <Chip
                            color={
                              execution.status === "SUCCESS"
                                ? "success"
                                : execution.status === "FAILURE"
                                  ? "danger"
                                  : "default"
                            }
                            variant="flat"
                          >
                            {execution.status}
                          </Chip>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-default-600 mb-1">
                            Project
                          </h4>
                          <p className="text-sm text-foreground">
                            {logsData?.project_name || execution.project_name}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium text-default-600 mb-1">
                            Standard Output
                          </h4>
                          <p className="text-default-500">
                            {stdoutLinesCount > 0
                              ? `${stdoutLinesCount} lines`
                              : "No output"}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium text-default-600 mb-1">
                            Error Output
                          </h4>
                          <p className="text-default-500">
                            {stderrLinesCount > 0
                              ? `${stderrLinesCount} lines`
                              : "No errors"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Tab>

                  <Tab
                    key="stdout"
                    title={
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4" />
                        Output
                        {stdoutLinesCount > 0 && (
                          <span className="text-xs bg-default-200 dark:bg-default-700 px-1.5 py-0.5 rounded">
                            {stdoutLinesCount}
                          </span>
                        )}
                      </div>
                    }
                  >
                    <LogContent content={logsData?.stdout} variant="stdout" />
                  </Tab>

                  <Tab
                    key="stderr"
                    title={
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Errors
                        {stderrLinesCount > 0 && (
                          <span className="text-xs bg-danger-200 dark:bg-danger-700 px-1.5 py-0.5 rounded">
                            {stderrLinesCount}
                          </span>
                        )}
                      </div>
                    }
                  >
                    <LogContent content={logsData?.stderr} variant="stderr" />
                  </Tab>
                </Tabs>
              </CardBody>
            </Card>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button color="primary" variant="light" onPress={onClose}>
          <ArrowLeft className="w-4 h-4" />
          Close
        </Button>
      </ModalFooter>
    </>
  );
};

export default React.memo(ExecutionLogsViewer);
