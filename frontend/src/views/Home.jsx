import React, { useEffect, useRef, useState } from 'react';
import {
    Button,
    Input,
    Card,
    Modal,
    ModalContent,
    ModalFooter,
    ModalBody,
    ModalHeader,
    Form,
    useDisclosure,
    Link,
} from "@heroui/react";
import {
    Upload,
    File,
    Edit,
    Trash,
    Play,
    Plus,
    X
} from 'lucide-react';
import { uploadFiles, deleteFiles } from '../api/fileApi';
import { createProject, deleteProject, updateProject, checkProjectName } from '../api/projectApi';
import { fetchChatbotTechnologies } from '../api/chatbotTechnologyApi';
import useFetchProjects from '../hooks/useFetchProjects';
import useFetchFiles from '../hooks/useFetchFiles';
import { executeTest, checkTestCaseName } from '../api/testCasesApi';
import useSelectedProject from '../hooks/useSelectedProject';
import CreateProjectModal from '../components/CreateProjectModal';
import EditProjectModal from '../components/EditProjectModal';
import ProjectsList from '../components/ProjectList';
import { useMyCustomToast } from '../contexts/MyCustomToastContext';
import { useNavigate } from 'react-router-dom';


function Home() {

    const { showToast } = useMyCustomToast();

    // List of available chatbot technologies (eg Taskyto, Rasa, etc.)
    const [availableTechnologies, setAvailableTechnologies] = useState([]);
    const [loadingTechnologies, setLoadingTechnologies] = useState(true);

    // Fetch the list of projects
    const { projects, loadingProjects, errorProjects, reloadProjects } = useFetchProjects('owned');

    // Control the selected project
    const [selectedProject, setSelectedProject] = useSelectedProject();

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

    // Loading state for the serverside validation of the execution name
    const [loadingValidation, setLoadingValidation] = useState(false);

    // Errors for the serverside validation of the execution name
    const [validationErrors, setValidationErrors] = useState({});

    // Loading state for the serverside validation of the project
    const [loadingProjectValidation, setLoadingProjectValidation] = useState(false);

    // Errors for the serverside validation of the project
    const [projectValidationErrors, setProjectValidationErrors] = useState({});

    // Success modal
    const [successModal, setSuccessModal] = useState({ isOpen: false, message: '' });

    // Navigation
    const navigate = useNavigate();

    // Delete project modal
    const [deleteProjectModal, setDeleteProjectModal] = useState({
        isOpen: false,
        isLoading: false,
        projectId: null
    });

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({
        name: '',
        technology: '',
    });
    const [editProjectId, setEditProjectId] = useState(null);

    const handleEditClick = (project) => {
        setEditProjectId(project.id);
        setOriginalName(project.name);
        setEditFormData({
            name: project.name,
            technology: project.chatbot_technology,
        });
        setIsEditOpen(true);
    };

    const handleFormValidation = async (event, name, technology, oldName = "") => {
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

    const [originalName, setOriginalName] = useState('');



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
            await reloadProjects();
        } catch (error) {
            console.error('Error updating project:', error);
            const errorData = JSON.parse(error.message);
            const errors = Object.entries(errorData).map(([key, value]) => `${key}: ${value}`);
            alert(`Error updating project: ${errors.join('\n')}`);
        }
    };

    const handleEditFormReset = () => {
        setEditFormData({
            name: '',
            technology: '',
        });
    };



    // Delete confirm modal
    const [deleteConfirmModal, setDeleteConfirmModal] = useState({
        isOpen: false,
        isLoading: false
    });


    // Initialize with the available technologies
    useEffect(() => {
        const loadData = async () => {
            setLoadingTechnologies(true);
            try {
                const technologies = await fetchChatbotTechnologies();
                //console.log(technologies);
                setAvailableTechnologies(technologies);

            } catch (error) {
                console.error('Error loading data:', error);
                showToast('error', 'Error loading technologies.');
            } finally {
                setLoadingTechnologies(false);
            }
        };

        loadData();
    }, []);

    // Load
    useEffect(() => {
        if (selectedProject && projects.length > 0) {
            // Verify project still exists
            const project = projects.find(p => p.id === selectedProject.id);
            if (project) {
                setSelectedProject(project);
                reloadFiles();
            } else {
                setSelectedProject(null);
            }
        }
    }, [projects]);


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
                showToast('success', 'Files uploaded successfully!');
            })
            .catch(error => {
                console.error('Error uploading files:', error);
                try {
                    const errorObj = JSON.parse(error.message);
                    if (errorObj.errors) {
                        const errorMessages = errorObj.errors.map(err =>
                            `Error: ${err.error}`
                        ).join('\n');
                        showToast('error', errorMessages);
                    } else {
                        showToast('error', 'Error uploading files');
                    }
                } catch (e) {
                    showToast('error', 'Error uploading files');
                }
            });
    };

    // Delete selected files
    // Replace handleDelete implementation
    const handleDelete = () => {
        if (selectedFiles.length === 0) {
            alert('No files selected for deletion.');
            return;
        }
        setDeleteConfirmModal({ isOpen: true, isLoading: false });
    };

    const confirmDelete = async () => {
        setDeleteConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
            await deleteFiles(selectedFiles);
            setSelectedFiles([]);
            reloadFiles();
            showToast('success', 'Files deleted successfully!');
        } catch (error) {
            console.error('Error deleting files:', error);
            showToast('error', 'Error deleting files.');
        } finally {
            setDeleteConfirmModal({ isOpen: false, isLoading: false });
        }
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

        executeTest(selectedFiles, selectedProject.id, finalName)
            .then((data) => {
                showToast('success', data.message);
                setIsExecuteOpen(false);
                setExecutionName('');
            })
            .catch((error) => {
                console.error('Error executing test:', error);
                showToast('error', `Error executing test: ${error.message}`);
            });
    };



    /* ------------------------------------------------------ */
    /* ------------------ Project Handlers ------------------ */
    /* ------------------------------------------------------ */

    const handleProjectChange = (projectId) => {
        const project = projects.find(project => project.id === projectId);
        setSelectedProject(project);
        setSelectedFiles([]);
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

    const handleProjectValidation = async (event, name, technology) => {
        event.preventDefault();

        setLoadingProjectValidation(true);

        if (!name.trim()) {
            return false;
        }

        if (!technology) {
            return false;
        }

        const existsResponse = await checkProjectName(name.trim());
        if (existsResponse.exists) {
            setProjectValidationErrors({ name: 'This name is already taken, choose another one.' });
            return false;
        }

        setProjectValidationErrors({});
        return true;
    };


    const handleCreateProject = async (event) => {
        event.preventDefault();

        const isValid = await handleProjectValidation(event, newProjectName, technology);
        if (!isValid) {
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
            showToast('success', 'Project created successfully!');
        } catch (error) {
            console.error('Error creating project:', error);
            showToast('error', `Error creating project: ${error.message}`);
        }
    };

    const handleProjectDelete = (projectId) => {
        setDeleteProjectModal({
            isOpen: true,
            isLoading: false,
            projectId
        });
    };

    const confirmProjectDelete = async () => {
        setDeleteProjectModal(prev => ({ ...prev, isLoading: true }));
        try {
            await deleteProject(deleteProjectModal.projectId);
            await reloadProjects();
            setSelectedProject(null);
            showToast('success', 'Project deleted successfully!');
        } catch (error) {
            console.error('Error deleting project:', error);
            showToast('error', 'Error deleting project.');
        } finally {
            setDeleteProjectModal({ isOpen: false, isLoading: false, projectId: null });
        }
    };


    const handleFormReset = () => {
        setNewProjectName('');
        setTechnology('');
    }


    return (
        <div className="flex flex-col
        items-center justify-center
        p-6
        w-full
        ">
            {selectedProject ? (

                <Card className="p-6 flex-col space-y-6 max-w-lg mx-auto w-full">
                    {/* Header */}
                    <h1 className="text-3xl font-bold text-center">{selectedProject.name}</h1>


                    {/* Project Dropdown */}
                    <div className="flex flex-col space-y-4">
                        <Button
                            color="secondary"
                            variant="bordered"
                            onPress={() => setSelectedProject(null)}
                            startContent={<X className="w-4 h-4" />}
                        >
                            Change Project
                        </Button>
                    </div>




                    {/* Project Details */}
                    {selectedProject ? (
                        <div>
                            {/* Upload Section */}
                            <div className="flex flex-col space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        type="file"
                                        multiple
                                        accept=".yaml,.yml"
                                        onChange={handleFileChange}
                                        ref={fileInputRef}
                                        className="flex-1"
                                    />
                                    <Button
                                        onPress={handleUpload}
                                        startContent={<Upload className="w-4 h-4" />}
                                    >
                                        Upload
                                    </Button>
                                </div>
                                <Button
                                    onPress={() => navigate('/yaml-editor')}
                                    fullWidth
                                    color='secondary'
                                    startContent={<File className="w-4 h-4" />}
                                >
                                    Create New YAML
                                </Button>
                            </div>

                            {/* Create new Profile */}


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
                                                    <Link
                                                        variant="light"
                                                        onPress={() => navigate(`/yaml-editor/${file.id}`)}
                                                        className="flex-1 break-words max-w-sm md:max-w-lg lg:max-w-2xl text-blue-500 hover:underline text-left"
                                                    >
                                                        {file.name}
                                                    </Link>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500 text-center">No profiles uploaded yet.</p>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-4 flex space-x-4">
                                <Button color="danger" className="flex-1" onPress={handleDelete} startContent={<Trash className="w-4 h-4" />}>
                                    Delete Selected
                                </Button>
                                <Button color="primary" className="flex-1" onPress={openExecuteModal} startContent={<Play className="w-4 h-4" />}>
                                    Execute Test
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center">Select a project to start working!</p>
                    )}


                </Card>

            ) : (
                <div className="flex flex-col space-y-4">
                    <h2 className="text-xl font-bold text-center">Select a Project</h2>
                    <ProjectsList
                        projects={projects}
                        technologies={availableTechnologies}
                        loading={loadingProjects || loadingTechnologies}
                        selectedProject={selectedProject}
                        onSelectProject={setSelectedProject}
                        onEditProject={handleEditClick}
                        onDeleteProject={handleProjectDelete}
                    />
                    <Button
                        color="primary"
                        className="max-w-[200px] mx-auto"
                        onPress={() => onOpen()}
                        startContent={<Plus className="w-4 h-4" />}
                    >
                        Create New Project
                    </Button>
                </div>
            )}

            {/* ------------------------------------------------------ */}
            {/* ------------------ Modals ---------------------------- */}
            {/* ------------------------------------------------------ */}

            {/* Create Project Modal */}
            <CreateProjectModal
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                technologies={availableTechnologies}
                onProjectCreated={async (newProject) => {
                    await reloadProjects();
                    setSelectedProject(newProject);
                }}
            />

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
                                {/* Didn't add isLoading={loadingValidation} because it looks werid since it loads instantly */}
                                <Button type="submit" color="primary">
                                    Execute
                                </Button>
                            </ModalFooter>
                        </Form>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* Success Modal */}
            <Modal
                isOpen={successModal.isOpen}
                onOpenChange={(isOpen) => setSuccessModal(prev => ({ ...prev, isOpen }))}
            >
                <ModalContent>
                    <ModalHeader>Test Execution Started</ModalHeader>
                    <ModalBody className="text-gray-600 dark:text-gray-400">
                        {successModal.message}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="primary"
                            onPress={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
                        >
                            Ok
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Confirm Modal */}
            <Modal
                isOpen={deleteConfirmModal.isOpen}
                onOpenChange={(isOpen) => setDeleteConfirmModal(prev => ({ ...prev, isOpen }))}
            >
                <ModalContent>
                    <ModalHeader>Confirm Deletion</ModalHeader>
                    <ModalBody className="text-gray-600 dark:text-gray-400">
                        Are you sure you want to delete the selected files?
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="default"
                            onPress={() => setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }))}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="danger"
                            isLoading={deleteConfirmModal.isLoading}
                            onPress={confirmDelete}
                        >
                            Delete
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Project Modal */}
            <Modal
                isOpen={deleteProjectModal.isOpen}
                onOpenChange={(isOpen) => setDeleteProjectModal(prev => ({ ...prev, isOpen }))}
            >
                <ModalContent>
                    <ModalHeader>Delete Project</ModalHeader>
                    <ModalBody className="text-gray-600 dark:text-gray-400">
                        Are you sure you want to delete this project? This action cannot be undone.
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="default"
                            onPress={() => setDeleteProjectModal(prev => ({ ...prev, isOpen: false }))}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="danger"
                            isLoading={deleteProjectModal.isLoading}
                            onPress={confirmProjectDelete}
                        >
                            Delete Project
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Project Modal */}
            <EditProjectModal
                isOpen={isEditOpen}
                onOpenChange={setIsEditOpen}
                project={editProjectId ? projects.find(p => p.id === editProjectId) : null}
                technologies={availableTechnologies}
                onProjectUpdated={reloadProjects}
            />
        </div>
    );
};





export default Home;
