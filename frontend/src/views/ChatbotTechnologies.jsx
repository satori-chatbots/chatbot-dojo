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
import { fetchChatbotTechnologies, createChatbotTechnology, fetchTechnologyChoices, updateChatbotTechnology, deleteChatbotTechnology } from '../api/chatbotTechnologyApi';

const ChatbotTechnologies = () => {
    const [editData, setEditData] = useState({});
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Function to open edit modal
    const handleEdit = (tech) => {
        console.log('Editing:', tech);
        setEditData(tech);
        setIsEditOpen(true);
    };

    const [technologies, setTechnologies] = useState([]);
    const [technologyChoices, setTechnologyChoices] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        technology: '',
        link: '',
    });

    // State of the modal to create new technology
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    useEffect(() => {
        loadTechnologies();
        loadTechnologyChoices();
    }, []);

    const loadTechnologies = async () => {
        try {
            const data = await fetchChatbotTechnologies();
            setTechnologies(data);
        } catch (error) {
            console.error('Error fetching chatbot technologies:', error);
        }
    };

    const loadTechnologyChoices = async () => {
        try {
            const choices = await fetchTechnologyChoices();
            setTechnologyChoices(choices); // each choice is [key, value]
            // Set initial selection
            setFormData(prev => ({
                ...prev,
                technology: choices[0]?.[0] || ''
            }));
        } catch (error) {
            console.error('Error fetching technology choices:', error);
        }
    };

    // Called after the form is submitted
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        //console.log('Creating chatbot technology:', data);
        // Check if the URL is valid
        if (!data.link.match(/^https?:\/\//)) {
            alert('Please enter a valid URL');
            return;
        }

        // Check there is a technology selected
        if (!data.technology) {
            alert('Please select a technology');
            return;
        }



        try {
            await createChatbotTechnology(data);
            // Reset form
            setFormData({
                name: '',
                technology: technologyChoices[0]?.[0] || '',
                link: '',
            });
            loadTechnologies();
            // Close modal
            onOpenChange(false);
        } catch (error) {
            console.log('DFSDError creating chatbot technology:', error);
            alert(`Error creating chatbot technology: ${error.message}`);
        }
    };

    // Called when the form is reset
    const handleFormReset = () => {
        setFormData({
            name: '',
            technology: technologyChoices[0]?.[0] || '',
            link: '',
        });
    };

    // Update technology
    const handleUpdate = async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        // Check if the URL is valid
        if (!data.link.match(/^https?:\/\//)) {
            alert('Please enter a valid URL');
            return;
        }

        // Check there is a technology selected
        if (!data.technology) {
            alert('Please select a technology');
            return;
        }

        try {
            await updateChatbotTechnology(editData.id, data);
            setIsEditOpen(false);
            await loadTechnologies();
        } catch (error) {
            alert(`Error updating chatbot technology: ${error.message}`);
        }
    };

    // Delete existing technology
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this technology?')) return;
        try {
            await deleteChatbotTechnology(id);
            await loadTechnologies();
        } catch (error) {
            alert(`Error deleting chatbot technology: ${error.message}`);
        }
    };

    // Columns for table
    const columns = [
        { name: 'Name', key: 'name' },
        { name: 'Technology', key: 'technology' },
        { name: 'URL', key: 'link' },
        { name: 'Actions', key: 'actions' },
    ];

    return (
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col space-y-4 sm:space-y-6 max-w-full sm:max-w-4xl mx-auto max-h-[80vh]">
            <h1 className="text-2xl sm:text-3xl font-bold text-center">Chatbot Technologies</h1>

            {/* Button to open modal */}
            <Button color="primary" onPress={onOpen}
                className="max-w-full sm:max-w-[200px] mx-auto"
            >
                Create New Technology
            </Button>

            {/* Modal to create new technology */}
            <Modal isOpen={isOpen}
                onOpenChange={onOpenChange}
            >
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader className="flex flex-col gap-1 items-center">
                                Create New Technology
                            </ModalHeader>
                            <ModalBody className="flex flex-col gap-4 items-center">
                                <Form
                                    className="w-full flex flex-col gap-4"
                                    onSubmit={handleFormSubmit}
                                    onReset={handleFormReset}
                                    validationBehavior="native"
                                >
                                    <Input
                                        isRequired
                                        errorMessage="Please enter a valid name"
                                        label="Name"
                                        labelPlacement="outside"
                                        name="name"
                                        placeholder="Enter a name to identify the technology"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        type="text"
                                    />

                                    {/* Select for technology choices */}
                                    <Select
                                        isRequired
                                        label="Technology"
                                        labelPlacement="outside"
                                        placeholder="Select Technology"
                                        name="technology"
                                        value={formData.technology}
                                        onChange={(val) => {
                                            // 'val' is expected to be a string
                                            setFormData((prev) => ({ ...prev, technology: val }));
                                        }}
                                        fullWidth
                                    >
                                        {technologyChoices.map(([key, value]) => (
                                            <SelectItem key={key} value={key}>
                                                {value}
                                            </SelectItem>
                                        ))}
                                    </Select>

                                    <Input
                                        isRequired
                                        errorMessage="Please enter a valid URL"
                                        label="URL"
                                        labelPlacement="outside"
                                        name="link"
                                        placeholder="Enter a URL to the technology"
                                        value={formData.link}
                                        onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                        isInvalid={formData.link.length > 0 && !formData.link.match(/^https?:\/\//)}
                                        type="url"
                                    />

                                    <ModalFooter className="w-full flex justify-center gap-4">
                                        <Button type="reset" color="danger">
                                            Reset
                                        </Button>
                                        <Button type="submit" color="primary">
                                            Create
                                        </Button>
                                    </ModalFooter>
                                </Form>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <h2 className='text-xl sm:text-2xl font-bold text-center'>Existing Technologies</h2>
            {/* Table of existing technologies */}
            <Table aria-label="Chatbot Technologies Table"
                className="overflow-x-auto">
                <TableHeader columns={columns}>
                    <TableColumn key="name" allowsSorting>Name</TableColumn>
                    <TableColumn key="technology" allowsSorting>Technology</TableColumn>
                    <TableColumn key="link" allowsSorting>URL</TableColumn>
                    <TableColumn className='text-center' key="actions">Actions</TableColumn>

                </TableHeader>
                <TableBody>
                    {technologies.map((tech) => (
                        <TableRow key={tech.id}>
                            <TableCell className="px-2 sm:px-4">{tech.name}</TableCell>
                            <TableCell className="px-2 sm:px-4">{tech.technology}</TableCell>
                            <TableCell className="px-2 sm:px-4">
                                <a href={tech.link} target="_blank" rel="noopener noreferrer">
                                    {tech.link}
                                </a>
                            </TableCell>
                            <TableCell className='flex space-x-1 sm:space-x-2 px-2 sm:px-4'>
                                <Button size="sm" color="secondary" variant='ghost' onPress={() => handleEdit(tech)}>
                                    Edit
                                </Button>
                                <Button size="sm" color="danger" variant='ghost' onPress={() => handleDelete(tech.id)}>
                                    Delete
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Modal for editing */}
            <Modal
                isOpen={isEditOpen}
                onOpenChange={setIsEditOpen}
            >
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader className="flex flex-col gap-1 items-center">
                                Edit Technology
                            </ModalHeader>
                            <ModalBody className="flex flex-col gap-4 items-center">
                                <Form
                                    className="w-full flex flex-col gap-4"
                                    onSubmit={handleUpdate}
                                    onReset={() => setIsEditOpen(false)}
                                >
                                    <Input
                                        isRequired
                                        label="Name"
                                        name="name"
                                        defaultValue={editData?.name || ''}
                                        type="text"
                                    />
                                    <Select
                                        isRequired
                                        label="Technology"
                                        placeholder='Select a new Technology'
                                        name="technology"
                                        defaultSelectedKeys={[editData?.technology]}

                                    >
                                        {technologyChoices.map(([key, value]) => (
                                            <SelectItem key={key} value={key}>
                                                {value}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                    <Input
                                        isRequired
                                        label="URL"
                                        name="link"
                                        defaultValue={editData?.link || ''}
                                        type="url"
                                    />
                                    <ModalFooter className="w-full flex justify-center gap-4">
                                        <Button type="reset" color="danger">
                                            Cancel
                                        </Button>
                                        <Button type="submit" color="primary">
                                            Save
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
};

export default ChatbotTechnologies;
