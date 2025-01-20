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
} from "@nextui-org/react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@nextui-org/react";
import CreateProjectModal from '../components/CreateProjectModal';
import useFetchProjects from '../hooks/useFetchProjects';
import { fetchChatbotTechnologies } from '../api/chatbotTechnologyApi';
import { createProject, deleteProject, updateProject } from '../api/projectApi';
import EditProjectModal from '../components/EditProjectModal';


const ProjectsDashboard = () => {

    // State of the modal to create new project
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    // State of the new project name
    const [newProjectName, setNewProjectName] = useState('');

    // State of the selected technology
    const [technology, setTechnology] = useState('');

    // Projects state
    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects();

    // State of the modal to edit project
    const { isOpen: isEditOpen, onOpen: onEditOpen, onOpenChange: onEditOpenChange } = useDisclosure();

    // State of the available technologies
    const [availableTechnologies, setAvailableTechnologies] = useState([]);

    // State with a map of the available technologies so they can be accessed easily
    const [technologyMap, setTechnologyMap] = useState({});


    // State with the id of the project to edit
    const [editProjectId, setEditProjectId] = useState(null);

    // State with the project name and technology to edit
    const [editProjectName, setEditProjectName] = useState('');
    const [editTechnology, setEditTechnology] = useState('');


    // Init the available technologies and projects
    useEffect(() => {
        const loadTechnologies = async () => {
            try {
                const technologies = await fetchChatbotTechnologies();
                setAvailableTechnologies(technologies);

                // Build a map for quick lookups
                const techMap = technologies.reduce((acc, tech) => {
                    acc[tech.id] = tech.name;
                    return acc;
                }, {});
                setTechnologyMap(techMap);
            } catch (error) {
                console.error('Error fetching technologies:', error);
                alert(`Error fetching technologies: ${error.message}`);
            }
        };

        loadTechnologies();
    }, []);



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
        setEditProjectName(project.name);
        setEditTechnology(project.chatbot_technology || '');
        console.log('project technology:', project.chatbot_technology);
        onEditOpen();
    };

    // Function to handle the edit project modal
    const handleUpdateProject = async (event) => {
        event.preventDefault();
        try {
            await updateProject(editProjectId, {
                name: editProjectName,
                chatbot_technology: editTechnology,
            });
            onEditOpenChange(false);
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
    const handleFormReset = () => {
        setNewProjectName('');
        setTechnology('');
    };

    /* Columns */
    const columns = [
        { name: 'Name', key: 'name' },
        { name: 'Technology', key: 'technology' },
        { name: 'Actions', key: 'actions' },
    ]

    return (
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col space-y-4 sm:space-y-6 max-w-full sm:max-w-4xl mx-auto max-h-[80vh]">
            <h1 className="text-2xl sm:text-3xl font-bold text-center">Projects</h1>

            {/* Button to open modal */}
            <Button color="primary" onPress={onOpen}
                className="max-w-full sm:max-w-[200px] mx-auto"
            >
                Create New Project
            </Button>

            {/* Modal to create new project */}
            <CreateProjectModal
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                handleCreateProject={handleCreateProject}
                handleFormReset={handleFormReset}
                newProjectName={newProjectName}
                handleProjectNameChange={handleProjectNameChange}
                availableTechnologies={availableTechnologies}
                technology={technology}
                handleTechnologyChange={handleTechnologyChange}
            />

            <h2 className='text-xl sm:text-2xl font-bold text-center'>My Projects:</h2>
            {/* Table of projects */}
            <Table aria-label="Projects Table"
                className="overflow-x-auto">
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
                <TableBody>
                    {projects.map(project => (
                        <TableRow key={project.id}>
                            <TableCell className="px-2 sm:px-4">{project.name}</TableCell>
                            <TableCell className="px-2 sm:px-4">
                                {technologyMap[project.chatbot_technology] || project.chatbot_technology}
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

            {/* Modal to edit project */}
            <EditProjectModal
                isOpen={isEditOpen}
                onOpenChange={onEditOpenChange}
                handleEditProject={handleUpdateProject}
                handleFormReset={() => {
                    setEditProjectName('');
                    setEditTechnology('');
                }}
                newProjectName={editProjectName}
                handleProjectNameChange={(e) => setEditProjectName(e.target.value)}
                availableTechnologies={availableTechnologies}
                technology={editTechnology}
                handleTechnologyChange={(e) => setEditTechnology(e.target.value)}
            />
        </div>
    );
}

export default ProjectsDashboard;
