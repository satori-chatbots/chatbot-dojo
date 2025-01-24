import React, { useState, useEffect } from 'react';
// import { useFetchTestCases } from '../hooks/useFetchTestCases';
import useFetchProjects from '../hooks/useFetchProjects';
import { fetchGlobalReportsByTestCases } from '../api/reportsApi';
import { MEDIA_URL } from '../api/config';
import { Button, Form, Select, SelectItem } from "@heroui/react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { fetchTestCasesByProjects } from '../api/testCasesApi';
import { Accordion, AccordionItem } from "@heroui/react";
import { Link } from '@heroui/react';

function Dashboard() {

    // Initialize testCases state as empty
    const [testCases, setTestCases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects();

    // Selected Projects State
    const [selectedProjects, setSelectedProjects] = useState([]);

    // Global Reports of Test Cases
    const [globalReports, setGlobalReports] = useState([]);

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
            //console.log(testCases);

            // Get the global reports for each test case
            const testCaseIds = testCases.map(testCase => testCase.id);
            if (testCaseIds.length !== 0) {
                const reports = await fetchGlobalReportsByTestCases(testCaseIds);
                setGlobalReports(reports);
                //console.log(reports);
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
        { name: 'Name', key: 'name' },
        { name: 'Executed At', key: 'executed_at' },
        { name: 'Profiles Used', key: 'user_profiles' },
        { name: 'Execution Time', key: 'execution_time' },
        { name: 'Number of Errors', key: 'num_errors' },
        { name: 'Project', key: 'project' },
    ];

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
            const remainingSeconds = (seconds % 60).toFixed(2);
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


            <Table aria-label="Test Cases Table" isStriped
                className='max-h-[60vh] sm:max-h-[50vh] overflow-y-auto'>
                <TableHeader columns={columns}>
                    {columns.map(column => (
                        <TableColumn key={column.key}>
                            {column.name}
                        </TableColumn>
                    ))}
                </TableHeader>

                <TableBody
                    isLoading={loading}
                    emptyContent={"No Test Cases to display."}>
                    {testCases.map(testCase => (
                        <TableRow key={testCase.id}>
                            <TableCell>{testCase.name ? testCase.name : "Test Case: " + testCase.id}</TableCell>
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
                            <TableCell>{globalReports.find(report => report.test_case === testCase.id)?.num_errors}</TableCell>
                            <TableCell>{projects.find(project => project.id === testCase.project)?.name}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>

            </Table>

        </div>
    );
}

export default Dashboard;
