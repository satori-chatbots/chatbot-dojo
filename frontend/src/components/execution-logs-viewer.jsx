import React, { useState, useEffect } from "react";
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
} from "@heroui/react";
import { Terminal, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import { fetchTracerExecutionLogs } from "../api/file-api";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

const LogContent = ({ content, variant }) => {
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
        <span className="text-gray-300 text-sm font-medium">
          {headerTitle}
        </span>
        <div className="flex gap-1 ml-auto">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
      </div>

      {/* Console content */}
      <div className="p-4 overflow-auto max-h-96">
        <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
          <code className={`${textStyle} block`}>
            {content.split("\n").map((line, index) => (
              <div key={index} className="flex">
                <span className="text-gray-500 select-none mr-4 text-xs">
                  {String(index + 1).padStart(3, " ")}
                </span>
                <span className="flex-1">{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

const ExecutionLogsViewer = ({ execution, onClose }) => {
  const [logsData, setLogsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState("summary");
  const { showToast } = useMyCustomToast();

  useEffect(() => {
    loadLogs();
  }, [execution.id]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
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
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-5 h-5 text-success" />;
      case "ERROR":
        return <AlertCircle className="w-5 h-5 text-danger" />;
      default:
        return <Terminal className="w-5 h-5 text-default-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "text-success";
      case "ERROR":
        return "text-danger";
      default:
        return "text-default-500";
    }
  };

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
            {/* Execution Summary */}
            <Card>
              <CardBody className="pb-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Execution Summary</h3>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(logsData?.status)}
                    <span
                      className={`font-medium ${getStatusColor(logsData?.status)}`}
                    >
                      {logsData?.status}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-default-500">Execution Name</p>
                    <p className="font-medium">{logsData?.execution_name}</p>
                  </div>
                  <div>
                    <p className="text-default-500">Created At</p>
                    <p className="font-medium">
                      {logsData?.created_at
                        ? new Date(logsData.created_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-default-500">Log Verbosity</p>
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">
                        {logsData?.verbosity || "normal"}
                      </span>
                      {logsData?.verbosity === "verbose" && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                          -v
                        </span>
                      )}
                      {logsData?.verbosity === "debug" && (
                        <span className="text-xs bg-warning-100 text-warning-700 px-2 py-0.5 rounded">
                          -vv
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Log Tabs */}
            <Tabs
              selectedKey={selectedTab}
              onSelectionChange={setSelectedTab}
              variant="underlined"
              classNames={{
                tabList:
                  "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                cursor: "w-full bg-primary",
                tab: "max-w-fit px-0 h-12",
                tabContent: "group-data-[selected=true]:text-primary",
              }}
            >
              <Tab key="summary" title="Summary">
                <div className="space-y-4 pt-4">
                  {/* Verbosity Level Explanation */}
                  {logsData?.verbosity && (
                    <Card className="border">
                      <CardBody className="p-4">
                        <h4 className="font-semibold mb-2">
                          Log Verbosity Level
                        </h4>
                        <div className="text-sm space-y-2">
                          {logsData.verbosity === "normal" && (
                            <p className="text-default-600">
                              <strong>Normal:</strong> Standard output with
                              basic execution information.
                            </p>
                          )}
                          {logsData.verbosity === "verbose" && (
                            <p className="text-default-600">
                              <strong>Verbose (-v):</strong> Shows conversations
                              and interactions between TRACER and the chatbot,
                              including dialogue content and response analysis.
                            </p>
                          )}
                          {logsData.verbosity === "debug" && (
                            <p className="text-default-600">
                              <strong>Debug (-vv):</strong> Debug mode with
                              detailed technical information, internal
                              operations, API calls, and low-level debugging
                              data.
                            </p>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  )}

                  {logsData?.stdout || logsData?.stderr ? (
                    <div className="space-y-3">
                      <p className="text-default-600">
                        View the detailed output from the TRACER execution using
                        the tabs above.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="border">
                          <CardBody className="text-center p-4">
                            <div className="text-2xl font-bold text-success">
                              {logsData.stdout
                                ? logsData.stdout.split("\n").length
                                : 0}
                            </div>
                            <div className="text-sm text-default-500">
                              STDOUT Lines
                            </div>
                          </CardBody>
                        </Card>
                        <Card className="border">
                          <CardBody className="text-center p-4">
                            <div className="text-2xl font-bold text-danger">
                              {logsData.stderr
                                ? logsData.stderr.split("\n").length
                                : 0}
                            </div>
                            <div className="text-sm text-default-500">
                              STDERR Lines
                            </div>
                          </CardBody>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-default-500">
                      <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">
                        No Logs Available
                      </h3>
                      <p>
                        This execution doesn't have any captured output logs.
                      </p>
                    </div>
                  )}
                </div>
              </Tab>

              <Tab
                key="stdout"
                title={
                  <div className="flex items-center gap-2">
                    <span>STDOUT</span>
                    {logsData?.stdout && (
                      <span className="bg-success text-success-foreground text-xs px-1.5 py-0.5 rounded">
                        {logsData.stdout.split("\n").length}
                      </span>
                    )}
                  </div>
                }
              >
                <div className="pt-4">
                  <LogContent
                    key="stdout-panel"
                    content={logsData?.stdout}
                    variant="STDOUT"
                  />
                </div>
              </Tab>

              <Tab
                key="stderr"
                title={
                  <div className="flex items-center gap-2">
                    <span>STDERR</span>
                    {logsData?.stderr && (
                      <span className="bg-danger text-danger-foreground text-xs px-1.5 py-0.5 rounded">
                        {logsData.stderr.split("\n").length}
                      </span>
                    )}
                  </div>
                }
              >
                <div className="pt-4">
                  <LogContent
                    key="stderr-panel"
                    content={logsData?.stderr}
                    variant="STDERR"
                  />
                </div>
              </Tab>
            </Tabs>
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

export default ExecutionLogsViewer;
