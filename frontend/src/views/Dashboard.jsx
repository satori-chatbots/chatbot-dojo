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


function Dashboard() {

    // Initialize testCases state as empty
    const [testCases, setTestCases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects();

    const statusColorMap = {
        COMPLETED: 'success',
        ERROR: 'danger',
        RUNNING: 'warning',
    };


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
        { name: 'Profiles Used', key: 'user_profiles' },
        { name: 'Execution Time', key: 'execution_time', sortable: true },
        { name: 'Testing Errors', key: 'num_errors', sortable: true },
        { name: 'Total Cost', key: 'total_cost', sortable: true },
        { name: 'Project', key: 'project', sortable: true },
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


    const formatExecutionTime = (seconds) => {
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
                // 4) Add sort props
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
                className='max-h-[60vh] sm:max-h-[50vh] overflow-y-auto'
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
                        <TableRow key={testCase.id}>
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
                            <TableCell>{formatExecutionTime(testCase.execution_time)}</TableCell>
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
                                ${testCase.total_cost}
                            </TableCell>
                            <TableCell>{projects.find(project => project.id === testCase.project)?.name}</TableCell>
                        </TableRow>
                    )}
                </TableBody>

            </Table>

        </div >
    );
}

export default Dashboard;
