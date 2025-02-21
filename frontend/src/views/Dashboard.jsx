import React, { useState, useEffect } from 'react';
// import { useFetchTestCases } from '../hooks/useFetchTestCases';
import useFetchProjects from '../hooks/useFetchProjects';
import { fetchTestErrorsByGlobalReports } from '../api/testErrorsApi';
import { fetchGlobalReportsByTestCases } from '../api/reportsApi';
import { MEDIA_URL } from '../api/config';
import { Button, Chip, Form, Select, SelectItem, Spinner, Pagination, Input } from "@heroui/react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { fetchTestCasesByProjects } from '../api/testCasesApi';
import { Accordion, AccordionItem } from "@heroui/react";
import { Link } from '@heroui/react';
import { useMemo } from 'react';
import { stopTestExecution } from '../api/testCasesApi';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { deleteTestCase } from '../api/testCasesApi';
import useSelectedProject from '../hooks/useSelectedProject';
import { useAuth } from '../contexts/AuthContext';
import { useMyCustomToast } from '../contexts/MyCustomToastContext';
import { Eye, Search, Trash, XCircle } from 'lucide-react';
import apiClient from '../api/apiClient';
import API_BASE_URL from '../api/config';
import { fetchPaginatedTestCases } from '../api/testCasesApi';

const statusOptions = [
    { label: "All", value: "ALL" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Running", value: "RUNNING" },
    { label: "Error", value: "ERROR" },
    { label: "Stopped", value: "STOPPED" },
];

function Dashboard() {
    const { showToast } = useMyCustomToast();

    // Initialize testCases state as empty
    const [testCases, setTestCases] = useState([]);
    const [selectedStatus, setSelectedStatus] = useState("ALL");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [searchTerm, setSearchTerm] = useState("");


    const fetchPagedTestCases = async (pageNumber, sortColumn, sortDirection) => {
        try {
            setLoading(true);
            const data = await fetchPaginatedTestCases({
                page: pageNumber,
                per_page: rowsPerPage,
                sort_column: sortColumn || sortDescriptor.column,
                sort_direction: sortDirection || sortDescriptor.direction,
                project_ids: selectedProjects.join(','),
                status: selectedStatus === 'ALL' ? '' : selectedStatus,
                search: searchTerm,
            });
            // Use a temporary const instead of the old state
            const newTestCases = data.items;
            setTestCases(newTestCases);
            setTotalPages(Math.ceil(data.total / rowsPerPage));

            // Now derive IDs from newTestCases
            const testCaseIds = newTestCases.map(tc => tc.id);
            if (testCaseIds.length > 0) {
                const fetchedReports = await fetchGlobalReportsByTestCases(testCaseIds);
                setGlobalReports(fetchedReports);

                const globalReportIds = fetchedReports.map(r => r.id);
                if (globalReportIds.length > 0) {
                    const fetchedErrors = await fetchTestErrorsByGlobalReports(globalReportIds);
                    setErrors(fetchedErrors);

                    const updatedErrorCounts = {};
                    fetchedErrors.forEach(error => {
                        if (updatedErrorCounts[error.global_report]) {
                            updatedErrorCounts[error.global_report] += error.count;
                        } else {
                            updatedErrorCounts[error.global_report] = error.count;
                        }
                    });
                    setErrorCounts(updatedErrorCounts);
                }
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching test cases:', error);
            setError(error);
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (selectedProjects.length > 0) {
                // When searching go back to the first page
                fetchPagedTestCases(1);
                setPage(1);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    // Modal for deleting a test case
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, testCaseId: null });

    const { user } = useAuth();
    const [publicView, setPublicView] = useState(!user);


    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects('all');

    const statusColorMap = {
        COMPLETED: 'success',
        ERROR: 'danger',
        RUNNING: 'warning',
    };

    // Interval for refreshing the projects
    const POLLING_INTERVAL = 2500;


    // Selected Projects State
    const [selectedProject, setSelectedProject] = useSelectedProject();
    const [selectedProjects, setSelectedProjects] = useState([]);

    // State for initial auto-fetching of test cases
    const [initialAutoFetchDone, setInitialAutoFetchDone] = useState(false);


    /* IMPORTANT: */
    /* A Test Case contains a Global Report which itself can contain multiple errors */

    // Global Reports of Test Cases
    const [globalReports, setGlobalReports] = useState([]);

    // Erros of Global Reports
    const [errors, setErrors] = useState([]);

    // Error count for each Global Report
    const [errorCounts, setErrorCounts] = useState({});

    // Polling for running test cases
    useEffect(() => {
        let pollingInterval;

        const pollRunningTestCases = async () => {
            // Only poll if there are running test cases
            const runningTestCases = testCases.filter(tc => tc.status === "RUNNING");
            if (runningTestCases.length > 0) {
                try {
                    // Fetch updated data for running test cases
                    const updatedTestCases = await fetchTestCasesByProjects(selectedProjects);
                    setTestCases(prevTestCases => {
                        return prevTestCases.map(tc => {
                            const updated = updatedTestCases.find(utc => utc.id === tc.id);
                            return updated || tc;
                        });
                    });

                    // Update reports and errors if status changed
                    const completedTestCases = updatedTestCases.filter(tc =>
                        tc.status === "COMPLETED" || tc.status === "ERROR" || tc.status === "STOPPED"
                    );

                    // Fetch reports and errors for completed test cases
                    if (completedTestCases.length > 0) {
                        const testCaseIds = completedTestCases.map(tc => tc.id);
                        const fetchedReports = await fetchGlobalReportsByTestCases(testCaseIds);

                        if (fetchedReports.length > 0) {
                            const globalReportIds = fetchedReports.map(report => report.id);
                            const fetchedErrors = await fetchTestErrorsByGlobalReports(globalReportIds);

                            setGlobalReports(prev => [...prev, ...fetchedReports]);
                            setErrors(prev => [...prev, ...fetchedErrors]);

                            // Update error counts
                            const newErrorCounts = {};
                            fetchedErrors.forEach(error => {
                                if (error.global_report in newErrorCounts) {
                                    newErrorCounts[error.global_report] += error.count;
                                } else {
                                    newErrorCounts[error.global_report] = error.count;
                                }
                            });
                            setErrorCounts(prev => ({ ...prev, ...newErrorCounts }));
                        }
                    }
                } catch (error) {
                    console.error('Error polling test cases:', error);
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
    }, [selectedProjects]);


    /* ----------------------------- */
    /* Handlers for Project Selector */
    /* ----------------------------- */


    const handleProjectChange = (selectedIds) => {
        if (selectedIds.has('all')) {
            if (selectedProjects.length === projects.length) {
                setSelectedProjects([]);
            } else {
                const allProjectIds = projects.map(project => String(project.id));
                setSelectedProjects(allProjectIds);
            }
        } else {
            const projectIds = [...selectedIds].map(id => String(id));
            setSelectedProjects(projectIds);
            if (projectIds.length === 1) {
                const project = projects.find(p => p.id === Number(projectIds[0]));
                setSelectedProject(project);
            }
        }
    };


    const handleFilterProjects = async (e) => {
        if (e) {
            e.preventDefault();
        }
        if (selectedProjects.length === 0) {
            return;
        }

        try {
            setLoading(true);
            setError(null);
            await fetchPagedTestCases(1); // Reset to first page when filtering
            setPage(1);
        } catch (err) {
            console.error('Error filtering projects:', err);
            showToast('error', 'Failed to filter projects');
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async (testCaseId, e) => {
        try {
            console.log('Stopping test case:', testCaseId);
            await stopTestExecution(testCaseId);
            // Refresh test cases
            const updatedTestCases = await fetchTestCasesByProjects(selectedProjects);
            setTestCases(updatedTestCases);
            showToast('success', 'Test case stopped successfully');
        } catch (error) {
            console.error('Error stopping test case:', error);
            showToast('error', 'Failed to stop test case');
        }
    };

    const handleDelete = async (testCaseId, e) => {
        setDeleteModal({ isOpen: true, testCaseId });
    };

    const confirmDelete = async () => {
        try {
            await deleteTestCase(deleteModal.testCaseId);
            // Refresh test cases
            //const updatedTestCases = await fetchTestCasesByProjects(selectedProjects);
            //setTestCases(updatedTestCases);
            showToast('success', 'Test case deleted successfully');

        } catch (error) {
            console.error('Error deleting test case:', error);
            showToast('error', 'Failed to delete test case');

        } finally {
            handleFilterProjects();
            setDeleteModal({ isOpen: false, testCaseId: null });
        }
    };


    /* ---------------------------------- */
    /* Conditional Rendering for Projects */
    /* ---------------------------------- */

    if (loadingProjects) {
        return <div>Loading projects...</div>;
    }

    if (errorProjects) {
        return <div>Error loading projects: {errorProjects}</div>;
    }

    // Columns for the Test Cases Table
    const columns = [
        {
            name: 'Name',
            key: 'name',
            sortable: true,
        },
        {
            name: 'Status',
            key: 'status',
            sortable: true,
        },
        {
            name: 'Executed At',
            key: 'executed_at',
            sortable: true,
        },
        {
            name: 'Profiles Used',
            key: 'user_profiles',
            sortable: false,
        },
        {
            name: 'Execution Time',
            key: 'execution_time',
            sortable: true,
        },
        {
            name: 'Testing Errors',
            key: 'num_errors',
            sortable: true,
        },
        {
            name: 'Total Cost',
            key: 'total_cost',
            sortable: true,
        },
        {
            name: 'Project',
            key: 'project',
            sortable: true,
        },
        {
            name: 'Actions',
            key: 'actions',
            sortable: false,
        }
    ];

    const [sortDescriptor, setSortDescriptor] = useState({
        column: 'executed_at',
        direction: 'descending',
    });

    const derivedTestCases = useMemo(() => {
        return testCases.map(tc => {
            const displayName = tc.name || 'Unnamed Test Case';
            const report = globalReports.find(r => r.test_case === tc.id);
            const numErrors = report ? errorCounts[report.id] || 0 : 0;
            const testCaseErrors = errors.filter(err => err.global_report === report?.id);
            const totalCost = parseFloat(report?.total_cost || 0).toFixed(5);
            return {
                ...tc,
                displayName,
                num_errors: numErrors,
                testCaseErrors,
                total_cost: totalCost
            };
        });
    }, [testCases, globalReports, errorCounts, errors]);

    const sortedTestCases = useMemo(() => derivedTestCases, [derivedTestCases]);


    const formatExecutionTime = (seconds, status) => {
        // Check if it was stopped
        if (status === 'STOPPED') {
            return 'Stopped';
        }

        // Check if it is still running
        if (seconds === null) {
            return 'Running';
        }

        if (seconds >= 3600) {
            const hours = Math.floor(seconds / 3600);
            const minutes = ((seconds % 3600) / 60).toFixed(2);
            return `${hours}h ${minutes}m`;
        } else if (seconds >= 60) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = (seconds % 60).toFixed(0);
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${seconds.toFixed(2)}s`;
        }
    };

    const formatCost = (cost, status) => {
        if (status === "STOPPED") {
            return 'Stopped';
        }
        return `$${parseFloat(cost || 0).toFixed(5)}`;
    };

    return (
        <div className="
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
                <h1 className="text-2xl sm:text-3xl font-bold text-center">Public Projects</h1>
            ) : (
                <h1 className="text-2xl sm:text-3xl font-bold text-center">My Projects</h1>
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
                        onChange={(e) => setSearchTerm(e.target.value)}
                        startContent={
                            <Search className="text-default-400" size={18} />
                        }
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
                    >
                        <SelectItem key="all" className="text-primary">
                            All Projects
                        </SelectItem>
                        {projects.length > 0 ? (
                            projects.map(project => (
                                <SelectItem
                                    key={project.id}
                                    value={String(project.id)}
                                    textValue={project.name}
                                >
                                    <div className="flex justify-between items-center">
                                        <span>{project.name}</span>
                                        {project.public && <span className="text-default-400">(Public)</span>}
                                    </div>
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem key="no-projects" disabled>
                                No Projects Available
                            </SelectItem>
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
                            const val = [...keys][0];
                            setSelectedStatus(val);
                        }}
                        renderValue={(items) => {
                            const selectedItem = statusOptions.find(opt => opt.value === selectedStatus);
                            return (
                                <div className="flex items-center gap-2">
                                    {selectedStatus !== "ALL" ? (
                                        <span className={`text-${statusColorMap[selectedStatus]}`}>
                                            {selectedStatus}
                                        </span>
                                    ) : (
                                        "All Statuses"
                                    )}
                                </div>
                            );
                        }}
                    >
                        <SelectItem key="ALL" className="text-primary">
                            All Statuses
                        </SelectItem>
                        {statusOptions.filter(opt => opt.value !== "ALL").map((opt) => (
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
                    <Button
                        color="primary"
                        className="w-full h-12"
                        type="submit"
                    >
                        Filter
                    </Button>
                </div>
            </Form>

            <div className="
                        flex-1
                        min-h-0
                        overflow-auto
                        w-full
                        max-w-[1200px]
                        mx-auto
                ">
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
                            <TableColumn
                                key={column.key}
                                allowsSorting={column.sortable}
                            >
                                {column.name}
                            </TableColumn>
                        ))}
                    </TableHeader>
                    <TableBody
                        items={sortedTestCases}
                        isLoading={loading}
                        loadingContent={<Spinner label='Loading Test Cases...' />}
                        emptyContent={"No Test Cases to display."}
                    >
                        {(testCase) => (
                            <TableRow key={testCase.id} href={`/test-case/${testCase.id}`}>
                                <TableCell>{testCase.displayName}</TableCell>
                                <TableCell>
                                    <Chip color={statusColorMap[testCase.status]} size="sm" variant="flat">
                                        {testCase.status}
                                    </Chip>
                                </TableCell>
                                <TableCell>{new Date(testCase.executed_at).toLocaleString()}</TableCell>
                                <TableCell>
                                    {testCase.copied_files.length > 3 ? (
                                        <Accordion
                                            isCompact={true}
                                        >
                                            <AccordionItem
                                                title={`View ${testCase.copied_files.length} files`}
                                                isCompact={true}
                                                classNames={{ title: "text-sm mx-0" }}
                                            >
                                                <ul>
                                                    {testCase.copied_files.map(file => (
                                                        <li key={`${testCase.id}-${file.name}`}>{file.name}</li>
                                                    ))}
                                                </ul>
                                            </AccordionItem>
                                        </Accordion>
                                    ) : (
                                        <ul>
                                            {testCase.copied_files.map(file => (
                                                <li key={`${testCase.id}-${file.name}`}>
                                                    <Link color="foreground" href={`${MEDIA_URL}${file.path}`} className="text-sm">{file.name}</Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </TableCell>
                                <TableCell>{formatExecutionTime(testCase.execution_time, testCase.status)}</TableCell>
                                <TableCell>
                                    {testCase.num_errors > 0 ? (
                                        <Accordion isCompact>
                                            <AccordionItem title={<span className="text-sm">{`${testCase.num_errors} errors`}</span>}>
                                                <ul>
                                                    {testCase.testCaseErrors.map(err => (
                                                        <li key={err.id}>
                                                            Error {err.code}: {err.count}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </AccordionItem>
                                        </Accordion>
                                    ) : (
                                        <Accordion isCompact>
                                            <AccordionItem title={<span className="text-sm">No errors</span>} />
                                        </Accordion>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {formatCost(testCase.total_cost, testCase.status)}
                                </TableCell>
                                <TableCell>{projects.find(project => project.id === testCase.project)?.name}</TableCell>


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
                                                onPress={(e) => handleStop(testCase.id, e)}
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
                                                onPress={(e) => handleDelete(testCase.id, e)}
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
                            if (!open) setDeleteModal({ isOpen: false, testCaseId: null });
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
                                        <Button
                                            color="default"
                                            variant="flat"
                                            onPress={onClose}
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

        </div >
    );
}

export default Dashboard;
