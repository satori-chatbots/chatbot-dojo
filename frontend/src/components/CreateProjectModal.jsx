import React, { useState } from 'react';
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Select,
    SelectItem,
    Form
} from "@heroui/react";
import { createProject, checkProjectName } from '../api/projectApi';

const CreateProjectModal = ({
    isOpen,
    onOpenChange,
    technologies,
    onProjectCreated,
}) => {
    const [formData, setFormData] = useState({
        name: '',
        technology: ''
    });
    const [loadingValidation, setLoadingValidation] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    const handleProjectNameChange = (event) => {
        setFormData(prev => ({ ...prev, name: event.target.value }));
    };

    const handleTechnologyChange = (event) => {
        setFormData(prev => ({ ...prev, technology: event.target.value }));
    };

    const handleFormReset = () => {
        setFormData({
            name: '',
            technology: ''
        });
        setValidationErrors({});
    };

    const handleFormValidation = async (event) => {
        event.preventDefault();
        setLoadingValidation(true);

        if (!formData.name.trim() || !formData.technology) {
            setLoadingValidation(false);
            return false;
        }

        const existsResponse = await checkProjectName(formData.name.trim());
        if (existsResponse.exists) {
            setValidationErrors({ name: 'This name is already taken, choose another one.' });
            setLoadingValidation(false);
            return false;
        }

        setValidationErrors({});
        setLoadingValidation(false);
        return true;
    };

    const handleCreateProject = async (event) => {
        event.preventDefault();

        const isValid = await handleFormValidation(event);
        if (!isValid) {
            return;
        }

        try {
            const newProject = await createProject({
                name: formData.name,
                chatbot_technology: formData.technology,
            });
            handleFormReset();
            onOpenChange(false);
            if (onProjectCreated) {
                onProjectCreated(newProject);
            }
        } catch (error) {
            console.error('Error creating project:', error);
            const errorData = JSON.parse(error.message);
            const errors = Object.entries(errorData).map(([key, value]) => `${key}: ${value}`);
            alert(`Error creating project: ${errors.join('\n')}`);
        }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
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
                                validationErrors={validationErrors}
                            >
                                <Input
                                    placeholder="Enter project name"
                                    name="name"
                                    fullWidth
                                    isRequired
                                    labelPlacement="outside"
                                    value={formData.name}
                                    variant="bordered"
                                    label="Project Name"
                                    onChange={handleProjectNameChange}
                                    maxLength={255}
                                    minLength={3}
                                    isDisabled={loadingValidation}
                                />
                                <Select
                                    placeholder="Select chatbot technology"
                                    fullWidth
                                    label="Technology"
                                    labelPlacement="outside"
                                    onChange={handleTechnologyChange}
                                    isRequired
                                    value={formData.technology}
                                    isDisabled={loadingValidation}
                                >
                                    {technologies.map(tech => (
                                        <SelectItem key={tech.id} value={tech.id}>
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
                                        isDisabled={!formData.name.trim() || !formData.technology}
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
    );
};

export default CreateProjectModal;
