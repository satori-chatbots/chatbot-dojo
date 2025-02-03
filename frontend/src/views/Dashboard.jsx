import React, { useState, useEffect } from 'react';
// import { useFetchTestCases } from '../hooks/useFetchTestCases';
import useFetchProjects from '../hooks/useFetchProjects';
import { fetchTestErrorsByGlobalReports } from '../api/testErrorsApi';
import { fetchGlobalReportsByTestCases } from '../api/reportsApi';
import { MEDIA_URL } from '../api/config';
import { Button, Chip, Form, Select, SelectItem, Spinner } from "@heroui/react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { fetchTestCasesByProjects } from '../api/testCasesApi';
import { Accordion, AccordionItem } from "@heroui/react";
import { Link } from '@heroui/react';
import { useMemo } from 'react';
import { stopTestExecution } from '../api/testCasesApi';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { deleteTestCase } from '../api/testCasesApi';



function Dashboard() {

    // Initialize testCases state as empty
    const [testCases, setTestCases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Modal for deleting a test case
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, testCaseId: null });


    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects();

    const statusColorMap = {
        COMPLETED: 'success',
        ERROR: 'danger',
        RUNNING: 'warning',
    };

    // Interval for refreshing the projects
    const POLLING_INTERVAL = 2500;


    // Selected Projects State
    const [selectedProjects, setSelectedProjects] = useState([]);

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


    /* ----------------------------- */
    /* Handlers for Project Selector */
    /* ----------------------------- */


    const handleProjectChange = (selectedIds) => {
        if (selectedIds.has('all')) {
            // console.log(projects)
            if (selectedProjects.length === projects.length) {
                setSelectedProjects([]);
            } else {
                setSelectedProjects(projects.map(project => String(project.id)));
            }
        } else {
            setSelectedProjects([...selectedIds].map(id => String(id)));
        }
    }

    const handleFilterProjects = async (e) => {
        e.preventDefault();
        //console.log(selectedProjects);
        if (selectedProjects.length === 0) {
            return;
        }

        try {
            // Get the test cases
            setLoading(true);
            setError(null);
            const testCases = await fetchTestCasesByProjects(selectedProjects);
            setTestCases(testCases);

            // Get the global reports for each test case
            const testCaseIds = testCases.map(testCase => testCase.id);
            if (testCaseIds.length !== 0) {
                const fetchedReports = await fetchGlobalReportsByTestCases(testCaseIds);

                // Fetch errors based on local data
                const globalReportIds = fetchedReports.map(report => report.id);
                let fetchedErrors = [];
                if (globalReportIds.length !== 0) {
                    fetchedErrors = await fetchTestErrorsByGlobalReports(globalReportIds);
                    setErrors(fetchedErrors);
                    console.log("Errors");
                    console.log(fetchedErrors);
                }

                setGlobalReports(fetchedReports);
                console.log("Fetched Reports");
                console.log(fetchedReports);

                // Calculate the error count
                const updatedErrorCounts = {};
                fetchedErrors.forEach(error => {
                    if (error.global_report in updatedErrorCounts) {
                        updatedErrorCounts[error.global_report] += error.count;
                    } else {
                        updatedErrorCounts[error.global_report] = error.count;
                    }
                });
                setErrorCounts(updatedErrorCounts);
            }
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    }

    const handleStop = async (testCaseId, e) => {
        try {
            console.log('Stopping test case:', testCaseId);
            await stopTestExecution(testCaseId);
            // Refresh test cases
            const updatedTestCases = await fetchTestCasesByProjects(selectedProjects);
            setTestCases(updatedTestCases);
        } catch (error) {
            console.error('Error stopping test case:', error);
        }
    };

    const handleDelete = async (testCaseId, e) => {
        setDeleteModal({ isOpen: true, testCaseId });
    };

    const confirmDelete = async () => {
        try {
            await deleteTestCase(deleteModal.testCaseId);
            // Refresh test cases
            const updatedTestCases = await fetchTestCasesByProjects(selectedProjects);
            setTestCases(updatedTestCases);
        } catch (error) {
            console.error('Error deleting test case:', error);
        } finally {
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
        { name: 'Name', key: 'name', sortable: true },
        { name: 'Status', key: 'status', sortable: true },
        { name: 'Executed At', key: 'executed_at', sortable: true },
        { name: 'Profiles Used', key: 'user_profiles', sortable: false },
        { name: 'Execution Time', key: 'execution_time', sortable: true },
        { name: 'Testing Errors', key: 'num_errors', sortable: true },
        { name: 'Total Cost', key: 'total_cost', sortable: true },
        { name: 'Project', key: 'project', sortable: true },
        { name: 'Actions', key: 'actions', sortable: false },
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

    const sortedTestCases = useMemo(() => {
        const { column, direction } = sortDescriptor;
        return [...derivedTestCases].sort((a, b) => {
            const first = column === 'name' ? a.displayName : a[column];
            const second = column === 'name' ? b.displayName : b[column];
            const cmp = first < second ? -1 : first > second ? 1 : 0;
            return direction === 'descending' ? -cmp : cmp;
        });
    }, [derivedTestCases, sortDescriptor]);


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
            max-h-[90vh]
            p-4 sm:p-6 lg:p-8"
        >
            <h1 className="text-2xl sm:text-3xl font-bold text-center">Dashboard</h1>

            {/* Project Selector */}
            <Form
                className="
                flex col sm:flex-row
                space-y-6 sm:space-x-4 sm:space-y-0
                w-full sm:w-xl sm:max-w-xl lg:max-w-2xl
                mb-4
                "
                onSubmit={handleFilterProjects}
                validationBehavior="native"
            >
                <Select
                    label="Filter by Project(s):"
                    className="
                        w-full
                        h-10 sm:h-12
                        "
                    size="sm"
                    isRequired
                    errorMessage="Please select at least one project."
                    selectionMode="multiple"
                    selectedKeys={selectedProjects}

                    onSelectionChange={handleProjectChange}
                >
                    <SelectItem key="all" className="text-primary">
                        All Projects
                    </SelectItem>
                    {projects.length > 0 ? (
                        projects.map(project => (
                            <SelectItem key={project.id}>
                                {project.name}
                            </SelectItem>
                        ))
                    ) : (
                        <SelectItem key="no-projects" disabled>
                            No Projects Available
                        </SelectItem>
                    )}
                </Select>

                {/* Filter Button */}
                <Button
                    color="primary"
                    className="w-full
                    h-10 sm:h-12
                    sm:basis-1/4"
                    type="submit"
                >
                    Filter
                </Button>
            </Form>


            <Table
                aria-label="Test Cases Table"
                isStriped
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
                className='max-h-[60vh] sm:max-h-[50vh] overflow-y-auto'
                selectionMode='single'
            >
                <TableHeader columns={columns}>
                    {(column) => (
                        <TableColumn
                            key={column.key}
                            allowsSorting={column.sortable}
                        >
                            {column.name}
                        </TableColumn>
                    )}
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
                                        onPress={(e) => e.stopPropagation()}
                                    >
                                        View
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        color="danger"
                                        isDisabled={testCase.status !== "RUNNING"}
                                        onPress={(e) => handleStop(testCase.id, e)}
                                    >
                                        Stop
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        color="danger"
                                        onPress={(e) => handleDelete(testCase.id, e)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>

            </Table>

            {/* Delete Modal */}
            <Modal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, testCaseId: null })}
            >
                <ModalContent>
                    <ModalHeader>Delete Test Case</ModalHeader>
                    <ModalBody>
                        Are you sure you want to delete this test case?
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="danger"
                            variant="flat"
                            onPress={confirmDelete}
                        >
                            Delete
                        </Button>
                        <Button
                            color="default"
                            variant="flat"
                            onPress={() => setDeleteModal({ isOpen: false, testCaseId: null })}
                        >
                            Cancel
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

        </div >
    );
}

export default Dashboard;
