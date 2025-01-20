import React from 'react';
import {
    Modal,
    ModalContent,
    ModalFooter,
    ModalBody,
    ModalHeader,
    Button,
    Form,
    Input,
    Select,
    SelectItem,
} from "@nextui-org/react";

const CreateProjectModal = ({
    isOpen,
    onOpenChange,
    handleCreateProject,
    handleFormReset,
    newProjectName,
    handleProjectNameChange,
    availableTechnologies,
    technology,
    handleTechnologyChange,
}) => {
    return (
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
                                    value={technology}
                                >
                                    {availableTechnologies.map((tech) => (
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
    );
};

export default CreateProjectModal;
