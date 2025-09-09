import React, { useState, useEffect, useCallback } from "react";
import useFetchProjects from "../hooks/use-fetch-projects";
import { fetchTestErrorsByGlobalReports } from "../api/test-errors-api";
import { fetchGlobalReportsByTestCases } from "../api/reports-api";
import { MEDIA_URL } from "../api/config";
import {
  Button,
  Chip,
  Form,
  Select,
  SelectItem,
  Spinner,
  Pagination,
  Input,
  Card,
  CardBody,
} from "@heroui/react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import {
  fetchTestCasesByProjects,
  checkSENSEIExecutionStatus,
} from "../api/test-cases-api";
import { Accordion, AccordionItem } from "@heroui/react";
import { Link } from "@heroui/react";
import { useMemo } from "react";
import { stopTestExecution } from "../api/test-cases-api";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { deleteTestCase } from "../api/test-cases-api";
import useSelectedProject from "../hooks/use-selected-projects";
import { useAuth } from "../contexts/auth-context";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { Eye, Search, Trash, XCircle, Activity } from "lucide-react";
import { fetchPaginatedTestCases } from "../api/test-cases-api";
import { getProviderDisplayName } from "../constants/providers";
import { formatExecutionTime as sharedFormatExecutionTime } from "../utils/time-utils";
import SetupProgress from "../components/setup-progress";

const statusOptions = [
  { label: "All", value: "ALL" },
  { label: "Success", value: "SUCCESS" },
  { label: "Running", value: "RUNNING" },
  { label: "Failure", value: "FAILURE" },
  { label: "Stopped", value: "STOPPED" },
];

const formatExecutionTime = (seconds, status) => {
  if (status === "STOPPED") {
    return "Stopped";
  }
  if (seconds === null) {
    return "Running";
  }
  return sharedFormatExecutionTime(seconds);
};

const formatCost = (cost, status) => {
  if (status === "STOPPED") {
    return "Stopped";
  }
  return `$${Number.parseFloat(cost || 0).toFixed(5)}`;
};

function Dashboard() {
  const { showToast } = useMyCustomToast();

  // Initialize testCases state as empty
  const [testCases, setTestCases] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage] = useState(10);

  const [searchTerm, setSearchTerm] = useState("");

  const [sortDescriptor, setSortDescriptor] = useState({
    column: "executed_at",
    direction: "descending",
  });

  // Selected Projects State
  const [selectedProject, setSelectedProject] = useSelectedProject();
  const [selectedProjects, setSelectedProjects] = useState([]);

  // State for initial auto-fetching of test cases
  const [initialAutoFetchDone, setInitialAutoFetchDone] = useState(false);

  // Modal for deleting a test case
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    testCaseId: undefined,
  });

  const { user } = useAuth();
  const [publicView] = useState(!user);

  const { projects, loadingProjects, errorProjects } = useFetchProjects("all");

  const statusColorMap = {
    SUCCESS: "success",
    FAILURE: "danger",
    RUNNING: "warning",
    STOPPED: "default",
  };

  // Interval for refreshing the projects
  const POLLING_INTERVAL = 2500;

  // Erros of Global Reports
  const [errors, setErrors] = useState([]);

  // Error count for each Global Report
  const [errorCounts, setErrorCounts] = useState({});

  // Global Reports of Test Cases
  const [globalReports, setGlobalReports] = useState([]);

  const derivedTestCases = useMemo(() => {
    return testCases.map((tc) => {
      const displayName = tc.name || "Unnamed Test Case";
      const report = globalReports.find((r) => r.test_case === tc.id);
      const numberErrors = report ? errorCounts[report.id] || 0 : 0;
      const testCaseErrors = errors.filter(
        (error_) => error_.global_report === report?.id,
      );
      const totalCost = Number.parseFloat(report?.total_cost || 0).toFixed(5);
      return {
        ...tc,
        displayName,
        num_errors: numberErrors,
        testCaseErrors,
        total_cost: totalCost,
      };
    });
  }, [testCases, globalReports, errorCounts, errors]);

  const sortedTestCases = useMemo(() => derivedTestCases, [derivedTestCases]);

  const fetchPagedTestCases = useCallback(
    async (pageNumber, sortColumn, sortDirection) => {
      try {
        setLoading(true);
        const data = await fetchPaginatedTestCases({
          page: pageNumber,
          per_page: rowsPerPage,
          sort_column: sortColumn || sortDescriptor.column,
          sort_direction: sortDirection || sortDescriptor.direction,
          project_ids: selectedProjects.join(","),
          status: selectedStatus === "ALL" ? "" : selectedStatus,
          search: searchTerm,
        });
        const newTestCases = data.items;
        setTestCases(newTestCases);
        setTotalPages(Math.ceil(data.total / rowsPerPage));

        const testCaseIds = newTestCases.map((tc) => tc.id);
        if (testCaseIds.length > 0) {
          const fetchedReports =
            await fetchGlobalReportsByTestCases(testCaseIds);
          setGlobalReports(fetchedReports);

          const globalReportIds = fetchedReports.map((r) => r.id);
          if (globalReportIds.length > 0) {
            const fetchedErrors =
              await fetchTestErrorsByGlobalReports(globalReportIds);
            setErrors(fetchedErrors);

            const updatedErrorCounts = {};
            for (const error of fetchedErrors) {
              if (updatedErrorCounts[error.global_report]) {
                updatedErrorCounts[error.global_report] += error.count;
              } else {
                updatedErrorCounts[error.global_report] = error.count;
              }
            }
            setErrorCounts(updatedErrorCounts);
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching test cases:", error);
        setLoading(false);
      }
    },
    [
      rowsPerPage,
      sortDescriptor.column,
      sortDescriptor.direction,
      selectedProjects,
      selectedStatus,
      searchTerm,
    ],
  );

  const handleFilterProjects = useCallback(async () => {
    if (selectedProjects.length === 0) {
      return;
    }

    try {
      setLoading(true);
      await fetchPagedTestCases(1);
      setPage(1);
    } catch (error_) {
      console.error("Error filtering projects:", error_);
      showToast("error", "Failed to filter projects");
    } finally {
      setLoading(false);
    }
  }, [fetchPagedTestCases, selectedProjects.length, showToast]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (selectedProjects.length > 0) {
        // When searching go back to the first page
        fetchPagedTestCases(1);
        setPage(1);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedProjects.length, fetchPagedTestCases]);

  // Polling for running test cases
  useEffect(() => {
    let pollingInterval;

    const pollRunningTestCases = async () => {
      // Only poll if there are running test cases
      const runningTestCases = testCases.filter(
        (tc) => tc.status === "RUNNING",
      );
      if (runningTestCases.length > 0) {
        try {
          // Separate test cases by whether they have Celery task IDs
          const testCasesWithTaskIds = runningTestCases.filter(
            (tc) => tc.celery_task_id,
          );
          const testCasesWithoutTaskIds = runningTestCases.filter(
            (tc) => !tc.celery_task_id,
          );

          // Poll Celery task status for test cases with task IDs
          if (testCasesWithTaskIds.length > 0) {
            const taskStatusPromises = testCasesWithTaskIds.map(async (tc) => {
              try {
                console.log(
                  `Polling task status for test case ${tc.id}, task ID: ${tc.celery_task_id}`,
                );
                const taskStatus = await checkSENSEIExecutionStatus(
                  tc.celery_task_id,
                );
                console.log(`Task status for ${tc.id}:`, taskStatus);
                return {
                  id: tc.id,
                  taskStatus,
                  originalTestCase: tc,
                };
              } catch (error) {
                console.error(
                  `Error polling task status for test case ${tc.id}:`,
                  error,
                );
                // Return a fallback result to trigger database polling for this test case
                return {
                  id: tc.id,
                  taskStatus: undefined,
                  originalTestCase: tc,
                  pollError: true,
                };
              }
            });

            const taskStatusResults = await Promise.all(taskStatusPromises);

            // Update test cases with Celery task progress
            setTestCases((previousTestCases) => {
              return previousTestCases.map((tc) => {
                const result = taskStatusResults.find(
                  (r) => r && r.id === tc.id,
                );
                if (result) {
                  // If there was a polling error or no task status, fall back to database polling for this test case
                  if (result.pollError || !result.taskStatus) {
                    // Trigger individual database poll for this test case
                    console.log(
                      `Polling error for test case ${tc.id}, will use database status`,
                    );
                    return tc; // Keep existing state for now, individual polling will handle updates
                  }

                  // Calculate conversation-based progress if available
                  let calculatedProgress = result.taskStatus.progress || 0;
                  if (
                    result.taskStatus.total_conversations > 0 &&
                    result.taskStatus.executed_conversations >= 0
                  ) {
                    calculatedProgress = Math.round(
                      (result.taskStatus.executed_conversations /
                        result.taskStatus.total_conversations) *
                        100,
                    );
                  }

                  // Use task status if available, otherwise fall back to database status
                  const unifiedStatus =
                    result.taskStatus.test_case_status ||
                    result.taskStatus.status ||
                    tc.status;

                  return {
                    ...tc,
                    // Update with task status info
                    progress_stage: result.taskStatus.stage,
                    progress_percentage: calculatedProgress,
                    executed_conversations:
                      result.taskStatus.executed_conversations ||
                      tc.executed_conversations,
                    total_conversations:
                      result.taskStatus.total_conversations ||
                      tc.total_conversations,
                    // Use unified status
                    status: unifiedStatus,
                    // Store error message if task failed
                    error_message:
                      result.taskStatus.error_message || tc.error_message,
                  };
                }
                return tc;
              });
            });

            // Check if any tasks completed and refresh data for those
            const completedTaskResults = taskStatusResults.filter((r) => {
              if (!r || !r.taskStatus) return false;
              const unifiedStatus =
                r.taskStatus.test_case_status || r.taskStatus.status;
              return unifiedStatus === "SUCCESS" || unifiedStatus === "FAILURE";
            });

            if (completedTaskResults.length > 0) {
              console.log(
                `${completedTaskResults.length} tasks completed, refreshing page data`,
              );
              // Refresh the page data to get final reports and errors for completed test cases
              fetchPagedTestCases(page);
            }
          }

          // For test cases without task IDs, use original polling method
          if (testCasesWithoutTaskIds.length > 0) {
            const updatedTestCases =
              await fetchTestCasesByProjects(selectedProjects);
            setTestCases((previousTestCases) => {
              return previousTestCases.map((tc) => {
                // Only update test cases that don't have task IDs
                if (!tc.celery_task_id) {
                  const updated = updatedTestCases.find(
                    (utc) => utc.id === tc.id,
                  );
                  return updated || tc;
                }
                return tc;
              });
            });

            // Handle newly completed test cases (for non-task ID cases)
            const runningTestCaseIds = new Set(
              testCasesWithoutTaskIds.map((tc) => tc.id),
            );
            const newlyCompletedTestCases = updatedTestCases.filter(
              (tc) =>
                runningTestCaseIds.has(tc.id) &&
                (tc.status === "SUCCESS" ||
                  tc.status === "FAILURE" ||
                  tc.status === "STOPPED"),
            );

            // Fetch reports and errors for completed test cases
            if (newlyCompletedTestCases.length > 0) {
              const testCaseIds = newlyCompletedTestCases.map((tc) => tc.id);
              const fetchedReports =
                await fetchGlobalReportsByTestCases(testCaseIds);

              if (fetchedReports.length > 0) {
                const globalReportIds = fetchedReports.map(
                  (report) => report.id,
                );
                const fetchedErrors =
                  await fetchTestErrorsByGlobalReports(globalReportIds);

                setGlobalReports((previous) => {
                  const updatedReportIds = new Set(
                    fetchedReports.map((r) => r.id),
                  );
                  const filtered = previous.filter(
                    (r) => !updatedReportIds.has(r.id),
                  );
                  return [...filtered, ...fetchedReports];
                });
                setErrors((previous) => {
                  const updatedErrorIds = new Set(
                    fetchedErrors.map((error_) => error_.id),
                  );
                  const filtered = previous.filter(
                    (error_) => !updatedErrorIds.has(error_.id),
                  );
                  return [...filtered, ...fetchedErrors];
                });

                // Update error counts
                const newErrorCounts = {};
                for (const error of fetchedErrors) {
                  if (newErrorCounts[error.global_report]) {
                    newErrorCounts[error.global_report] += error.count;
                  } else {
                    newErrorCounts[error.global_report] = error.count;
                  }
                }
                setErrorCounts((previous) => ({
                  ...previous,
                  ...newErrorCounts,
                }));
              }
            }
          }
        } catch (error) {
          console.error("Error polling test cases:", error);
        }
      }
    };

    // Start polling if there are selected projects
    if (selectedProjects.length > 0) {
      pollingInterval = setInterval(pollRunningTestCases, POLLING_INTERVAL);
    }

    // Cleanup
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };

    // Depends on selectedProjects, testCases, and page for polling logic
  }, [selectedProjects, testCases, page]);

  // Initialize selected projects
  useEffect(() => {
    if (selectedProject && projects.length > 0) {
      setSelectedProjects([String(selectedProject.id)]);
    }
  }, [selectedProject, projects]);

  // Filter projects when selectedProjects change
  useEffect(() => {
    if (selectedProjects.length > 0 && !initialAutoFetchDone) {
      handleFilterProjects();
      setInitialAutoFetchDone(true);
    }
  }, [handleFilterProjects, initialAutoFetchDone, selectedProjects]);

  useEffect(() => {
    if (!loadingProjects && !selectedProject) {
      setLoading(false);
    }
  }, [loadingProjects, selectedProject]);

  /* ----------------------------- */
  /* Handlers for Project Selector */
  /* ----------------------------- */

  const handleProjectChange = (selectedIds) => {
    if (selectedIds.has("all")) {
      if (selectedProjects.length === projects.length) {
        setSelectedProjects([]);
      } else {
        const allProjectIds = projects.map((project) => String(project.id));
        setSelectedProjects(allProjectIds);
      }
    } else {
      const projectIds = [...selectedIds].map(String);
      setSelectedProjects(projectIds);
      if (projectIds.length === 1) {
        const project = projects.find((p) => p.id === Number(projectIds[0]));
        setSelectedProject(project);
      }
    }
  };

  const handleStop = async (testCaseId) => {
    try {
      console.log("Stopping test case:", testCaseId);
      await stopTestExecution(testCaseId);
      // Refresh test cases
      const updatedTestCases = await fetchTestCasesByProjects(selectedProjects);
      setTestCases(updatedTestCases);
      showToast("success", "Test case stopped successfully");
    } catch (error) {
      console.error("Error stopping test case:", error);
      showToast("error", "Failed to stop test case");
    }
  };

  const handleDelete = async (testCaseId) => {
    setDeleteModal({ isOpen: true, testCaseId });
  };

  const confirmDelete = async () => {
    try {
      await deleteTestCase(deleteModal.testCaseId);
      // Refresh test cases
      //const updatedTestCases = await fetchTestCasesByProjects(selectedProjects);
      //setTestCases(updatedTestCases);
      showToast("success", "Test case deleted successfully");
    } catch (error) {
      console.error("Error deleting test case:", error);
      showToast("error", "Failed to delete test case");
    } finally {
      handleFilterProjects();
      setDeleteModal({ isOpen: false, testCaseId: undefined });
    }
  };

  /* ---------------------------------- */
  /* Conditional Rendering for Projects */
  /* ---------------------------------- */

  // Columns for the Test Cases Table
  const columns = [
    {
      name: "Name",
      key: "name",
      sortable: true,
    },
    {
      name: "Status",
      key: "status",
      sortable: true,
    },
    {
      name: "Executed At",
      key: "executed_at",
      sortable: true,
    },
    {
      name: "Profiles Used",
      key: "user_profiles",
      sortable: false,
    },
    {
      name: "Execution Time",
      key: "execution_time",
      sortable: true,
    },
    {
      name: "Testing Errors",
      key: "num_errors",
      sortable: true,
    },
    {
      name: "Total Cost",
      key: "total_cost",
      sortable: true,
    },
    {
      name: "LLM Model",
      key: "llm_model",
      sortable: true,
    },
    {
      name: "Project",
      key: "project",
      sortable: true,
    },
    {
      name: "Actions",
      key: "actions",
      sortable: false,
    },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 flex flex-col space-y-4 sm:space-y-6 max-w-full 2xl:max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-tight">
          SENSEI Dashboard
        </h1>
      </div>

      {/* Setup Progress - only show for authenticated users */}
      {!publicView && (
        <div className="w-full">
          <SetupProgress isCompact={true} />
        </div>
      )}

      {/* Filters */}
      <Card className="border-default-200">
        <CardBody className="p-4 sm:p-6">
          <Form
            className="flex flex-col lg:flex-row gap-4 lg:items-center"
            onSubmit={handleFilterProjects}
            validationBehavior="native"
          >
            {/* Search input */}
            <div className="w-full lg:flex-1 lg:min-w-0">
              <Input
                type="search"
                label="Search test cases"
                placeholder="Search by name, status, or project..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                startContent={<Search className="text-default-400" size={18} />}
                isClearable
                radius="md"
                onClear={() => setSearchTerm("")}
                size="md"
                className="w-full"
                classNames={{
                  base: "w-full",
                  mainWrapper: "w-full",
                  inputWrapper:
                    "w-full h-12 bg-default-50/50 border-1 border-default-200 hover:border-default-300 focus-within:border-primary transition-colors",
                }}
              />
            </div>

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
                isRequired
                errorMessage="Please select at least one project."
                selectionMode="multiple"
                selectedKeys={new Set(selectedProjects)}
                onSelectionChange={handleProjectChange}
                isDisabled={loadingProjects || !!errorProjects}
                className="w-full"
                classNames={{
                  base: "w-full",
                  mainWrapper: "w-full",
                  trigger:
                    "w-full h-12 bg-default-50/50 border-1 border-default-200 hover:border-default-300 data-[focus=true]:border-primary transition-colors",
                }}
              >
                {loadingProjects ? (
                  <SelectItem key="loading" isDisabled>
                    Loading projects...
                  </SelectItem>
                ) : errorProjects ? (
                  <SelectItem key="error" isDisabled>
                    Error: {errorProjects}
                  </SelectItem>
                ) : (
                  <>
                    <SelectItem key="all" className="text-primary">
                      All Projects
                    </SelectItem>
                    {projects.length > 0 ? (
                      projects.map((project) => (
                        <SelectItem
                          key={project.id}
                          value={String(project.id)}
                          textValue={project.name}
                        >
                          <div className="flex justify-between items-center">
                            <span>{project.name}</span>
                            {project.public && (
                              <span className="text-default-400">(Public)</span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem key="no-projects" isDisabled>
                        No Projects Available
                      </SelectItem>
                    )}
                  </>
                )}
              </Select>
            </div>

            {/* Status selector */}
            <div className="w-full lg:flex-1 lg:min-w-[200px] lg:max-w-[240px]">
              <Select
                label="Filter by Status"
                placeholder="All Statuses"
                size="md"
                selectedKeys={new Set([selectedStatus])}
                selectionMode="single"
                onSelectionChange={(keys) => {
                  const value = [...keys][0];
                  setSelectedStatus(value);
                }}
                className="w-full"
                classNames={{
                  base: "w-full",
                  mainWrapper: "w-full",
                  trigger:
                    "w-full h-12 bg-default-50/50 border-1 border-default-200 hover:border-default-300 data-[focus=true]:border-primary transition-colors",
                }}
                renderValue={() => {
                  return (
                    <div className="flex items-center gap-2">
                      {selectedStatus === "ALL" ? (
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
                <SelectItem key="ALL" className="text-primary">
                  All Statuses
                </SelectItem>
                {statusOptions
                  .filter((opt) => opt.value !== "ALL")
                  .map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <Chip
                          color={statusColorMap[opt.value]}
                          size="sm"
                          variant="flat"
                        >
                          {opt.value}
                        </Chip>
                      </div>
                    </SelectItem>
                  ))}
              </Select>
            </div>

            {/* Filter button */}
            <div className="w-full lg:w-auto lg:flex-shrink-0">
              <Button
                color="primary"
                size="md"
                type="submit"
                className="w-full lg:w-auto h-12 px-8 font-medium"
                radius="md"
              >
                Apply Filters
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>

      {/* Results Table */}
      <Card className="border-default-200">
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <Table
              aria-label="Test Cases Table"
              isStriped
              sortDescriptor={sortDescriptor}
              onSortChange={(descriptor) => {
                setSortDescriptor(descriptor);
                fetchPagedTestCases(
                  page,
                  descriptor.column,
                  descriptor.direction,
                );
              }}
              className="min-w-[800px]"
            >
              <TableHeader>
                {columns.map((column) => (
                  <TableColumn key={column.key} allowsSorting={column.sortable}>
                    {column.name}
                  </TableColumn>
                ))}
              </TableHeader>
              <TableBody
                items={sortedTestCases}
                isLoading={loading}
                loadingContent={<Spinner label="Loading Test Cases..." />}
                emptyContent={"No Test Cases to display."}
              >
                {(testCase) => (
                  <TableRow
                    key={testCase.id}
                    href={`/test-case/${testCase.id}`}
                  >
                    <TableCell>{testCase.displayName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <Chip
                          color={statusColorMap[testCase.status]}
                          size="sm"
                          variant="flat"
                        >
                          {testCase.status}
                        </Chip>
                        {testCase.status === "RUNNING" && (
                          <div className="flex flex-col gap-1">
                            {testCase.progress_stage &&
                              testCase.progress_stage !==
                                "Task is waiting to be processed" && (
                                <div className="text-xs text-primary max-w-[180px] sm:max-w-48 truncate">
                                  {testCase.progress_stage}
                                </div>
                              )}
                            {testCase.progress_percentage !== undefined && (
                              <div className="text-xs text-default-500">
                                {testCase.total_conversations > 0
                                  ? `${testCase.executed_conversations || 0} of ${testCase.total_conversations} conversations (${testCase.progress_percentage}%)`
                                  : `${testCase.progress_percentage}% complete`}
                              </div>
                            )}
                          </div>
                        )}
                        {testCase.status === "FAILURE" &&
                          testCase.error_message && (
                            <div
                              className="text-xs text-red-600 dark:text-red-400 max-w-[180px] sm:max-w-48 truncate"
                              title={testCase.error_message}
                            >
                              {testCase.error_message}
                            </div>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(testCase.executed_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[150px] max-w-[200px]">
                        {testCase.copied_files.length > 3 ? (
                          <Accordion isCompact={true}>
                            <AccordionItem
                              title={`View ${testCase.copied_files.length} files`}
                              isCompact={true}
                              classNames={{ title: "text-sm mx-0" }}
                            >
                              <ul className="space-y-1">
                                {testCase.copied_files.map((file) => (
                                  <li
                                    key={`${testCase.id}-${file.name}`}
                                    className="truncate"
                                  >
                                    <span className="text-xs" title={file.name}>
                                      {file.name}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </AccordionItem>
                          </Accordion>
                        ) : (
                          <ul className="space-y-1">
                            {testCase.copied_files.map((file) => (
                              <li
                                key={`${testCase.id}-${file.name}`}
                                className="truncate"
                              >
                                <Link
                                  color="foreground"
                                  href={`${MEDIA_URL}${file.path}`}
                                  className="text-xs text-foreground/100 dark:text-foreground-dark/100"
                                  title={file.name}
                                >
                                  {file.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatExecutionTime(
                        testCase.execution_time,
                        testCase.status,
                      )}
                    </TableCell>
                    <TableCell>
                      {testCase.num_errors > 0 ? (
                        <Accordion isCompact>
                          <AccordionItem
                            title={
                              <span className="text-sm text-foreground/100 dark:text-foreground-dark/100">{`${testCase.num_errors} errors`}</span>
                            }
                          >
                            <ul>
                              {testCase.testCaseErrors.map((error_) => (
                                <li key={error_.id}>
                                  Error {error_.code}: {error_.count}
                                </li>
                              ))}
                            </ul>
                          </AccordionItem>
                        </Accordion>
                      ) : (
                        <Accordion isCompact>
                          <AccordionItem
                            title={
                              <span className="text-sm text-foreground dark:text-foreground-dark">
                                No errors
                              </span>
                            }
                          />
                        </Accordion>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatCost(testCase.total_cost, testCase.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {testCase.llm_model ? (
                          <>
                            <span className="font-medium text-sm">
                              {testCase.llm_model}
                            </span>
                            <span className="text-xs text-foreground/60 dark:text-foreground-dark/60">
                              {getProviderDisplayName(testCase.llm_provider)}
                            </span>
                          </>
                        ) : (
                          <span className="text-foreground/60 dark:text-foreground-dark/60 italic text-sm">
                            No model recorded
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {
                        projects.find(
                          (project) => project.id === testCase.project,
                        )?.name
                      }
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 min-w-[120px]">
                        <Button
                          as={Link}
                          href={`/test-case/${testCase.id}`}
                          size="sm"
                          variant="flat"
                          color="primary"
                          endContent={<Eye className="w-3 h-3" />}
                          className="w-full sm:w-auto text-xs"
                        >
                          <span className="hidden sm:inline">View</span>
                          <span className="sm:hidden">View</span>
                        </Button>
                        {testCase.status === "RUNNING" && (
                          <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            onPress={(event) => handleStop(testCase.id, event)}
                            endContent={<XCircle className="w-3 h-3" />}
                            className="w-full sm:w-auto text-xs"
                          >
                            <span className="hidden sm:inline">Stop</span>
                            <span className="sm:hidden">Stop</span>
                          </Button>
                        )}
                        {!publicView && (
                          <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            onPress={(event) =>
                              handleDelete(testCase.id, event)
                            }
                            endContent={<Trash className="w-3 h-3" />}
                            className="w-full sm:w-auto text-xs"
                          >
                            <span className="hidden sm:inline">Delete</span>
                            <span className="sm:hidden">Del</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      {/* Pagination */}
      <div className="flex justify-center px-2">
        <Pagination
          showControls
          total={totalPages}
          page={page}
          onChange={(newPage) => {
            setPage(newPage);
            fetchPagedTestCases(newPage);
          }}
          size="sm"
          className="flex-wrap"
        />
      </div>

      {/* Only show modal for authenticated users */}
      {!publicView && (
        <>
          {/* Delete Modal */}
          <Modal
            isOpen={deleteModal.isOpen}
            onOpenChange={(open) => {
              if (!open)
                setDeleteModal({ isOpen: false, testCaseId: undefined });
            }}
            size="sm"
            placement="center"
            className="mx-3"
          >
            <ModalContent>
              {(onClose) => (
                <>
                  <ModalHeader className="text-lg font-semibold px-4 sm:px-6">
                    Delete Test Case
                  </ModalHeader>
                  <ModalBody className="px-4 sm:px-6">
                    <p className="text-sm sm:text-base">
                      Are you sure you want to delete this test case?
                    </p>
                  </ModalBody>
                  <ModalFooter className="px-4 sm:px-6 gap-2">
                    <Button
                      color="default"
                      variant="flat"
                      onPress={onClose}
                      size="sm"
                      className="flex-1 sm:flex-none"
                    >
                      Cancel
                    </Button>
                    <Button
                      color="danger"
                      variant="flat"
                      onPress={() => {
                        confirmDelete();
                        onClose();
                      }}
                      size="sm"
                      className="flex-1 sm:flex-none"
                    >
                      Delete
                    </Button>
                  </ModalFooter>
                </>
              )}
            </ModalContent>
          </Modal>
        </>
      )}
    </div>
  );
}

export default Dashboard;
