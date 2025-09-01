import React, { useState } from "react";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import {
  PROVIDER_OPTIONS,
  getProviderDisplayName,
} from "../constants/providers";

export function ApiKeyItem({ apiKey, onUpdate, onDelete }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newName, setNewName] = useState(apiKey.name);
  const [newApiKey, setNewApiKey] = useState(apiKey.decrypted_api_key);
  const [newProvider, setNewProvider] = useState(apiKey.provider || "openai");
  const [showKey, setShowKey] = useState(false);
  const [showModalKey, setShowModalKey] = useState(false);

  const handleSave = () => {
    if (newName.trim()) {
      onUpdate(apiKey.id, newName, newApiKey, newProvider);
      setIsEditModalOpen(false);
    }
  };

  const handleCancel = () => {
    setNewName(apiKey.name);
    setNewApiKey(apiKey.decrypted_api_key);
    setNewProvider(apiKey.provider || "openai");
    setShowModalKey(false);
    setIsEditModalOpen(false);
  };

  const toggleShowKey = () => {
    setShowKey(!showKey);
  };

  const toggleShowModalKey = () => {
    setShowModalKey(!showModalKey);
  };

  const openEditModal = () => {
    setNewName(apiKey.name);
    setNewApiKey(apiKey.decrypted_api_key);
    setNewProvider(apiKey.provider || "openai");
    setShowModalKey(false);
    setIsEditModalOpen(true);
  };

  return (
    <>
      <Card className="shadow-sm bg-content1 dark:bg-content1">
        <CardBody className="flex flex-row gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground dark:text-foreground-dark">
                {apiKey.name}
              </h3>
              <span className="text-xs bg-muted dark:bg-muted-dark text-foreground/70 dark:text-foreground-dark/70 px-2 py-1 rounded-full">
                {getProviderDisplayName(apiKey.provider)}
              </span>
            </div>
            <code className="text-sm text-foreground/60 dark:text-foreground-dark/60 break-all">
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
              onPress={openEditModal}
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
        </CardBody>
      </Card>

      <Modal isOpen={isEditModalOpen} onClose={handleCancel}>
        <ModalContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <ModalHeader>Edit API Key</ModalHeader>
            <ModalBody>
              <Input
                label="API Key Name"
                placeholder="e.g., Production API Key"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                variant="bordered"
              />
              <Select
                label="Provider"
                placeholder="Select a provider"
                value={newProvider}
                onChange={(event) => setNewProvider(event.target.value)}
                variant="bordered"
                selectedKeys={[newProvider]}
              >
                {PROVIDER_OPTIONS.map((provider) => (
                  <SelectItem key={provider.key} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </Select>
              <div className="relative">
                <Input
                  label="API Key Value"
                  placeholder="Enter your API key"
                  value={newApiKey}
                  onChange={(event) => setNewApiKey(event.target.value)}
                  variant="bordered"
                  type={showModalKey ? "text" : "password"}
                />
                <Button
                  isIconOnly
                  color="default"
                  variant="light"
                  onPress={toggleShowModalKey}
                  aria-label="Show/Hide API Key"
                  className="absolute top-6 right-2 transform -translate-y-1/2"
                >
                  {showModalKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={handleCancel}>
                Cancel
              </Button>
              <Button color="primary" type="submit">
                Update Key
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
