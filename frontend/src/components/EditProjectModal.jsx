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
import { updateProject, checkProjectName } from '../api/projectApi';
import { RotateCcw, Save } from 'lucide-react';

const EditProjectModal = ({
    isOpen,
    onOpenChange,
    project,
    technologies,
    onProjectUpdated
}) => {
    const [formData, setFormData] = useState({
        name: project?.name || '',
        technology: project?.chatbot_technology || ''
    });
    const [loadingValidation, setLoadingValidation] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    // Update form data when project changes
    React.useEffect(() => {
        if (project) {
            setFormData({
                name: project.name,
                technology: project.chatbot_technology
            });
        }
    }, [project]);

    const handleFormValidation = async (event, name, technology) => {
        event.preventDefault();
        setLoadingValidation(true);

        if (!name.trim() || !technology) {
            setLoadingValidation(false);
            return false;
        }

        // Skip validation if name hasn't changed
        if (name === project?.name) {
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

    const handleUpdateProject = async (event) => {
        event.preventDefault();

        const isValid = await handleFormValidation(event, formData.name, formData.technology);
        if (!isValid) return;

        try {
            await updateProject(project.id, {
                name: formData.name,
                chatbot_technology: formData.technology,
            });
            onOpenChange(false);
            if (onProjectUpdated) {
                await onProjectUpdated();
            }
        } catch (error) {
            console.error('Error updating project:', error);
            const errorData = JSON.parse(error.message);
            const errors = Object.entries(errorData).map(([key, value]) => `${key}: ${value}`);
            alert(`Error updating project: ${errors.join('\n')}`);
        }
    };

    const handleReset = () => {
        setFormData({
            name: '',
            technology: ''
        });
        setValidationErrors({});
    };

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open) handleReset();
                onOpenChange(open);
            }}
        >
            <ModalContent>
                <ModalHeader>Edit Project</ModalHeader>
                <ModalBody>
                    <Form
                        className="w-full flex flex-col gap-4"
                        onSubmit={handleUpdateProject}
                        onReset={handleReset}
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
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            maxLength={255}
                            minLength={3}
                            isDisabled={loadingValidation}
                        />
                        <Select
                            isRequired
                            label="Technology"
                            labelPlacement="outside"
                            placeholder="Select Technology"
                            name="technology"
                            selectedKeys={[String(formData.technology)]}
                            onChange={(e) => setFormData(prev => ({ ...prev, technology: e.target.value }))}
                        >
                            {technologies.map((tech) => (
                                <SelectItem key={String(tech.id)} value={String(tech.id)}>
                                    {tech.name}
                                </SelectItem>
                            ))}
                        </Select>
                        <ModalFooter className="w-full flex justify-center gap-4">
                            <Button color="danger" variant="light" type="reset" startContent={<RotateCcw className="w-4 h-4 mr-1" />}>
                                Reset
                            </Button>
                            <Button
                                color="primary"
                                type="submit"
                                isDisabled={!formData.name.trim() || !formData.technology}
                                startContent={<Save className="w-4 h-4 mr-1" />}
                            >
                                Update
                            </Button>
                        </ModalFooter>
                    </Form>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default EditProjectModal;
