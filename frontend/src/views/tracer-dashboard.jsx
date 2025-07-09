import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Select,
  SelectItem,
  Progress,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
} from "@heroui/react";
import { FixedSizeList as List } from "react-window";
import {
  FileText,
  BarChart3,
  Users,
  Clock,
  Activity,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader,
} from "lucide-react";
import {
  fetchTracerExecutions,
  deleteProfileExecution,
  checkGenerationStatus,
  checkOngoingGeneration,
} from "../api/file-api";
import TracerExecutionCard from "../components/tracer-execution-card";
import InlineReportViewer from "../components/inline-report-viewer";
import InlineGraphViewer from "../components/inline-graph-viewer";
import OriginalProfilesViewer from "../components/original-profiles-viewer";
import ExecutionLogsViewer from "../components/execution-logs-viewer";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

const TracerDashboard = () => {
  const [executions, setExecutions] = useState([]);
  const [filteredExecutions, setFilteredExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [uniqueProjects, setUniqueProjects] = useState([]);
  const [viewingContent, setViewingContent] = useState(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { showToast } = useMyCustomToast();

  // Progress polling state
  const [pollingIntervals, setPollingIntervals] = useState(new Map());

  // Clear the modal content once the modal has been closed to avoid leftover overlays
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setViewingContent(null), 300);
    }
  }, [isOpen]);

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      for (const intervalId of pollingIntervals) {
        clearInterval(intervalId);
      }
    };
  }, [pollingIntervals]);

  // Function to start polling an execution's progress
  const startPollingExecution = useCallback(
    async (execution) => {
      if (!execution.id || execution.status !== "RUNNING") return;

      // Check if we're already polling this execution
      if (pollingIntervals.has(execution.id)) return;

      // We need to find the task ID from the execution
      // For now, we'll check the ongoing generation status for the project
      try {
        const ongoingResponse = await checkOngoingGeneration(
          execution.project_id,
        );

        if (!ongoingResponse.ongoing || !ongoingResponse.task_id) {
          return;
        }

        const taskId = ongoingResponse.task_id;

        const intervalId = setInterval(async () => {
          try {
            const status = await checkGenerationStatus(taskId);

            // Update the execution in our state
            setExecutions((prevExecutions) =>
              prevExecutions.map((exec) => {
                if (exec.id === execution.id) {
                  return {
                    ...exec,
                    status: status.status,
                    progress_stage: status.stage,
                    progress_percentage: status.progress,
                  };
                }
                return exec;
              }),
            );

            // Stop polling if completed or failed
            if (status.status === "COMPLETED" || status.status === "ERROR") {
              clearInterval(intervalId);
              setPollingIntervals((prev) => {
                const newMap = new Map(prev);
                newMap.delete(execution.id);
                return newMap;
              });

              // Reload all executions to get the final state
              setTimeout(() => {
                loadTracerExecutions();
              }, 1000);

              if (status.status === "COMPLETED") {
                showToast(
                  `TRACER execution completed successfully!`,
                  "success",
                );
              } else if (status.status === "ERROR") {
                showToast(
                  `TRACER execution failed: ${status.error_message || "Unknown error"}`,
                  "error",
                );
              }
            }
          } catch (error) {
            console.error(`Error polling execution ${execution.id}:`, error);
            // Stop polling on error
            clearInterval(intervalId);
            setPollingIntervals((prev) => {
              const newMap = new Map(prev);
              newMap.delete(execution.id);
              return newMap;
            });
          }
        }, 2000); // Poll every 2 seconds

        setPollingIntervals((prev) => {
          const newMap = new Map(prev);
          newMap.set(execution.id, intervalId);
          return newMap;
        });
      } catch (error) {
        console.error(
          `Error starting polling for execution ${execution.id}:`,
          error,
        );
      }
    },
    [pollingIntervals, showToast],
  );

  // Function to stop polling an execution
  const stopPollingExecution = useCallback(
    (executionId) => {
      const intervalId = pollingIntervals.get(executionId);
      if (intervalId) {
        clearInterval(intervalId);
        setPollingIntervals((prev) => {
          const newMap = new Map(prev);
          newMap.delete(executionId);
          return newMap;
        });
      }
    },
    [pollingIntervals],
  );

  const loadTracerExecutions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTracerExecutions();
      setExecutions(data.executions || []);

      // Extract unique projects for filtering
      const projects =
        data.executions?.reduce((acc, execution) => {
          const existing = acc.find((p) => p.id === execution.project_id);
          if (!existing) {
            acc.push({
              id: execution.project_id,
              name: execution.project_name,
            });
          }
          return acc;
        }, []) || [];

      setUniqueProjects(projects);

      // Start polling for any running executions
      if (data.executions) for (const execution of data.executions) {
        if (execution.status === "RUNNING") {
          startPollingExecution(execution);
        }
      }
    } catch (error) {
      console.error("Error loading TRACER executions:", error);
      showToast("Error loading TRACER executions", "error");
    } finally {
      setLoading(false);
    }
  }, [startPollingExecution, showToast]);

  useEffect(() => {
    loadTracerExecutions();
  }, [loadTracerExecutions]);

  useEffect(() => {
    // Apply filters when executions or filter criteria change
    let filtered = executions;

    if (selectedProject !== "all") {
      filtered = filtered.filter(
        (execution) => execution.project_id === Number.parseInt(selectedProject),
      );
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter(
        (execution) => execution.status === selectedStatus,
      );
    }

    setFilteredExecutions(filtered);
  }, [executions, selectedProject, selectedStatus]);

  const handleViewReport = (execution) => {
    setViewingContent({
      type: "report",
      execution: execution,
    });
    onOpen();
  };

  const handleViewGraph = (execution) => {
    setViewingContent({
      type: "graph",
      execution: execution,
    });
    onOpen();
  };

  const handleViewProfiles = (execution) => {
    setViewingContent({
      type: "profiles",
      execution: execution,
    });
    onOpen();
  };

  const handleViewLogs = (execution) => {
    setViewingContent({
      type: "logs",
      execution: execution,
    });
    onOpen();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "COMPLETED": {
        return <CheckCircle className="w-4 h-4 text-success" />;
      }
      case "RUNNING": {
        return <Loader className="w-4 h-4 text-primary animate-spin" />;
      }
      case "ERROR": {
        return <AlertCircle className="w-4 h-4 text-danger" />;
      }
      case "PENDING": {
        return <Clock className="w-4 h-4 text-warning" />;
      }
      default: {
        return <Clock className="w-4 h-4 text-default-400" />;
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED": {
        return "success";
      }
      case "RUNNING": {
        return "primary";
      }
      case "ERROR": {
        return "danger";
      }
      case "PENDING": {
        return "warning";
      }
      default: {
        return "default";
      }
    }
  };

  // Handler for deleting a TRACER execution
  const handleDeleteExecution = useCallback(
    async (execution) => {
      if (!execution?.id) return;

      if (
        !globalThis.confirm(
          "Delete TRACER execution? This action cannot be undone.",
        )
      ) {
        return;
      }

      try {
        const response = await deleteProfileExecution(execution.id);
        showToast(response.message || "Execution deleted", "success");
        await loadTracerExecutions();
      } catch (error) {
        console.error("Error deleting TRACER execution:", error);
        let errorMessage = "Error deleting TRACER execution";
        try {
          const errorData = JSON.parse(error.message);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // ignore JSON parse failure
        }
        showToast(errorMessage, "error");
      }
    },
    [showToast],
  );

  const renderModalContent = () => {
    if (!viewingContent) return null;

    switch (viewingContent.type) {
      case "report": {
        return (
          <InlineReportViewer
            execution={viewingContent.execution}
            onClose={() => onOpenChange(false)}
          />
        );
      }
      case "graph": {
        return (
          <InlineGraphViewer
            execution={viewingContent.execution}
            onClose={() => onOpenChange(false)}
          />
        );
      }
      case "profiles": {
        return (
          <OriginalProfilesViewer
            execution={viewingContent.execution}
            onClose={() => onOpenChange(false)}
          />
        );
      }
      case "logs": {
        return (
          <ExecutionLogsViewer
            execution={viewingContent.execution}
            onClose={() => onOpenChange(false)}
          />
        );
      }
      default: {
        return null;
      }
    }
  };

  // Virtualised row renderer for the executions list
  const ExecutionRow = ({ index, style }) => {
    const execution = filteredExecutions[index];
    return (
      <div style={style}>
        <TracerExecutionCard
          key={execution.id}
          execution={execution}
          onViewReport={handleViewReport}
          onViewGraph={handleViewGraph}
          onViewProfiles={handleViewProfiles}
          onViewLogs={handleViewLogs}
          onDelete={handleDeleteExecution}
          getStatusIcon={getStatusIcon}
          getStatusColor={getStatusColor}
          progressStage={execution.progress_stage}
          progressPercentage={execution.progress_percentage}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Spinner size="lg" />
        <p className="text-default-500">Loading TRACER executions...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          TRACER Dashboard
        </h1>
      </div>

      {/* Filters */}
      <Card className="border-default-200">
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <Select
                label="Filter by Project"
                placeholder="All Projects"
                selectedKeys={
                  selectedProject === "all" ? [] : [selectedProject]
                }
                onSelectionChange={(keys) => {
                  const selected = [...keys][0];
                  setSelectedProject(selected || "all");
                }}
                size="sm"
                className="max-w-xs"
              >
                <SelectItem key="all" value="all">
                  All Projects
                </SelectItem>
                {uniqueProjects.map((project) => (
                  <SelectItem
                    key={project.id.toString()}
                    value={project.id.toString()}
                  >
                    {project.name}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div className="flex-1">
              <Select
                label="Filter by Status"
                placeholder="All Statuses"
                selectedKeys={selectedStatus === "all" ? [] : [selectedStatus]}
                onSelectionChange={(keys) => {
                  const selected = [...keys][0];
                  setSelectedStatus(selected || "all");
                }}
                size="sm"
                className="max-w-xs"
              >
                <SelectItem key="all" value="all">
                  All Statuses
                </SelectItem>
                <SelectItem key="COMPLETED" value="COMPLETED">
                  Completed
                </SelectItem>
                <SelectItem key="RUNNING" value="RUNNING">
                  Running
                </SelectItem>
                <SelectItem key="ERROR" value="ERROR">
                  Error
                </SelectItem>
                <SelectItem key="PENDING" value="PENDING">
                  Pending
                </SelectItem>
              </Select>
            </div>

            <div className="flex-1 flex justify-end">
              <Button
                color="primary"
                variant="light"
                onPress={loadTracerExecutions}
                isLoading={loading}
                size="sm"
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Executions List */}
      {filteredExecutions.length === 0 ? (
        <div className="space-y-4">
          <Card className="border-default-200">
            <CardBody className="text-center py-8">
              <BarChart3 className="w-12 h-12 text-default-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-default-600 mb-2">
                No TRACER Executions Found
              </h3>
              <p className="text-default-500">
                {executions.length === 0
                  ? "No TRACER executions have been created yet."
                  : "No executions match the current filters."}
              </p>
            </CardBody>
          </Card>
        </div>
      ) : filteredExecutions.length > 50 ? (
        <List
          height={600} // Adjust list height as needed
          itemCount={filteredExecutions.length}
          itemSize={170} // Approximate collapsed card height
          width="100%"
        >
          {ExecutionRow}
        </List>
      ) : (
        <div className="space-y-4">
          {filteredExecutions.map((execution) => (
            <TracerExecutionCard
              key={execution.id}
              execution={execution}
              onViewReport={handleViewReport}
              onViewGraph={handleViewGraph}
              onViewProfiles={handleViewProfiles}
              onViewLogs={handleViewLogs}
              onDelete={handleDeleteExecution}
              getStatusIcon={getStatusIcon}
              getStatusColor={getStatusColor}
              progressStage={execution.progress_stage}
              progressPercentage={execution.progress_percentage}
            />
          ))}
        </div>
      )}

      {/* Modal for viewing content */}
      {isOpen && (
        <Modal
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          size="5xl"
          scrollBehavior="inside"
          className="max-h-[90vh]"
        >
          <ModalContent>{renderModalContent()}</ModalContent>
        </Modal>
      )}
    </div>
  );
};

export default TracerDashboard;
