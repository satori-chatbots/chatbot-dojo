import React from 'react';
import { useState } from 'react';
import { useFetchTestCases } from '../hooks/useFetchTestCases';
import useFetchProjects from '../hooks/useFetchProjects';
import TestCasesList from '../components/TestCasesList';
import { MEDIA_URL } from '../api/config';
import { Button, Form, Select, SelectItem } from "@heroui/react";

function Dashboard() {
    const { testCases, loading, error } = useFetchTestCases();
    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects();

    // Selected Projects State
    const [selectedProjects, setSelectedProjects] = useState([]);

    /* ----------------------------- */
    /* Handlers for Project Selector */
    /* ----------------------------- */

    const handleSelectAll = () => {
        setSelectedProjects([...projects.map(project => String(project.id))]);
    }

    const handleProjectChange = (selectedIds) => {
        //console.log(selectedIds);
        if (selectedIds.has('all')) {
            // If all projects are already selected, deselect all
            if (selectedProjects.length === projects.length) {
                setSelectedProjects([]);
            }
            // Otherwise, select all
            else {
                setSelectedProjects([...projects.map(project => String(project.id))]);
            }
        } else {
            setSelectedProjects([...selectedIds].map(id => String(id)));
        }
    }

    const handleFormReset = () => {
        setSelectedProjects([]);
    }


    if (loading) {
        return <p>Loading test cases...</p>;
    }

    if (error) {
        return <p>Error fetching test cases: {error.message}</p>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col space-y-4 sm:space-y-6 max-w-full sm:max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-center">Dashboard</h1>

            {/* Project Selector */}
            <Form
                className="flex flex-col items-center w-56">
                <Select
                    label="Filter by Project(s):"
                    className="mt-2"
                    size="sm"
                    selectionMode="multiple"
                    selectedKeys={selectedProjects}
                    onSelectionChange={handleProjectChange}
                >
                    <SelectItem key="all"
                        className="text-primary"
                    >
                        All Projects
                    </SelectItem>
                    {projects.map(project => (
                        <SelectItem key={project.id}>
                            {project.name}
                        </SelectItem>
                    ))}
                </Select>

                {/* Filter Button */}
                <Button
                    color="primary"
                    className="mt-2 w-full"
                >
                    Filter
                </Button>
            </Form>


            <h1>Test Cases</h1>
            {testCases.length > 0 ? (
                <ul>
                    {testCases.map(testCase => (
                        <li key={testCase.id}>
                            <p><strong>Executed At:</strong> {new Date(testCase.executed_at).toLocaleString()}</p>
                            <p><strong>Execution Time:</strong> {testCase.execution_time} seconds</p>
                            <p><strong>User Profiles Used:</strong></p>
                            <ul>
                                {testCase.copied_files && testCase.copied_files.length > 0 ? (
                                    testCase.copied_files.map((fileObj, index) => (
                                        <li key={`${fileObj.path}-${index}`}>
                                            <a
                                                href={`${MEDIA_URL}${fileObj.path}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:underline flex-1 break-words max-w-sm md:max-w-lg lg:max-w-2xl"
                                            >
                                                {fileObj.name}
                                            </a>
                                        </li>
                                    ))
                                ) : (
                                    <li>No files available.</li>
                                )}
                            </ul>
                            <p style={{ whiteSpace: 'pre-wrap' }}><strong>Conversation:</strong> {testCase.result}</p>
                            <br />
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No test cases yet.</p>
            )}
        </div>
    );
}

export default Dashboard;
