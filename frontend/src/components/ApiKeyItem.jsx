import React, { useState } from 'react';
import { Pencil, Trash2, Eye, EyeOff, Check, X } from 'lucide-react';
import { Card, CardBody, Button, Input } from '@heroui/react';

export function ApiKeyItem({ apiKey, onUpdate, onDelete }) {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(apiKey.name);
    const [newApiKey, setNewApiKey] = useState(apiKey.decrypted_api_key); // new state for API key

    const handleSave = () => {
        if (newName.trim()) {
            // call onUpdate with both id, newName and newApiKey
            onUpdate(apiKey.id, newName, newApiKey);
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setNewName(apiKey.name);
        setNewApiKey(apiKey.decrypted_api_key); // reset API key
        setIsEditing(false);
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
                            <Input
                                label="API Key"
                                value={newApiKey}
                                onChange={(e) => setNewApiKey(e.target.value)}
                                variant="bordered"
                                type="text" // or "password"
                            />
                        </>
                    ) : (
                        <>
                            <h3 className="font-medium">{apiKey.name}</h3>
                            <code className="text-sm text-gray-500">
                                {apiKey.decrypted_api_key}
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
