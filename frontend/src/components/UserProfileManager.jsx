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
} from "@nextui-org/react";
import useFileHandlers from '../hooks/userFileHandlers';
import { uploadFiles } from '../api/fileApi';
import { MEDIA_URL } from '../api/config';
import { createProject, deleteProject } from '../api/projectApi';
import { HiOutlineTrash } from "react-icons/hi";
import { fetchChatbotTechnologies, fetchTechnologyChoices } from '../api/chatbotTechnologyApi';


function UserProfileManager({ files, reload, projects, reloadProjects }) {

    const [availableTechnologies, setAvailableTechnologies] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const technologies = await fetchChatbotTechnologies();
                console.log(technologies);
                setAvailableTechnologies(technologies);

            } catch (error) {
                console.error('Error loading data:', error);
            }
        };

        loadData();
    }, []);


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

    const handleProjectNameChange = (event) => {
        setNewProjectName(event.target.value);
    };

    const handleTechnologyChange = (event) => {
        setTechnology(event.target.value);
    };


    const handleCreateProject = async (event) => {
        event.preventDefault();
        if (!newProjectName.trim()) {
            alert('Please enter a project name.');
            return;
        }
        try {
            const newProject = await createProject({
                name: newProjectName,
                chatbot_technology: technology,
            });
            await reloadProjects();
            setSelectedProject(newProject);
            setNewProjectName('');
            setTechnology('');
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

    const handleFormReset = () => {
        setNewProjectName('');
        setTechnology('');
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
                                        value={newProjectName}
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
                                    >
                                        {availableTechnologies.map((tech) => (
                                            <SelectItem key={tech.id} value={tech.name}>
                                                {tech.name}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                    <ModalFooter className="w-full flex justify-center gap-4">
                                        <Button type="reset" color="danger" variant="light" onPress={onClose}>
                                            Reset
                                        </Button>
                                        <Button
                                            type="submit"
                                            color="primary"
                                            isDisabled={newProjectName.trim() === '' || technology === ''}
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
                </div>
            ) : (
                <p className="text-gray-500 text-center">Select a project to start working!</p>
            )}

        </Card>
    );
};





export default UserProfileManager;
