import React, { useState, useEffect } from 'react';
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
} from "@heroui/react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import CreateProjectModal from '../components/CreateProjectModal';
import useFetchProjects from '../hooks/useFetchProjects';
import { fetchChatbotTechnologies, fetchTechnologyChoices } from '../api/chatbotTechnologyApi';
import { createProject, deleteProject, updateProject } from '../api/projectApi';
import EditProjectModal from '../components/EditProjectModal';


const ProjectsDashboard = () => {

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
    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects();

    const [technologies, setTechnologies] = useState([]);

    // State with the id of the project to edit
    const [editProjectId, setEditProjectId] = useState(null);

    // Init the available technologies and projects
    useEffect(() => {
        loadTechnologies();

    }, []);

    const loadTechnologies = async () => {
        try {
            const technologies = await fetchChatbotTechnologies();
            setTechnologies(technologies);
            // console.log('technologies:', technologies);

        } catch (error) {
            console.error('Error fetching technologies:', error);
        }
    };



    /* ------------------------------------- */
    /* -------------- HANDLERS ------------- */
    /* ------------------------------------- */

    // Function to handle the change of the new project name
    const handleProjectNameChange = (e) => {
        setNewProjectName(e.target.value);
    };

    // Function to handle the change of the selected technology
    const handleTechnologyChange = (e) => {
        setTechnology(e.target.value);
    };

    // Function to handle the creation of a new project
    const handleCreateProject = async (event) => {
        event.preventDefault();
        const newProjectName = createFormData.name;
        const technology = createFormData.technology;

        if (!newProjectName.trim()) {
            alert('Please enter a project name.');
            return;
        }

        if (!technology) {
            alert('Please select a technology.');
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
            onOpenChange(false);

        } catch (error) {
            console.error('Error creating project:', error);
            alert(`Error creating project: ${error.message}`);
        }
    };

    // Handle the edit project modal
    const handleEditClick = (project) => {
        setEditProjectId(project.id);

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

        if (!editFormData.name.trim()) {
            alert('Please enter a project name.');
            return;
        }

        if (!editFormData.technology) {
            alert('Please select a technology.');
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
            alert(`Error updating project: ${error.message}`);
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

    /* Columns */
    const columns = [
        { name: 'Name', key: 'name' },
        { name: 'Technology', key: 'technology' },
        { name: 'Actions', key: 'actions' },
    ]

    return (
        <div className="p-4 sm:p-6 lg:p-8
        flex flex-col
        space-y-4 sm:space-y-6
        max-w-full sm:max-w-4xl
        mx-auto
        my-auto
        max-h-[90vh]">
            <h1 className="text-2xl sm:text-3xl font-bold text-center">Projects</h1>



            {/* Modal to create new project */}
            <Modal isOpen={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader className="flex flex-col gap-1 items-center">
                                Create New Project
                            </ModalHeader>
                            <ModalBody className="flex flex-col gap-4 items-center">
                                <Form
                                    className="w-full flex flex-col gap-4"
                                    onSubmit={handleCreateProject}
                                    onReset={handleFormReset}
                                    validationBehavior="native"
                                >
                                    <Input
                                        placeholder="Enter project name"
                                        fullWidth
                                        isRequired
                                        labelPlacement="outside"
                                        value={createFormData.name}
                                        variant="bordered"
                                        label="Project Name"
                                        onChange={handleProjectNameChange}
                                        errorMessage="Please enter a project name"
                                        maxLength={255}
                                        minLength={3}
                                    />
                                    <Select
                                        placeholder="Select chatbot technology"
                                        fullWidth
                                        label="Technology"
                                        labelPlacement="outside"
                                        onChange={handleTechnologyChange}
                                        isRequired
                                        value={createFormData.technology}
                                    >
                                        {technologies.map((tech) => (
                                            <SelectItem key={tech.id} value={tech.name}>
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
                                            isDisabled={createFormData.name.trim() === '' || createFormData.technology === ''}
                                        >
                                            Create
                                        </Button>
                                    </ModalFooter>
                                </Form>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <h2 className='text-xl sm:text-2xl font-bold text-center'>My Projects:</h2>
            {/* Table of projects */}
            <Table aria-label="Projects Table"
                className='max-h-[60vh] sm:max-h-[50vh] overflow-y-auto'>
                <TableHeader columns={columns}>
                    <TableColumn key="name" allowsSorting>
                        Name
                    </TableColumn>
                    <TableColumn key="technology" allowsSorting>
                        Technology
                    </TableColumn>
                    <TableColumn className='text-center'
                        key="actions">
                        Actions
                    </TableColumn>
                </TableHeader>
                <TableBody
                    emptyState="Create a new project to get started.">
                    {projects.map(project => (
                        <TableRow key={project.id}>
                            <TableCell className="px-2 sm:px-4">{project.name}</TableCell>
                            <TableCell className="px-2 sm:px-4">
                                {technologies.find(tech => tech.id === project.chatbot_technology)?.name || 'Loading...'}
                            </TableCell>
                            <TableCell className='flex space-x-1 sm:space-x-2 px-2 sm:px-4'>
                                <Button size="sm" color="secondary" variant='ghost' onPress={() => handleEditClick(project)}>
                                    Edit
                                </Button>
                                <Button size="sm" color="danger" variant='ghost' onPress={() => handleProjectDelete(project.id)}>
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
            >
                Create New Project
            </Button>

            {/* Modal to edit project */}
            <Modal isOpen={isEditOpen} onOpenChange={setIsEditOpen}>
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
                                >
                                    <Input
                                        placeholder="Enter project name"
                                        fullWidth
                                        isRequired
                                        labelPlacement="outside"
                                        value={editFormData.name}
                                        variant="bordered"
                                        label="Project Name"
                                        onChange={(e) => { setEditFormData((prev) => ({ ...prev, name: e.target.value })) }}
                                        errorMessage="Please enter a project name"
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
