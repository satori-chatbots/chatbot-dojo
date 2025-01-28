import React, { useEffect, useRef, useState } from 'react';
import {
    Button,
    Input,
    Card,
    Dropdown,
    Modal,
    ModalContent,
    ModalFooter,
    ModalBody,
    DropdownItem,
    DropdownTrigger,
    DropdownMenu,
    ModalHeader,
    useDisclosure,
    Select,
    SelectItem,
    Form
} from "@heroui/react";
import useFileHandlers from '../hooks/userFileHandlers';
import { uploadFiles } from '../api/fileApi';
import { MEDIA_URL } from '../api/config';
import { createProject, deleteProject } from '../api/projectApi';
import { HiOutlineTrash } from "react-icons/hi";
import { fetchChatbotTechnologies } from '../api/chatbotTechnologyApi';
import useFetchProjects from '../hooks/useFetchProjects';
import useFetchFiles from '../hooks/useFetchFiles';
import { executeTest } from '../api/testCasesApi';
import { deleteFiles } from '../api/fileApi';
import CreateProjectModal from './CreateProjectModal';
import { checkTestCaseName } from '../api/testCasesApi';

function UserProfileManager() {

    // List of available chatbot technologies (eg Taskyto, Rasa, etc.)
    const [availableTechnologies, setAvailableTechnologies] = useState([]);

    // Fetch the list of projects
    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects();

    // Control the selected project
    const [selectedProject, setSelectedProject] = useState(null);

    // Control the project creation modal
    const [newProjectName, setNewProjectName] = useState('');
    const [technology, setTechnology] = useState('');

    // Controls if the modal is open or not
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    // List of files selected with checkboxes
    const [selectedFiles, setSelectedFiles] = useState([]);

    // List of files to upload
    const fileInputRef = useRef(null);

    // State to control the modal for the execution name
    const [isExecuteOpen, setIsExecuteOpen] = useState(false);

    const [executionName, setExecutionName] = useState('');


    const [selectedUploadFiles, setSelectedUploadFiles] = useState(null);

    // List of files in the selected project
    const { files, loading, error, reloadFiles } = useFetchFiles(selectedProject ? selectedProject.id : null);

    // Loading state for the serverside validation
    const [loadingValidation, setLoadingValidation] = useState(false);

    // Errors for the serverside validation
    const [validationErrors, setValidationErrors] = useState({});


    // Initialize with the available technologies
    useEffect(() => {
        const loadData = async () => {
            try {
                const technologies = await fetchChatbotTechnologies();
                //console.log(technologies);
                setAvailableTechnologies(technologies);

            } catch (error) {
                console.error('Error loading data:', error);
            }
        };

        loadData();
    }, []);


    /* ------------------------------------------------------ */
    /* ------------------ File Handlers --------------------- */
    /* ------------------------------------------------------ */

    // This is for the checkboxes
    const selectFile = (id) => {
        setSelectedFiles((prev) =>
            prev.includes(id) ? prev.filter((fileId) => fileId !== id) : [...prev, id]
        );
    };


    const handleFileChange = (event) => {
        setSelectedUploadFiles(event.target.files);
    };

    // Handle upload
    const handleUpload = () => {
        if (!selectedUploadFiles || selectedUploadFiles.length === 0) {
            alert('Please select files to upload.');
            return;
        }

        const formData = new FormData();
        for (let i = 0; i < selectedUploadFiles.length; i++) {
            formData.append('file', selectedUploadFiles[i]);
        }

        formData.append('project', selectedProject.id);
        //console.log(formData);
        uploadFiles(formData)
            .then(() => {
                reloadFiles(); // Refresh the file list
                setSelectedUploadFiles(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = null; // Clear the file input
                }
            })
            .catch(error => {
                console.error('Error uploading files:', error);
                alert('Error uploading files:\n' + error.message);
            });
    };

    // Delete selected files
    const handleDelete = () => {
        if (selectedFiles.length === 0) {
            alert('No files selected for deletion.');
            return;
        }

        if (!window.confirm('Are you sure you want to delete the selected files?')) {
            return;
        }

        deleteFiles(selectedFiles)
            .then(() => {
                setSelectedFiles([]);
                reloadFiles();
            })
            .catch((error) => {
                console.error('Error deleting files:', error);
                alert('Error deleting files.');
            });
    };

    // Open the modal for the execution name
    const openExecuteModal = () => {
        if (selectedFiles.length === 0) {
            alert('No files selected for test execution.');
            return;
        }

        if (!selectedProject) {
            alert('Please select a project to execute the test.');
            return;
        }

        setIsExecuteOpen(true);
    };

    // Handle the submit of the execution name
    const handleSubmitPressed = async (e) => {
        // Prevent the reload
        e.preventDefault();

        setLoadingValidation(true);

        //console.log("checkpoint");
        //console.log("name:", executionName);

        // If user left the name blank, skip validation
        if (!executionName.trim()) {
            setValidationErrors({});
            setLoadingValidation(false);
            handleExecuteTest();
            return;
        }

        // Otherwise, check if this name exists
        const existsResponse = await checkTestCaseName(selectedProject.id, executionName.trim());
        //console.log("exists:", existsResponse);

        if (existsResponse.exists) {
            // Name already taken
            setValidationErrors({ name: 'This name is already taken, choose another one or leave it blank for auto-generation.' });
        } else {
            // Name is fine, proceed
            setValidationErrors({});
            handleExecuteTest();
        }

        setLoadingValidation(false);
    };

    // Execute test on selected files and project
    const handleExecuteTest = () => {

        const finalName = executionName.trim();

        console.log('Name:', finalName);

        executeTest(selectedFiles, selectedProject.id, finalName)
            .then((data) => {
                alert(data.message);
                setIsExecuteOpen(false);
                setExecutionName('');
            })
            .catch((error) => {
                console.error('Error executing test:', error);
                alert(`Error executing test: ${error.message}`);
            });
    };


    /* ------------------------------------------------------ */
    /* ------------------ Project Handlers ------------------ */
    /* ------------------------------------------------------ */

    const handleProjectChange = (projectId) => {
        const project = projects.find(project => project.id === projectId);
        setSelectedProject(project);

        // Clear the selected files
        setSelectedFiles([]);

        // Reload the files
        reloadFiles();


    };

    // For the project creation (name)
    const handleProjectNameChange = (event) => {
        setNewProjectName(event.target.value);


    };

    // For the project creation (technology)
    const handleTechnologyChange = (event) => {
        setTechnology(event.target.value);
    };


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

        try {
            const newProject = await createProject({
                name: newProjectName,
                chatbot_technology: technology,
            });
            await reloadProjects();
            setSelectedProject(newProject);
            handleFormReset();
            onOpenChange(false);
        } catch (error) {
            console.error('Error creating project:', error);
            alert(`Error creating project: ${error.message}`);
        }
    };

    const handleProjectDelete = async (projectId) => {
        if (!window.confirm('Are you sure you want to delete this project?')) {
            return;
        }
        try {
            await deleteProject(projectId);
            await reloadProjects();
            setSelectedProject(null);
        } catch (error) {
            console.error('Error deleting project:', error);
            alert('Error deleting project.');
        }
    }

    const handleFormReset = () => {
        setNewProjectName('');
        setTechnology('');
    }


    return (
        <Card className="p-6 flex-col space-y-6 max-w-lg mx-auto w-full">
            {/* Header */}
            <h1 className="text-3xl font-bold text-center">User Profiles</h1>

            {/* Project Dropdown */}
            <div className="flex flex-col space-y-4">
                <Dropdown className="full-width" aria-label="Select Project" >
                    <DropdownTrigger>
                        <Button color="secondary" variant="bordered">
                            {selectedProject ? selectedProject.name : 'Select Project'}
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        className="max-h-[50vh] overflow-y-auto max-w-md"
                    >
                        <DropdownItem onPress={() => onOpen()} className='text-primary' color='primary'>
                            Create New Project
                        </DropdownItem>
                        {projects && projects.map(project => (
                            <DropdownItem
                                key={project.id}
                                onPress={() => handleProjectChange(project.id)}

                                endContent={
                                    <Button color="danger"
                                        variant="light"
                                        className="h-6 w-6 p-1 py-0.5 rounded-md text-tiny"
                                        onPress={() => handleProjectDelete(project.id)}>
                                        <HiOutlineTrash
                                            className="w-4"
                                            color='red'
                                        />

                                    </Button>
                                }
                            >
                                {project.name}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            </div>

            {/* Create Project Modal */}
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

            {/* Project Details */}
            {selectedProject ? (
                <div>
                    {/* Upload Section */}
                    <div className="flex flex-col space-y-4">
                        <Input
                            type="file"
                            multiple
                            accept=".yaml,.yml"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            fullWidth
                        />
                        <Button onPress={handleUpload} color="secondary" fullWidth>
                            Upload
                        </Button>
                    </div>

                    {/* List Section */}
                    <div className="flex-1 overflow-y-auto mt-4">
                        {files.length > 0 ? (
                            <ul className="space-y-2">
                                {files.map(file => (
                                    <li key={file.id} className="flex flex-col space-y-1">
                                        <div className="flex items-start space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedFiles.includes(file.id)}
                                                onChange={() => selectFile(file.id)}
                                                className="form-checkbox h-4 w-4 mt-1"
                                            />
                                            <a
                                                href={`${file.file}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:underline flex-1 break-words max-w-sm md:max-w-lg lg:max-w-2xl"
                                            >
                                                {file.name}
                                            </a>
                                        </div>
                                        <p className="text-gray-600 text-sm ml-6">
                                            {file.file.split('/').pop()}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 text-center">No profiles uploaded yet.</p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 flex space-x-4">
                        <Button color="danger" className="flex-1" onPress={handleDelete}>
                            Delete Selected
                        </Button>
                        <Button color="primary" className="flex-1" onPress={openExecuteModal}>
                            Execute Test
                        </Button>
                    </div>
                </div>
            ) : (
                <p className="text-gray-500 text-center">Select a project to start working!</p>
            )}

            {/* Modal execution name */}
            <Modal isOpen={isExecuteOpen} onOpenChange={setIsExecuteOpen}>
                <ModalContent>
                    <ModalHeader>Execute Test</ModalHeader>
                    <ModalBody className="flex flex-col gap-4 items-center">
                        <Form
                            className='w-full'
                            onSubmit={handleSubmitPressed}
                            onReset={() => setIsExecuteOpen(false)}
                            validationErrors={validationErrors}
                        >
                            <Input
                                name="name"
                                label="Execution Name (optional)"
                                value={executionName}
                                onValueChange={setExecutionName}
                                isDisabled={loadingValidation}
                            />
                            <ModalFooter className="w-full flex justify-center gap-4">
                                <Button type="reset" color="danger" variant="light">
                                    Cancel
                                </Button>
                                <Button type="submit" color="primary">
                                    Execute
                                </Button>
                            </ModalFooter>
                        </Form>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </Card>
    );
};





export default UserProfileManager;
