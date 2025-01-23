import React, { useState, useEffect } from 'react';
// import { useFetchTestCases } from '../hooks/useFetchTestCases';
import useFetchProjects from '../hooks/useFetchProjects';
import { Button, Form, Select, SelectItem } from "@heroui/react";
import { fetchTestCasesByProjects } from '../api/testCasesApi';

function Dashboard() {

    // Initialize testCases state as empty
    const [testCases, setTestCases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects();

    // Selected Projects State
    const [selectedProjects, setSelectedProjects] = useState([]);

    /* ----------------------------- */
    /* Handlers for Project Selector */
    /* ----------------------------- */


    const handleProjectChange = (selectedIds) => {
        if (selectedIds.has('all')) {
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
            setLoading(true);
            setError(null);
            const testCases = await fetchTestCasesByProjects(selectedProjects);
            setTestCases(testCases);
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    }

    /* ----------------------------- */
    /* Conditional Rendering for Projects */
    /* ----------------------------- */

    if (loadingProjects) {
        return <div>Loading projects...</div>;
    }

    if (errorProjects) {
        return <div>Error loading projects: {errorProjects}</div>;
    }

    return (
        <div className="
            flex flex-col
            items-center
            space-y-4
            w-full
            mx-auto
            my-auto
            max-h-[80vh]
            p-4 sm:p-6 lg:p-8"
        >
            <h1 className="text-2xl sm:text-3xl font-bold text-center">Dashboard</h1>

            {/* Project Selector */}
            <Form
                className="
                flex col sm:flex-row
                space-y-6 sm:space-x-4 sm:space-y-0
                w-full sm:w-xl sm:max-w-xl lg:max-w-2xl 2xl:max-w-3xl
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

            <h1>Test Cases</h1>


            {loading ? (
                <div>Loading</div>) : <div>
                {testCases.length} </div>}
        </div>
    );
}

export default Dashboard;
