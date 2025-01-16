import React, { useState, useEffect } from 'react';
import {
    Button,
    Input,
    Card,
    Dropdown,
    Form,
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
import { fetchChatbotTechnologies, createChatbotTechnology, fetchTechnologyChoices } from '../api/chatbotTechnologyApi';

const ChatbotTechnologies = () => {
    const [technologies, setTechnologies] = useState([]);
    const [technologyChoices, setTechnologyChoices] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        technology: '',
        link: '',
    });

    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const [newTechnologyName, setNewTechnologyName] = useState('');
    const [newTechnologyChoice, setNewTechnologyChoice] = useState({ key: '', value: '' });
    const [newTechnologyLink, setNewTechnologyLink] = useState('');

    const handleTechnologyNameChange = (event) => {
        setNewTechnologyName(event.target.value);
    }

    const handleTechnologyChoiceChange = (key, value) => {
        /* console.log(key, value); */
        setNewTechnologyChoice({ key, value });
    }

    const handleTechnologyLinkChange = (event) => {

        setNewTechnologyLink(event.target.value);
    }


    useEffect(() => {
        loadTechnologies();
        loadTechnologyChoices();
    }, []);

    const loadTechnologies = async () => {
        try {
            const data = await fetchChatbotTechnologies();
            setTechnologies(data);
        } catch (error) {
            // Handle error
        }
    };

    const loadTechnologyChoices = async () => {
        try {
            const choices = await fetchTechnologyChoices();
            setTechnologyChoices(choices);
            console.log(choices);
            setFormData(prev => ({ ...prev, technology: choices[0][0] || '' }));
        } catch (error) {
            // Handle error
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createChatbotTechnology(formData);
            setFormData({ name: '', technology: technologyChoices[0] || '', link: '' });
            loadTechnologies();
        } catch (error) {
            // Handle error
        }
    };

    return (
        <Card className="p-6 flex flex-col space-y-6 max-w-4xl mx-auto max-h-[80vh]">
            {/* Header */}
            <h1 className="text-3xl font-bold text-center">Chatbot Technologies</h1>

            {/* Create Chatbot Technology Modal */}
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">Create New Technology</ModalHeader>
                            <ModalBody>
                                <Input
                                    placeholder='Enter a name to identify the technology'
                                    fullWidth
                                    value={newTechnologyName}
                                    variant='bordered'
                                    label='Technology Name'
                                    onChange={handleTechnologyNameChange}
                                    isInvalid={newTechnologyName.trim() === ''}
                                    errorMessage={newTechnologyName.trim() === '' ? 'Technology name is required' : ''}
                                    maxLength={255}
                                    minLength={4}
                                />
                                <Dropdown className='full-width'>
                                    <DropdownTrigger>
                                        <Button>
                                            {newTechnologyChoice.value || 'Select a technology'}
                                        </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu>
                                        {technologyChoices.map((choice) => (
                                            <DropdownItem key={choice[0]} onPress={() => handleTechnologyChoiceChange(choice[0], choice[1])}>
                                                {choice[1]}
                                            </DropdownItem>

                                        ))}
                                    </DropdownMenu>
                                </Dropdown>
                                <Input

                                    placeholder='Enter a link to the technology'
                                    fullWidth
                                    value={newTechnologyLink}
                                    variant='bordered'
                                    type='url'
                                    label='Technology Link'
                                    onChange={handleTechnologyLinkChange}
                                    isInvalid={newTechnologyLink.trim() === ''}
                                    errorMessage={newTechnologyLink.trim() === '' ? 'Technology link is required' : ''}
                                    maxLength={255}
                                    minLength={5}
                                />
                            </ModalBody>
                            <ModalFooter>
                                <Button
                                    color='danger' variant='light' onPress={onClose}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    color='primary' onPress={handleSubmit}
                                >
                                    Create
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* Create Chatbot Technology Button */}
            <Button
                color='primary'
                onPress={() => onOpen()}

            >
                Create New Technology
            </Button>





            <h2>Existing Chatbot Technologies</h2>
            <ul>
                {technologies.map((tech) => (
                    <li key={tech.id}>
                        <strong>{tech.name}</strong> - {tech.technology} - <a href={tech.link} target="_blank" rel="noopener noreferrer">Link</a>
                    </li>
                ))}
            </ul>
        </Card>
    );
};

export default ChatbotTechnologies;
