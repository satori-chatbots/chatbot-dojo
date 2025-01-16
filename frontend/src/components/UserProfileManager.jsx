import React, { useRef, useState } from 'react';
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
    select
} from "@nextui-org/react";
import useFileHandlers from '../hooks/userFileHandlers';
import { uploadFiles } from '../api/fileApi';
import { MEDIA_URL } from '../api/config';
import { createProject, deleteProject } from '../api/projectApi';
import { HiOutlineTrash } from "react-icons/hi";


function UserProfileManager({ files, reload, projects, reloadProjects }) {

    const {
        selectedFiles,
        selectFile,
        handleDelete,
        handleExecuteTest,
        selectedProject,
        handleProjectChange,
        setSelectedProject,
        selectedUploadFiles,
        handleUpload,
        handleFileChange,
        fileInputRef,
    } = useFileHandlers(reload, reloadProjects, projects);

    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const [newProjectName, setNewProjectName] = useState('');
    const [technology, setTechnology] = useState('');
    const [chatbotURL, setChatbotURL] = useState('');

    const handleProjectNameChange = (event) => {
        setNewProjectName(event.target.value);
    };

    const handleTechnologyChange = (event) => {
        setTechnology(event.target.value);
    };

    const handleChatbotURLChange = (event) => {
        setChatbotURL(event.target.value);
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) {
            alert('Please enter a project name.');
            return;
        }
        try {
            const newProject = await createProject({
                name: newProjectName,
                technology: technology,
                chatbotURL: chatbotURL
            });
            await reloadProjects();
            setSelectedProject(newProject);
            setNewProjectName('');
            setTechnology('');
            setChatbotURL('');
            onOpenChange(false);


        } catch (error) {
            console.error('Error creating project:', error);
            alert('Error creating project.');
        }
    };

    const handleProjectDelete = async (projectId) => {
        if (!window.confirm('Are you sure you want to delete this project?')) {
            return;
        }
        try {
            await deleteProject(projectId);
            await reloadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
            alert('Error deleting project.');
        }
    }

    return (
        <Card className="p-6 flex flex-col space-y-6 max-w-4xl mx-auto max-h-[80vh]">
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
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">Create New Project</ModalHeader>
                            <ModalBody>
                                <Input
                                    placeholder="Enter project name"
                                    fullWidth
                                    value={newProjectName}
                                    variant='bordered'
                                    label="Project Name"
                                    onChange={handleProjectNameChange}
                                    isInvalid={newProjectName.trim() === '' && newProjectName.length < 255}
                                    errorMessage={newProjectName.trim() === '' ? 'Please enter a project name (max 255 characters).' : ''}
                                    maxLength={255}
                                    minLength={4}
                                />
                                <Input
                                    placeholder="Enter technology"
                                    fullWidth
                                    value={technology}
                                    variant='bordered'
                                    label="Technology"
                                    onChange={handleTechnologyChange}
                                    isInvalid={technology.trim() === ''}
                                    errorMessage={technology.trim() === '' ? 'Please enter a technology.' : ''}
                                    maxLength={255}
                                />
                                <Input
                                    placeholder="Enter chatbot URL"
                                    fullWidth
                                    value={chatbotURL}
                                    variant='bordered'
                                    label="Chatbot URL"
                                    onChange={handleChatbotURLChange}
                                    isInvalid={!isValidURL(chatbotURL)}
                                    errorMessage={!isValidURL(chatbotURL) ? 'Please enter a valid URL.' : ''}
                                    maxLength={500}
                                />
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button color="primary" onPress={handleCreateProject}
                                    isDisabled={newProjectName.trim() === '' || technology.trim() === '' || !isValidURL(chatbotURL)}>
                                    Create
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

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
            <div className="flex-1 overflow-y-auto">
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
                <Button color="primary" className="flex-1" onPress={handleExecuteTest}>
                    Execute Test
                </Button>
            </div>
        </Card>
    );
};

const isValidURL = (url) => {
    const pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i');
    return !!pattern.test(url);
};



export default UserProfileManager;
