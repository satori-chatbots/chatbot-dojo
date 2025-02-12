import React, { useState } from 'react';
import { Pencil, Trash2, Eye, EyeOff, Check, X } from 'lucide-react';
import { Card, CardBody, Button, Input } from '@heroui/react';

export function ApiKeyItem({ apiKey, onUpdate, onDelete }) {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(apiKey.name);
    const [newApiKey, setNewApiKey] = useState(apiKey.decrypted_api_key);
    const [showKey, setShowKey] = useState(false);

    const handleSave = () => {
        if (newName.trim()) {
            onUpdate(apiKey.id, newName, newApiKey);
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setNewName(apiKey.name);
        setNewApiKey(apiKey.decrypted_api_key);
        setIsEditing(false);
    };

    const toggleShowKey = () => {
        setShowKey(!showKey);
    };

    return (
        <Card className="shadow-sm">
            <CardBody className="flex flex-row items-center gap-4">
                <div className="flex-1">
                    {isEditing ? (
                        <>
                            <Input
                                label="Name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                variant="bordered"
                                autoFocus
                            />
                            <div className="relative">
                                <Input
                                    label="API Key"
                                    value={newApiKey}
                                    onChange={(e) => setNewApiKey(e.target.value)}
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
                        </>
                    ) : (
                        <>
                            <h3 className="font-medium">{apiKey.name}</h3>
                            <code className="text-sm text-gray-500">
                                {showKey ? apiKey.decrypted_api_key : '•'.repeat(20)}
                            </code>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Button
                                isIconOnly
                                color="success"
                                variant="light"
                                onPress={handleSave}
                                aria-label="Save"
                            >
                                <Check size={18} />
                            </Button>
                            <Button
                                isIconOnly
                                color="danger"
                                variant="light"
                                onPress={handleCancel}
                                aria-label="Cancel"
                            >
                                <X size={18} />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                isIconOnly
                                color="default"
                                variant="light"
                                onPress={toggleShowKey}
                                aria-label="Show/Hide API Key"
                            >
                                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </Button>
                            <Button
                                isIconOnly
                                color="primary"
                                variant="light"
                                onPress={() => setIsEditing(true)}
                                aria-label="Edit"
                            >
                                <Pencil size={18} />
                            </Button>
                            <Button
                                isIconOnly
                                color="danger"
                                variant="light"
                                onPress={() => onDelete(apiKey.id)}
                                aria-label="Delete"
                            >
                                <Trash2 size={18} />
                            </Button>
                        </>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
