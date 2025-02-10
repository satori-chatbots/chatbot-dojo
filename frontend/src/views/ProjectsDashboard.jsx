import React, { useState, useEffect, useMemo } from 'react';
import {
    Button,
    Input,
    Select,
    SelectItem,
    Modal,
    ModalContent,
    ModalFooter,
    ModalBody,
    ModalHeader,
    useDisclosure,
    Form,
    Spinner,
} from "@heroui/react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import CreateProjectModal from '../components/CreateProjectModal';
import useFetchProjects from '../hooks/useFetchProjects';
import { fetchChatbotTechnologies, fetchTechnologyChoices } from '../api/chatbotTechnologyApi';
import { createProject, deleteProject, updateProject, checkProjectName } from '../api/projectApi';
import EditProjectModal from '../components/EditProjectModal';
import useSelectedProject from '../hooks/useSelectedProject';


const ProjectsDashboard = () => {

    // Loading state
    const [loading, setLoading] = useState(false);

    // State of the modal to create new project
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // State of the modal to edit project
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Form data for creating a new project
    const [createFormData, setCreateFormData] = useState({
        name: '',
        technology: '',
    });

    // Form data for editing a project
    const [editFormData, setEditFormData] = useState({
        name: '',
        technology: '',
    });


    // Projects state
    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects('owned');

    const [technologies, setTechnologies] = useState([]);

    // State with the id of the project to edit
    const [editProjectId, setEditProjectId] = useState(null);

    // Loading state for the serverside validation
    const [loadingValidation, setLoadingValidation] = useState(false);

    // Errors for the serverside validation
    const [validationErrors, setValidationErrors] = useState({});

    // State for the original name
    const [originalName, setOriginalName] = useState('');

    const [selectedProject, setSelectedProject] = useSelectedProject();


    // Init the available technologies and projects
    useEffect(() => {
        loadTechnologies();

    }, []);

    const loadTechnologies = async () => {
        try {
            setLoading(true);
            const technologies = await fetchChatbotTechnologies();
            setTechnologies(technologies);
            // console.log('technologies:', technologies);

        } catch (error) {
            console.error('Error fetching technologies:', error);
        } finally {
            setLoading(false);
        }
    };



    /* ------------------------------------- */
    /* -------------- HANDLERS ------------- */
    /* ------------------------------------- */

    // Function to handle the change of the new project name
    const handleProjectNameChange = (e) => {
        setCreateFormData((prev) => ({ ...prev, name: e.target.value }));
    };

    // Function to handle the change of the selected technology
    const handleTechnologyChange = (e) => {
        setCreateFormData((prev) => ({ ...prev, technology: e.target.value }));
    };

    const handleFormValidation = async (event, name, technology, oldName = "") => {
        // Return false if the validation didn't pass

        event.preventDefault();
        setLoadingValidation(true);

        if (!name.trim()) {
            setLoadingValidation(false);
            return false;
        }

        if (!technology) {
            setLoadingValidation(false);
            return false;
        }

        if (oldName && name === oldName) {
            setLoadingValidation(false);
            return true;
        }

        const existsResponse = await checkProjectName(name);
        if (existsResponse.exists) {
            setValidationErrors({ name: 'Project name already exists' });
            setLoadingValidation(false);
            return false;
        }

        setValidationErrors({});
        setLoadingValidation(false);
        return true;
    };


    // Function to handle the creation of a new project
    const handleCreateProject = async (event) => {
        event.preventDefault();
        const newProjectName = createFormData.name;
        const technology = createFormData.technology;

        // Validation
        const isValid = await handleFormValidation(event, newProjectName, technology);

        if (!isValid) {
            return;
        }

        // Create the new project
        try {
            const newProject = await createProject({
                name: newProjectName,
                chatbot_technology: technology,
            });
            await reloadProjects();
            handleFormReset();
            setIsCreateOpen(false);

        } catch (error) {
            console.error('Error creating project:', error);
            //alert(`Error updating project: ${error.message}`);

            const errorData = JSON.parse(error.message);
            // Format the data
            const errors = Object.entries(errorData).map(([key, value]) => `${key}: ${value}`);
            alert(`Error creating project: ${errors.join('\n')}`);
        }
    };


    // Handle the edit project modal
    const handleEditClick = (project) => {
        setEditProjectId(project.id);
        setOriginalName(project.name);

        setEditFormData({
            name: project.name,
            technology: project.chatbot_technology,
        });

        //console.log('project technology:', project.chatbot_technology);
        //console.log('edit form data:', editFormData);
        setIsEditOpen(true);
    };

    // Function to handle the edit project modal
    const handleUpdateProject = async (event) => {
        event.preventDefault();

        // Validation
        const isValid = await handleFormValidation(event, editFormData.name, editFormData.technology, originalName);
        if (!isValid) {
            return;
        }

        try {
            await updateProject(editProjectId, {
                name: editFormData.name,
                chatbot_technology: editFormData.technology,
            });
            setIsEditOpen(false);
            reloadProjects();
        } catch (error) {
            console.error('Error updating project:', error);
            //alert(`Error updating project: ${error.message}`);

            const errorData = JSON.parse(error.message);
            // Format the data
            const errors = Object.entries(errorData).map(([key, value]) => `${key}: ${value}`);
            alert(`Error updating project: ${errors.join('\n')}`);
        }
    };
    // Function to handle the deletion
    const handleProjectDelete = async (projectId) => {
        if (!window.confirm('Are you sure you want to delete this project?')) {
            return;
        }

        try {
            await deleteProject(projectId);
            await reloadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
            alert(`Error deleting project: ${error.message}`);
        }
    }

    // Function to reset the form
    const handleEditFormReset = () => {
        setEditFormData({
            name: '',
            technology: '',
        });
    };

    // Function to reset the form
    const handleFormReset = () => {
        setCreateFormData({
            name: '',
            technology: '',
        });
    };

    /* Columns */
    const columns = [
        { name: 'Name', key: 'name', sortable: true },
        { name: 'Technology', key: 'technology', sortable: true },
        { name: 'Actions', key: 'actions' },
    ];

    const [sortDescriptor, setSortDescriptor] = useState({
        column: 'name',
        direction: 'ascending',
    });

    const sortedProjects = useMemo(() => {
        const { column, direction } = sortDescriptor;
        return [...projects].sort((a, b) => {
            const first = column === 'technology'
                ? technologies.find(t => t.id === a.chatbot_technology)?.name ?? ''
                : a[column] ?? '';
            const second = column === 'technology'
                ? technologies.find(t => t.id === b.chatbot_technology)?.name ?? ''
                : b[column] ?? '';
            const cmp = first < second ? -1 : first > second ? 1 : 0;
            return direction === 'descending' ? -cmp : cmp;
        });
    }, [projects, technologies, sortDescriptor]);

    return (
        <div className="p-4 sm:p-6 lg:p-8
        flex flex-col
        space-y-4 sm:space-y-6
        max-w-full sm:max-w-4xl
        mx-auto
        my-auto
        max-h-[90vh]">
            <h1 className="text-2xl sm:text-3xl font-bold text-center">Projects</h1>

            {/* Selected project */}
            <div className="flex items-center justify-center gap-2">
                <span className="font-semibold">Selected Project:</span>
                <span>{selectedProject?.name || 'None'}</span>
            </div>


            {/* Modal to create new project */}
            <CreateProjectModal
                isOpen={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                technologies={technologies}
                onProjectCreated={async (newProject) => {
                    await reloadProjects();
                    setSelectedProject(newProject);
                }}
            />

            <h2 className='text-xl sm:text-2xl font-bold text-center'>My Projects:</h2>
            {/* Table of projects */}
            <Table
                aria-label="Projects Table"
                className='max-h-[60vh] sm:max-h-[50vh] overflow-y-auto'
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
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
                    emptyState="Create a new project to get started."
                    isLoading={loading}
                    loadingContent={<Spinner label='Loading Test Cases...' />}
                    items={sortedProjects}
                >
                    {sortedProjects.map((project) => (
                        <TableRow key={project.id}>
                            <TableCell>{project.name}</TableCell>
                            <TableCell>
                                {technologies.find(t => t.id === project.chatbot_technology)?.name || 'Loading...'}
                            </TableCell>
                            <TableCell className='flex space-x-1 sm:space-x-2 px-2 sm:px-4'>
                                <Button
                                    size="sm"
                                    color="primary"
                                    variant='ghost'
                                    onPress={() => setSelectedProject(project)}
                                    isDisabled={selectedProject?.id === project.id}
                                >
                                    {selectedProject?.id === project.id ? 'Selected' : 'Select'}
                                </Button>
                                <Button size="sm" color="secondary" variant='ghost' className="w-12" onPress={() => handleEditClick(project)}>
                                    Edit
                                </Button>
                                <Button size="sm" color="danger" variant='ghost' className="w-12" onPress={() => handleProjectDelete(project.id)}>
                                    Delete
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Button to open modal */}
            <Button color="primary"
                className="max-w-full sm:max-w-[200px] mx-auto h-10 sm:h-12"
                onPress={() => setIsCreateOpen(true)}
            >
                Create New Project
            </Button>

            {/* Modal to edit project */}
            <Modal isOpen={isEditOpen}
                onOpenChange={() => {
                    setIsEditOpen(false);
                    handleEditFormReset();
                    setValidationErrors({});
                }}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1 items-center">
                                Edit Project
                            </ModalHeader>
                            <ModalBody className="flex flex-col gap-4 items-center">
                                <Form
                                    className="w-full flex flex-col gap-4"
                                    onSubmit={handleUpdateProject}
                                    onReset={handleEditFormReset}
                                    validationBehavior="native"
                                    validationErrors={validationErrors}
                                >
                                    <Input
                                        placeholder="Enter project name"
                                        name="name"
                                        fullWidth
                                        isRequired
                                        labelPlacement="outside"
                                        value={editFormData.name}
                                        variant="bordered"
                                        label="Project Name"
                                        onChange={(e) => { setEditFormData((prev) => ({ ...prev, name: e.target.value })) }}
                                        maxLength={255}
                                        minLength={3}
                                    />
                                    <Select
                                        isRequired
                                        label="Technology"
                                        labelPlacement="outside"
                                        placeholder="Select Technology"
                                        name="technology"
                                        value={editFormData.technology}
                                        onChange={(e) => { setEditFormData((prev) => ({ ...prev, technology: e.target.value })) }}
                                        selectedKeys={[String(editFormData?.technology)]}

                                    >
                                        {technologies.map((tech) => (
                                            <SelectItem key={String(tech.id)} value={String(tech.id)}>
                                                {tech.name}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                    <ModalFooter className="w-full flex justify-center gap-4">
                                        <Button type="reset" color="danger" variant="light">
                                            Reset
                                        </Button>
                                        <Button
                                            type="submit"
                                            color="primary"
                                            isDisabled={editFormData.name.trim() === '' || editFormData.technology === ''}
                                        >
                                            Update
                                        </Button>
                                    </ModalFooter>
                                </Form>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}


export default ProjectsDashboard;
