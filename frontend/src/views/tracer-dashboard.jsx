import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardBody,
  Button,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  useDisclosure,
  Spinner,
  Chip,
} from "@heroui/react";
import { FixedSizeList as List } from "react-window";
import {
  BarChart3,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader,
} from "lucide-react";
import {
  fetchTracerExecutions,
  deleteProfileExecution,
  checkTracerGenerationStatus,
} from "../api/file-api";
import TracerExecutionCard from "../components/tracer-execution-card";
import InlineReportViewer from "../components/inline-report-viewer";
import InlineGraphViewer from "../components/inline-graph-viewer";
import OriginalProfilesViewer from "../components/original-profiles-viewer";
import ExecutionLogsViewer from "../components/execution-logs-viewer";
import SetupProgress from "../components/setup-progress";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { useAuth } from "../contexts/auth-context";

// Move getStatusColor to outer scope
const getStatusColor = (status) => {
  switch (status) {
    case "SUCCESS": {
      return "success";
    }
    case "RUNNING": {
      return "primary";
    }
    case "FAILURE": {
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

const TracerDashboard = () => {
  const [executions, setExecutions] = useState([]);
  const [filteredExecutions, setFilteredExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [uniqueProjects, setUniqueProjects] = useState([]);
  const [viewingContent, setViewingContent] = useState();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { showToast } = useMyCustomToast();
  const { user } = useAuth();

  // Public view state - true when user is not authenticated
  const [publicView] = useState(!user);

  // Progress polling state
  const [pollingIntervals, setPollingIntervals] = useState(new Map());

  // Clear the modal content once the modal has been closed to avoid leftover overlays
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setViewingContent(undefined), 300);
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
      // Only poll if authenticated and execution is running
      if (!user || !execution.id || execution.status !== "RUNNING") return;

      // Check if we're already polling this execution
      if (pollingIntervals.has(execution.id)) return;

      // Get the Celery task ID directly from the execution object
      if (!execution.celery_task_id) {
        return;
      }

      const celeryTaskId = execution.celery_task_id;

      const intervalId = setInterval(async () => {
        try {
          const status = await checkTracerGenerationStatus(celeryTaskId);

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
          if (status.status === "SUCCESS" || status.status === "FAILURE") {
            clearInterval(intervalId);
            setPollingIntervals((prev) => {
              const newMap = new Map(prev);
              newMap.delete(execution.id);
              return newMap;
            });

            if (status.status === "SUCCESS") {
              showToast("success", "TRACER execution succeeded!");
            } else if (status.status === "FAILURE") {
              const errorMessage =
                status.error_message ||
                "Unknown error occurred during execution";
              showToast("error", "TRACER execution failed: " + errorMessage);
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
    },
    [pollingIntervals, showToast, user],
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

      // Start polling for any running executions (only for authenticated users)
      if (user && data.executions) {
        for (const execution of data.executions) {
          if (execution.status === "RUNNING") {
            startPollingExecution(execution);
          }
        }
      }
    } catch (error) {
      console.error("Error loading TRACER executions:", error);
      showToast("error", "Error loading TRACER executions");
    } finally {
      setLoading(false);
    }
  }, [startPollingExecution, showToast, user]);

  useEffect(() => {
    loadTracerExecutions();
  }, [loadTracerExecutions]);

  useEffect(() => {
    // Apply filters when executions or filter criteria change
    let filtered = executions;

    if (selectedProject !== "all") {
      filtered = filtered.filter(
        (execution) =>
          execution.project_id === Number.parseInt(selectedProject),
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
      case "SUCCESS": {
        return <CheckCircle className="w-4 h-4 text-success" />;
      }
      case "RUNNING": {
        return <Loader className="w-4 h-4 text-primary animate-spin" />;
      }
      case "FAILURE": {
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

  // Handler for deleting a TRACER execution (only for authenticated users)
  const handleDeleteExecution = useCallback(
    async (execution) => {
      if (!user || !execution?.id) return;

      if (
        !globalThis.confirm(
          "Delete TRACER execution? This action cannot be undone.",
        )
      ) {
        return;
      }

      try {
        const response = await deleteProfileExecution(execution.id);
        showToast("success", response.message || "Execution deleted");
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
        showToast("error", errorMessage);
      }
    },
    [showToast, loadTracerExecutions, user],
  );

  const renderModalContent = () => {
    if (!viewingContent) return;

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
        return;
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
          onDelete={publicView ? undefined : handleDeleteExecution} // Hide delete in public view
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <Spinner size="lg" />
        <p className="text-default-500 text-center">
          Loading TRACER executions...
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 flex flex-col space-y-4 sm:space-y-6 max-w-full 2xl:max-w-7xl mx-auto">
      {/* Setup Progress - only show for authenticated users */}
      {!publicView && (
        <div className="w-full max-w-4xl mx-auto">
          <SetupProgress isCompact={true} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-tight">
          {publicView ? "Public TRACER Dashboard" : "TRACER Dashboard"}
        </h1>
      </div>

      {/* Filters */}
      <Card className="border-default-200">
        <CardBody className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            {/* Projects selector */}
            <div className="w-full lg:flex-1 lg:min-w-[280px] lg:max-w-[320px]">
              <Select
                label={
                  publicView ? "Filter Public Projects" : "Filter Projects"
                }
                placeholder={
                  publicView ? "All Public Projects" : "All Projects"
                }
                size="md"
                selectedKeys={
                  selectedProject === "all" ? [] : [selectedProject]
                }
                onSelectionChange={(keys) => {
                  const selected = [...keys][0];
                  setSelectedProject(selected || "all");
                }}
                className="w-full"
                classNames={{
                  base: "w-full",
                  mainWrapper: "w-full",
                  trigger:
                    "w-full h-12 bg-default-50/50 border-1 border-default-200 hover:border-default-300 data-[focus=true]:border-primary transition-colors",
                }}
              >
                <SelectItem key="all" value="all" className="text-primary">
                  {publicView ? "All Public Projects" : "All Projects"}
                </SelectItem>
                {uniqueProjects.map((project) => (
                  <SelectItem
                    key={project.id.toString()}
                    value={project.id.toString()}
                    textValue={project.name}
                  >
                    <div className="flex justify-between items-center">
                      <span>{project.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </Select>
            </div>

            {/* Status selector */}
            <div className="w-full lg:flex-1 lg:min-w-[200px] lg:max-w-[240px]">
              <Select
                label="Filter by Status"
                placeholder="All Statuses"
                size="md"
                selectedKeys={selectedStatus === "all" ? [] : [selectedStatus]}
                onSelectionChange={(keys) => {
                  const selected = [...keys][0];
                  setSelectedStatus(selected || "all");
                }}
                className="w-full"
                classNames={{
                  base: "w-full",
                  mainWrapper: "w-full",
                  trigger:
                    "w-full h-12 bg-default-50/50 border-1 border-default-200 hover:border-default-300 data-[focus=true]:border-primary transition-colors",
                }}
                renderValue={() => {
                  const statusColorMap = {
                    SUCCESS: "success",
                    RUNNING: "primary",
                    FAILURE: "danger",
                    PENDING: "warning",
                  };
                  return (
                    <div className="flex items-center gap-2">
                      {selectedStatus === "all" ? (
                        "All Statuses"
                      ) : (
                        <div className="flex items-center gap-2">
                          <Chip
                            color={statusColorMap[selectedStatus]}
                            size="sm"
                            variant="flat"
                          >
                            {selectedStatus}
                          </Chip>
                        </div>
                      )}
                    </div>
                  );
                }}
              >
                <SelectItem key="all" value="all" className="text-primary">
                  All Statuses
                </SelectItem>
                <SelectItem key="SUCCESS" value="SUCCESS">
                  <div className="flex items-center gap-2">
                    <Chip color="success" size="sm" variant="flat">
                      Success
                    </Chip>
                  </div>
                </SelectItem>
                <SelectItem key="RUNNING" value="RUNNING">
                  <div className="flex items-center gap-2">
                    <Chip color="primary" size="sm" variant="flat">
                      Running
                    </Chip>
                  </div>
                </SelectItem>
                <SelectItem key="FAILURE" value="FAILURE">
                  <div className="flex items-center gap-2">
                    <Chip color="danger" size="sm" variant="flat">
                      Failure
                    </Chip>
                  </div>
                </SelectItem>
                <SelectItem key="PENDING" value="PENDING">
                  <div className="flex items-center gap-2">
                    <Chip color="warning" size="sm" variant="flat">
                      Pending
                    </Chip>
                  </div>
                </SelectItem>
              </Select>
            </div>

            {/* Refresh button */}
            <div className="w-full lg:w-auto lg:flex-shrink-0">
              <Button
                color="primary"
                size="md"
                onPress={loadTracerExecutions}
                isLoading={loading}
                className="w-full lg:w-auto h-12 px-8 font-medium"
                radius="md"
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Executions List */}
      {filteredExecutions.length === 0 ? (
        <Card className="border-default-200">
          <CardBody className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-default-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-default-600 mb-2">
              No TRACER Executions Found
            </h3>
            <p className="text-default-500">
              {executions.length === 0
                ? publicView
                  ? "No public TRACER executions are available."
                  : "No TRACER executions have been created yet."
                : "No executions match the current filters."}
            </p>
          </CardBody>
        </Card>
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
              onDelete={publicView ? undefined : handleDeleteExecution} // Hide delete in public view
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
