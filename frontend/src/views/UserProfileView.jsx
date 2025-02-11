import React, { useState, useEffect } from 'react';
import {
    Card,
    CardBody,
    Input,
    Button,
    Spinner,
    Form,
} from "@heroui/react";
import { useAuth } from '../contexts/AuthContext';
import { EyeFilledIcon, EyeSlashFilledIcon } from './LoginView';

const UserProfileView = () => {
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', content: '' });

    const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
    const toggleApiKeyVisibility = () => setIsApiKeyVisible(!isApiKeyVisible);

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        api_key: '',
    });

    useEffect(() => {
        if (user) {
            setFormData({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                api_key: user.api_key || '',
            });
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', content: '' });

        try {
            await updateUserProfile(formData);
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

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 w-full">
            <Card className="p-6 sm:p-8 w-full max-w-md space-y-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-center">
                    Profile Settings
                </h1>

                <Form
                    className="flex flex-col space-y-10"
                    onSubmit={handleSubmit}
                    validationBehavior='native'
                >
                    <Input
                        label="Email"
                        value={user?.email || ''}
                        isDisabled
                        type="email"
                        labelPlacement="outside"
                        fullWidth
                    />

                    <Input
                        label="First Name"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleChange}
                        placeholder="Enter your first name"
                        labelPlacement="outside"
                        fullWidth
                    />

                    <Input
                        label="Last Name"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleChange}
                        placeholder="Enter your last name"
                        labelPlacement="outside"
                        fullWidth
                    />

                    <Input
                        label="API Key"
                        name="api_key"
                        value={formData.api_key}
                        onChange={handleChange}
                        placeholder="Enter your API key"
                        labelPlacement="outside"
                        fullWidth
                        type={isApiKeyVisible ? "text" : "password"}
                        endContent={
                            <button
                                aria-label="toggle api key visibility"
                                className="focus:outline-none"
                                type="button"
                                onClick={toggleApiKeyVisibility}
                            >
                                {isApiKeyVisible ? (
                                    <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                                ) : (
                                    <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                                )}
                            </button>
                        }
                    />

                    {message.content && (
                        <p className={`text-sm text-center ${message.type === 'error' ? 'text-danger' : 'text-success'
                            }`}>
                            {message.content}
                        </p>
                    )}

                    <Button
                        type="submit"
                        color="primary"
                        fullWidth
                        size="lg"
                        isLoading={loading}
                    >
                        {loading ? <Spinner size="sm" /> : 'Save Changes'}
                    </Button>
                </Form>
            </Card>
        </div>
    );
};

export default UserProfileView;
