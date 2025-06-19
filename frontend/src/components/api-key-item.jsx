import React, { useState } from "react";
import { Pencil, Trash2, Eye, EyeOff, Check, X } from "lucide-react";
import { Card, CardBody, Button, Input, Form } from "@heroui/react";

export function ApiKeyItem({ apiKey, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(apiKey.name);
  const [newApiKey, setNewApiKey] = useState(apiKey.decrypted_api_key);
  const [showKey, setShowKey] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
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
      <CardBody className={`flex ${isEditing ? "flex-col" : "flex-row"} gap-4`}>
        {isEditing ? (
          <Form onSubmit={handleSave} className="flex flex-col gap-4 w-full">
            <div className="w-full">
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
                  className="break-all"
                />
                <Button
                  isIconOnly
                  color="default"
                  variant="light"
                  onPress={toggleShowKey}
                  aria-label="Show/Hide API Key"
                  className="absolute top-7 right-2 transform -translate-y-1/2"
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
            </div>
            <div className="flex justify-center items-center gap-2 w-full">
              <Button
                isIconOnly
                color="danger"
                variant="light"
                onPress={handleCancel}
                aria-label="Cancel"
              >
                <X size={18} />
              </Button>
              <Button
                isIconOnly
                color="success"
                variant="light"
                type="submit"
                aria-label="Save"
              >
                <Check size={18} />
              </Button>
            </div>
          </Form>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium">{apiKey.name}</h3>
              <code className="text-sm text-gray-500 break-all">
                {showKey ? apiKey.decrypted_api_key : "•".repeat(20)}
              </code>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
