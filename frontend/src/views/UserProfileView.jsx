import React, { useState, useEffect } from 'react';
import { Plus, Eye, EyeOff } from 'lucide-react';
import {
    Card,
    CardBody,
    CardHeader,
    Input,
    Button,
    Divider,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Spinner,
    Form
} from '@heroui/react';
import { useAuth } from '../contexts/AuthContext';
import { ApiKeyItem } from '../components/ApiKeyItem';
import {
    updateUserProfile,
    getUserApiKeys,
    createApiKey,
    updateApiKey,
    deleteApiKey
} from '../api/authenticationApi';


const UserProfileView = () => {
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', content: '' });
    const [apiKeys, setApiKeys] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newApiKey, setNewApiKey] = useState({ name: '', api_key: '' });
    const [showKey, setShowKey] = useState(false);


    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
    });

    useEffect(() => {
        if (user) {
            setFormData({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
            });
            loadApiKeys();
        }
    }, [user]);

    const toggleShowKey = () => {
        setShowKey(!showKey);
    };

    const loadApiKeys = async () => {
        try {
            const keys = await getUserApiKeys();
            setApiKeys(keys);
        } catch (error) {
            setMessage({
                type: 'error',
                content: 'Failed to load API keys'
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', content: '' });

        try {
            const updatedUser = await updateUserProfile(formData);
            // Check if backend returned an error
            if (!updatedUser || updatedUser.error) {
                throw new Error(updatedUser?.error || 'Server returned an error');
            }

            // Only update local storage if successful
            localStorage.setItem('user', JSON.stringify({ user: updatedUser }));
            await refreshUser();
            setMessage({
                type: 'success',
                content: 'Profile updated successfully'
            });
        } catch (error) {
            setMessage({
                type: 'error',
                content: error.message || 'Failed to update profile'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddApiKey = async () => {
        if (newApiKey.name.trim() && newApiKey.api_key.trim()) {
            setLoading(true);
            try {
                await createApiKey(newApiKey);
                await loadApiKeys();
                setNewApiKey({ name: '', api_key: '' });
                setIsModalOpen(false);
                setMessage({
                    type: 'success',
                    content: 'API Key created successfully'
                });
            } catch (error) {
                setMessage({
                    type: 'error',
                    content: error.message || 'Failed to create API Key'
                });
            } finally {
                setLoading(false);
            }
        }
    };

    const handleUpdateApiKey = async (id, newName, newApiKey) => {
        setLoading(true);
        try {
            await updateApiKey(id, { name: newName, api_key: newApiKey });
            await loadApiKeys();
            setMessage({
                type: 'success',
                content: 'API Key updated successfully'
            });
        } catch (error) {
            setMessage({
                type: 'error',
                content: error.message || 'Failed to update API Key'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteApiKey = async (id) => {
        if (!window.confirm('Are you sure you want to delete this API key?')) return;

        setLoading(true);
        try {
            await deleteApiKey(id);
            await loadApiKeys();
            setMessage({
                type: 'success',
                content: 'API Key deleted successfully'
            });
        } catch (error) {
            setMessage({
                type: 'error',
                content: error.message || 'Failed to delete API Key'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8
        flex flex-col
        space-y-4 sm:space-y-6
        max-w-full sm:max-w-4xl
        mx-auto
        my-auto
        max-h-[90vh]">
            <div className="max-w-4xl mx-auto space-y-6">
                <Card>
                    <CardHeader>
                        <h1 className="text-2xl font-bold">Profile Settings</h1>
                    </CardHeader>
                    <Divider />
                    <CardBody className="space-y-6">
                        <Form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex gap-4 items-center">
                                <Input
                                    className="flex-1 w-full"
                                    label="First Name"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                                    variant="bordered"
                                    fullWidth
                                />
                                <Input
                                    className="flex-1 w-full"
                                    label="Last Name"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                                    variant="bordered"
                                    fullWidth
                                />
                            </div>
                            <Input
                                label="Email"
                                value={user?.email || ''}
                                isDisabled
                                variant="bordered"
                                fullWidth
                            />
                            <Button
                                color="primary"
                                fullWidth
                                type="submit"
                                isLoading={loading}
                            >
                                Save Changes
                            </Button>
                        </Form>

                    </CardBody>
                </Card>

                <Card>
                    <CardHeader className="flex justify-between">
                        <h2 className="text-xl font-bold">API Keys</h2>
                        <Button
                            onPress={() => setIsModalOpen(true)}
                            color="primary"
                            endContent={<Plus className="w-4 h-4" />}
                        >
                            Add API Key
                        </Button>
                    </CardHeader>
                    <Divider />
                    <CardBody className="space-y-4">
                        {apiKeys.map((apiKey) => (
                            <ApiKeyItem
                                key={apiKey.id}
                                apiKey={apiKey}
                                onUpdate={handleUpdateApiKey}
                                onDelete={handleDeleteApiKey}
                            />
                        ))}
                        {apiKeys.length === 0 && (
                            <div className="text-center text-gray-500 py-4">
                                No API keys yet. Click "Add API Key" to create one.
                            </div>
                        )}
                    </CardBody>
                </Card>

                {message.content && (
                    <div className={`text-sm text-center ${message.type === 'error' ? 'text-danger' : 'text-success'
                        }`}>
                        {message.content}
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setNewApiKey({ name: '', api_key: '' });
                }}
            >
                <ModalContent>
                    <ModalHeader>Add New API Key</ModalHeader>
                    <ModalBody>
                        <Input
                            label="API Key Name"
                            placeholder="e.g., Production API Key"
                            value={newApiKey.name}
                            onChange={(e) => setNewApiKey(prev => ({ ...prev, name: e.target.value }))}
                            variant="bordered"
                        />
                        <div className="relative">
                            <Input
                                label="API Key Value"
                                placeholder="Enter your API key"
                                value={newApiKey.api_key}
                                onChange={(e) => setNewApiKey(prev => ({ ...prev, api_key: e.target.value }))}
                                variant="bordered"
                                type={showKey ? "text" : "password"}
                            />
                            <Button
                                isIconOnly
                                color="default"
                                variant="light"
                                onPress={toggleShowKey}
                                aria-label="Show/Hide API Key"
                                className="absolute top-6 right-2 transform -translate-y-1/2"
                            >
                                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </Button>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button color="danger" variant="light" onPress={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleAddApiKey}
                            isLoading={loading}
                        >
                            Add Key
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
};

export default UserProfileView;
