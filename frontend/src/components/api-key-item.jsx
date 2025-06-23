import React, { useState } from "react";
import { Pencil, Trash2, Eye, EyeOff, Check, X } from "lucide-react";
import {
  Card,
  CardBody,
  Button,
  Input,
  Form,
  Select,
  SelectItem,
} from "@heroui/react";

export function ApiKeyItem({ apiKey, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(apiKey.name);
  const [newApiKey, setNewApiKey] = useState(apiKey.decrypted_api_key);
  const [newProvider, setNewProvider] = useState(apiKey.provider || "openai");
  const [showKey, setShowKey] = useState(false);

  const handleSave = (event) => {
    event.preventDefault();
    if (newName.trim()) {
      onUpdate(apiKey.id, newName, newApiKey, newProvider);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setNewName(apiKey.name);
    setNewApiKey(apiKey.decrypted_api_key);
    setNewProvider(apiKey.provider || "openai");
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
                onChange={(event) => setNewName(event.target.value)}
                variant="bordered"
              />
              <Select
                label="Provider"
                value={newProvider}
                onChange={(event) => setNewProvider(event.target.value)}
                variant="bordered"
                selectedKeys={[newProvider]}
              >
                <SelectItem key="openai" value="openai">
                  OpenAI
                </SelectItem>
                <SelectItem key="gemini" value="gemini">
                  Google Gemini
                </SelectItem>
              </Select>
              <div className="relative">
                <Input
                  label="API Key"
                  value={newApiKey}
                  onChange={(event) => setNewApiKey(event.target.value)}
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
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{apiKey.name}</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {apiKey.provider === "openai" ? "OpenAI" : "Google Gemini"}
                </span>
              </div>
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
