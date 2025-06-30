import React, { useState, useEffect, useCallback } from "react";
// import { useFetchTestCases } from '../hooks/useFetchTestCases';
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
} from "@heroui/react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { fetchTestCasesByProjects } from "../api/test-cases-api";
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
import { Eye, Search, Trash, XCircle } from "lucide-react";
import { fetchPaginatedTestCases } from "../api/test-cases-api";
import { getProviderDisplayName } from "../constants/providers";
import { formatExecutionTime as sharedFormatExecutionTime } from "../utils/time-utils";
import SetupProgress from "../components/setup-progress";

const statusOptions = [
  { label: "All", value: "ALL" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Running", value: "RUNNING" },
  { label: "Error", value: "ERROR" },
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
    COMPLETED: "success",
    ERROR: "danger",
    RUNNING: "warning",
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
          // Fetch updated data for running test cases
          const updatedTestCases =
            await fetchTestCasesByProjects(selectedProjects);
          setTestCases((previousTestCases) => {
            return previousTestCases.map((tc) => {
              const updated = updatedTestCases.find((utc) => utc.id === tc.id);
              return updated || tc;
            });
          });

          // Update reports and errors if status changed
          const runningTestCaseIds = new Set(
            runningTestCases.map((tc) => tc.id),
          );
          const newlyCompletedTestCases = updatedTestCases.filter(
            (tc) =>
              runningTestCaseIds.has(tc.id) &&
              (tc.status === "COMPLETED" ||
                tc.status === "ERROR" ||
                tc.status === "STOPPED"),
          );

          // Fetch reports and errors for completed test cases
          if (newlyCompletedTestCases.length > 0) {
            const testCaseIds = newlyCompletedTestCases.map((tc) => tc.id);
            const fetchedReports =
              await fetchGlobalReportsByTestCases(testCaseIds);

            if (fetchedReports.length > 0) {
              const globalReportIds = fetchedReports.map((report) => report.id);
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

    // Depends on selectedProjects and testCases
  }, [selectedProjects, testCases]);

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
    <div
      className="
                flex flex-col
                items-center
                space-y-4 sm:space-y-6 lg:space-y-8
                w-full sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl
                mx-auto
                my-auto
                max-h-[88vh]
                p-4 sm:p-6 lg:p-8"
    >
      {publicView ? (
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-foreground dark:text-foreground-dark">
          Public Projects
        </h1>
      ) : (
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-foreground dark:text-foreground-dark">
          My Projects
        </h1>
      )}

      {/* Setup Progress - only show for authenticated users */}
      {!publicView && (
        <div className="w-full max-w-[1200px]">
          <SetupProgress isCompact={true} />
        </div>
      )}

      {/* Project Selector */}
      <Form
        className="
                        flex flex-col lg:flex-row
                        items-center
                        justify-center
                        gap-4
                        w-full
                        max-w-[1200px]
                        mx-auto
                        mb-4
                    "
        onSubmit={handleFilterProjects}
        validationBehavior="native"
      >
        {/* Search input */}
        <div className="w-full lg:w-1/4 flex justify-center">
          <Input
            type="search"
            label="Search test cases:"
            placeholder="Type to search..."
            className="w-full h-12"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            startContent={<Search className="text-default-400" size={18} />}
            isClearable
            // So that it looks like the selectors
            radius="sm"
            onClear={() => setSearchTerm("")}
          />
        </div>

        {/* Projects selector */}
        <div className="w-full lg:w-1/3 flex justify-center">
          <Select
            label={publicView ? "Filter Public Projects:" : "Filter Projects:"}
            className="w-full"
            size="sm"
            isRequired
            errorMessage="Please select at least one project."
            selectionMode="multiple"
            selectedKeys={new Set(selectedProjects)}
            onSelectionChange={handleProjectChange}
            isDisabled={loadingProjects || !!errorProjects}
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
        <div className="w-full lg:w-1/4 flex justify-center">
          <Select
            label="Filter by Status:"
            className="w-full"
            size="sm"
            selectedKeys={new Set([selectedStatus])}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const value = [...keys][0];
              setSelectedStatus(value);
            }}
            renderValue={() => {
              return (
                <div className="flex items-center gap-2">
                  {selectedStatus === "ALL" ? (
                    "All Statuses"
                  ) : (
                    <span className={`text-${statusColorMap[selectedStatus]}`}>
                      {selectedStatus}
                    </span>
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
        <div className="w-full lg:w-auto flex justify-center">
          <Button color="primary" className="w-full h-12" type="submit">
            Filter
          </Button>
        </div>
      </Form>

      <div
        className="
                        flex-1
                        min-h-0
                        overflow-auto
                        w-full
                        max-w-[1200px]
                        mx-auto
                "
      >
        <Table
          aria-label="Test Cases Table"
          isStriped
          sortDescriptor={sortDescriptor}
          onSortChange={(descriptor) => {
            setSortDescriptor(descriptor);
            fetchPagedTestCases(page, descriptor.column, descriptor.direction);
          }}
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
              <TableRow key={testCase.id} href={`/test-case/${testCase.id}`}>
                <TableCell>{testCase.displayName}</TableCell>
                <TableCell>
                  <Chip
                    color={statusColorMap[testCase.status]}
                    size="sm"
                    variant="flat"
                  >
                    {testCase.status}
                  </Chip>
                </TableCell>
                <TableCell>
                  {new Date(testCase.executed_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {testCase.copied_files.length > 3 ? (
                    <Accordion isCompact={true}>
                      <AccordionItem
                        title={`View ${testCase.copied_files.length} files`}
                        isCompact={true}
                        classNames={{ title: "text-sm mx-0" }}
                      >
                        <ul>
                          {testCase.copied_files.map((file) => (
                            <li key={`${testCase.id}-${file.name}`}>
                              {file.name}
                            </li>
                          ))}
                        </ul>
                      </AccordionItem>
                    </Accordion>
                  ) : (
                    <ul>
                      {testCase.copied_files.map((file) => (
                        <li key={`${testCase.id}-${file.name}`}>
                          <Link
                            color="foreground"
                            href={`${MEDIA_URL}${file.path}`}
                            className="text-sm text-foreground/100 dark:text-foreground-dark/100"
                          >
                            {file.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
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
                    projects.find((project) => project.id === testCase.project)
                      ?.name
                  }
                </TableCell>

                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      as={Link}
                      href={`/test-case/${testCase.id}`}
                      size="sm"
                      variant="flat"
                      color="primary"
                      endContent={<Eye className="w-3 h-3" />}
                    >
                      View
                    </Button>
                    {testCase.status === "RUNNING" && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={(event) => handleStop(testCase.id, event)}
                        endContent={<XCircle className="w-3 h-3" />}
                      >
                        Stop
                      </Button>
                    )}
                    {!publicView && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={(event) => handleDelete(testCase.id, event)}
                        endContent={<Trash className="w-3 h-3" />}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex w-full max-w-[1200px] mx-auto justify-center">
        <Pagination
          showControls
          total={totalPages}
          page={page}
          onChange={(newPage) => {
            setPage(newPage);
            fetchPagedTestCases(newPage);
          }}
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
          >
            <ModalContent>
              {(onClose) => (
                <>
                  <ModalHeader>Delete Test Case</ModalHeader>
                  <ModalBody>
                    Are you sure you want to delete this test case?
                  </ModalBody>
                  <ModalFooter>
                    <Button color="default" variant="flat" onPress={onClose}>
                      Cancel
                    </Button>
                    <Button
                      color="danger"
                      variant="flat"
                      onPress={() => {
                        confirmDelete();
                        onClose();
                      }}
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
