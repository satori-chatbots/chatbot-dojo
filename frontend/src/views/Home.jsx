import React, { useEffect, useRef, useState, useCallback } from 'react';
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
    X,
    AlertTriangle,
    Sparkles
} from 'lucide-react';
import { uploadFiles, deleteFiles, generateProfiles } from '../api/fileApi';
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
import { useDropzone } from 'react-dropzone';


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

    //
    const [isDragging, setIsDragging] = useState(false);
    const [isFileDragging, setIsFileDragging] = useState(false);

    // Profiles generation states
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [profileGenParams, setProfileGenParams] = useState({
        conversations: 5,
        turns: 5
    });

    const [isGenerating, setIsGenerating] = useState(false);

    const [generationTaskId, setGenerationTaskId] = useState(null);
    const [statusInterval, setStatusInterval] = useState(null);


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


    const handleProfileGenParamChange = (field, value) => {
        setProfileGenParams(prev => ({
            ...prev,
            [field]: parseInt(value) || 0
        }));
    };

    const handleGenerateProfiles = async () => {
        if (!selectedProject) {
            showToast('error', 'Please select a project first');
            return;
        }

        setIsGenerating(true);
        try {
            const response = await generateProfiles(selectedProject.id, {
                conversations: profileGenParams.conversations,
                turns: profileGenParams.turns
            });

            // Start polling for status
            const taskId = response.task_id;
            setGenerationTaskId(taskId);
            pollGenerationStatus(taskId);

            // Close modal but keep "generating" state active
            setIsGenerateModalOpen(false);
            showToast('info', 'Profile generation started. This may take a few minutes.');
        } catch (error) {
            console.error('Error generating profiles:', error);
            let errorMessage = 'Error starting profile generation';

            try {
                const errorData = JSON.parse(error.message);
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                // Use default error message
            }

            showToast('error', errorMessage);
            setIsGenerating(false);
        }
    };

    const pollGenerationStatus = async (taskId) => {
        // Clear any existing interval
        if (statusInterval) {
            clearInterval(statusInterval);
        }

        // Set up interval to check status
        const interval = setInterval(async () => {
            try {
                const status = await checkGenerationStatus(taskId);

                if (status.status === 'COMPLETED') {
                    clearInterval(interval);
                    setStatusInterval(null);

                    // Explicitly reload files when generation completes
                    await reloadFiles();

                    setIsGenerating(false);
                    showToast('success', `Successfully generated ${status.generated_files} profiles!`);
                } else if (status.status === 'ERROR') {
                    clearInterval(interval);
                    setStatusInterval(null);
                    setIsGenerating(false);
                    showToast('error', status.error_message || 'Error generating profiles');
                }
                // If still PENDING or RUNNING, continue polling

            } catch (error) {
                clearInterval(interval);
                setStatusInterval(null);
                setIsGenerating(false);
                showToast('error', 'Error checking generation status');
            }
        }, 3000); // Check every 3 seconds

        setStatusInterval(interval);
    };

    useEffect(() => {
        return () => {
            if (statusInterval) {
                clearInterval(statusInterval);
            }
        };
    }, [statusInterval]);

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

    // Drag and drop handlers
    const onDrop = useCallback((acceptedFiles) => {
        setSelectedUploadFiles(acceptedFiles);
    }, []);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: useCallback((acceptedFiles) => {
            setSelectedUploadFiles(acceptedFiles);
            setIsFileDragging(false);
        }, []),
        accept: {
            'text/yaml': ['.yaml', '.yml']
        },
        noClick: false,
        onDragEnter: () => setIsFileDragging(true),
        onDragLeave: () => setIsFileDragging(false),
        onDropAccepted: () => setIsFileDragging(false),
        onDropRejected: () => setIsFileDragging(false),
    });

    useEffect(() => {
        const handleDragLeave = (e) => {
            if (e.clientX <= 0 || e.clientY <= 0) {
                setIsFileDragging(false);
            }
        };

        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('dragleave', handleDragLeave);
        return () => {
            window.removeEventListener('dragover', (e) => e.preventDefault());
            window.removeEventListener('dragleave', handleDragLeave);
        };
    }, []);

    // This is for the checkboxes
    const selectFile = (id) => {
        setSelectedFiles((prev) =>
            prev.includes(id) ? prev.filter((fileId) => fileId !== id) : [...prev, id]
        );
    };

    const toggleSelectAllFiles = () => {
        if (selectedFiles.length === files.length) {
            // If all files are already selected, deselect all
            setSelectedFiles([]);
        } else {
            // Otherwise, select all files
            setSelectedFiles(files.map(file => file.id));
        }
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
            showToast('error', 'No files selected for test execution.');
            return;
        }

        if (!selectedProject) {
            showToast('error', 'Please select a project to execute the test.');
            return;
        }

        // Check if any of the selected files are invalid
        const invalidFiles = files
            .filter(file => selectedFiles.includes(file.id) && file.is_valid === false)
            .map(file => file.name);

        if (invalidFiles.length > 0) {
            showToast(
                'error',
                `The following files have validation errors and cannot be executed:\n${invalidFiles.join('\n')}`
            );
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
                            color="default"
                            variant="ghost"
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
                                <div
                                    {...getRootProps()}
                                    className={`
                                        border-2 border-dashed rounded-lg p-5
                                        transition-all duration-300 ease-in-out
                                        flex flex-col items-center justify-center
                                        ${isDragActive
                                            ? 'border-primary bg-primary-50 dark:bg-primary-900/20 shadow-lg'
                                            : 'border-gray-300 hover:border-gray-400'
                                        }
                                    `}
                                >
                                    <input {...getInputProps()} />

                                    <div className="flex flex-col items-center gap-2 mb-2">
                                        <Upload
                                            className={`
                                                transition-all duration-300 ease-in-out
                                                ${isDragActive
                                                    ? 'text-primary scale-125 opacity-80'
                                                    : 'text-gray-400 hover:text-gray-500'
                                                }
                                                w-10 h-10
                                            `}
                                        />
                                        <div className="text-center">
                                            <p className={`
                                                text-sm font-medium transition-all duration-300
                                                ${isDragActive ? 'text-primary' : ''}
                                            `}>
                                                {isDragActive ? 'Drop files here' : 'Drag and drop YAML files here'}
                                            </p>
                                            <p className="text-xs mt-0.5 text-gray-500">or click to browse</p>
                                        </div>
                                    </div>

                                    {/* File list part, keep your existing implementation */}
                                    {selectedUploadFiles && selectedUploadFiles.length > 0 && (
                                        <div className="mt-4 w-full">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium">
                                                    {selectedUploadFiles.length === 1
                                                        ? '1 file selected'
                                                        : `${selectedUploadFiles.length} files selected`}
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant="light"
                                                    color="danger"
                                                    onPress={() => {
                                                        setSelectedUploadFiles(null);
                                                        if (fileInputRef.current) {
                                                            fileInputRef.current.value = null;
                                                        }
                                                    }}
                                                >
                                                    Clear
                                                </Button>
                                            </div>

                                            <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-2 max-h-28 overflow-y-auto">
                                                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                                    {Array.from(selectedUploadFiles).map((file, index) => (
                                                        <li key={index} className="truncate flex items-center">
                                                            <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                                                            {file.name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <Button
                                                className="mt-3 w-full"
                                                color="primary"
                                                onPress={handleUpload}
                                                startContent={<Upload className="w-4 h-4" />}
                                            >
                                                Upload {selectedUploadFiles.length > 1 ? `${selectedUploadFiles.length} Files` : 'File'}
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Create New YAML button */}
                                <Button
                                    onPress={() => navigate('/yaml-editor')}
                                    fullWidth
                                    color='secondary'
                                    variant='ghost'
                                    startContent={<File className="w-4 h-4" />}
                                >
                                    Create Profile Manually
                                </Button>

                                {/* Auto generate profiles */}
                                <Button
                                    fullWidth
                                    color='secondary'
                                    variant='ghost'
                                    startContent={isGenerating ? null : <Sparkles className="w-4 h-4" />}
                                    isLoading={isGenerating}
                                    isDisabled={isGenerating}
                                    onPress={() => setIsGenerateModalOpen(true)}
                                >
                                    {isGenerating ? "Generating Profiles..." : "Auto-Generate Profiles"}
                                </Button>
                                {isGenerating && (
                                    <div className="mt-4 border-2 border-primary/20 rounded-lg p-4 flex flex-col items-center">
                                        <Sparkles className="h-8 w-8 text-primary animate-pulse mb-2" />
                                        <h3 className="text-base font-medium mb-1">Generating Profiles</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                                            This might take a few minutes. Please wait...
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* List Section */}
                            <div className="flex-1 overflow-y-auto mt-4">
                                {files.length > 0 ? (
                                    <>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-medium">{files.length} profiles</span>
                                            <Button
                                                size="sm"
                                                variant="light"
                                                color="primary"
                                                onPress={toggleSelectAllFiles}
                                            >
                                                {selectedFiles.length === files.length ? "Deselect All" : "Select All"}
                                            </Button>
                                        </div>
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
                                                        <div className="flex items-center space-x-2 flex-1">
                                                            <Link
                                                                variant="light"
                                                                onPress={() => navigate(`/yaml-editor/${file.id}`)}
                                                                className="flex-1 break-words max-w-sm md:max-w-lg lg:max-w-2xl text-blue-500 hover:underline text-left"
                                                            >
                                                                {file.name}
                                                            </Link>
                                                            {file.is_valid === false && (
                                                                <div className="tooltip-container" title="Invalid profile: This YAML has validation errors">
                                                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
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

            {/* Generate Profiles Modal */}
            <Modal
                isOpen={isGenerateModalOpen}
                onOpenChange={setIsGenerateModalOpen}
            >
                <ModalContent>
                    <ModalHeader>Generate Profiles</ModalHeader>
                    <ModalBody className="flex flex-col gap-4">
                        <p className="text-gray-600 dark:text-gray-400">
                            Profiles are generated based on conversations. More conversations with more turns create better profiles but take longer to generate.
                        </p>
                        <div className="space-y-4">
                            <Input
                                label="Number of conversations"
                                type="number"
                                min="1"
                                value={profileGenParams.conversations.toString()}
                                onValueChange={(value) => handleProfileGenParamChange('conversations', value)}
                            />
                            <Input
                                label="Turns per conversation"
                                type="number"
                                min="1"
                                value={profileGenParams.turns.toString()}
                                onValueChange={(value) => handleProfileGenParamChange('turns', value)}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="default"
                            variant="light"
                            onPress={() => setIsGenerateModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            isLoading={isGenerating}
                            isDisabled={isGenerating}
                            onPress={handleGenerateProfiles}
                        >
                            Generate
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

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
