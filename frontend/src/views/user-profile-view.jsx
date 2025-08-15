import React, { useState, useEffect } from "react";
import { Plus, Eye, EyeOff } from "lucide-react";
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
  Form,
  Select,
  SelectItem,
} from "@heroui/react";
import { PROVIDER_OPTIONS } from "../constants/providers";
import { useAuth } from "../contexts/auth-context";
import { ApiKeyItem } from "../components/api-key-item";
import SetupProgress from "../components/setup-progress";
import { useSetup } from "../contexts/setup-context";
import {
  updateUserProfile,
  getUserApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
} from "../api/authentication-api";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

const UserProfileView = () => {
  const { user, refreshUser } = useAuth();
  const { reloadApiKeys } = useSetup();
  const [loading, setLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState({
    name: "",
    api_key: "",
    provider: "openai",
  });
  const [showKey, setShowKey] = useState(false);
  const { showToast } = useMyCustomToast();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
  });

  const loadApiKeys = React.useCallback(async () => {
    try {
      const keys = await getUserApiKeys();
      setApiKeys(keys);
    } catch {
      showToast("error", "Failed to load API keys");
    }
  }, [showToast]);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
      });
      loadApiKeys();
    }
  }, [user, loadApiKeys]);

  const toggleShowKey = () => {
    setShowKey(!showKey);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const updatedUser = await updateUserProfile(formData);
      if (!updatedUser || updatedUser.error) {
        throw new Error(updatedUser?.error || "Server returned an error");
      }
      localStorage.setItem("user", JSON.stringify({ user: updatedUser }));
      await refreshUser();
      showToast("success", "Profile updated successfully");
    } catch (error) {
      showToast("error", error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleAddApiKey = async () => {
    if (
      newApiKey.name.trim() &&
      newApiKey.api_key.trim() &&
      newApiKey.provider
    ) {
      setLoading(true);
      try {
        await createApiKey(newApiKey);
        await loadApiKeys();
        await reloadApiKeys(); // Update setup progress
        setNewApiKey({ name: "", api_key: "", provider: "openai" });
        setIsModalOpen(false);
        showToast("success", "API Key created successfully");
      } catch (error) {
        showToast("error", error.message || "Failed to create API Key");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUpdateApiKey = async (
    id,
    newName,
    newApiKeyValue,
    newProvider,
  ) => {
    setLoading(true);
    try {
      await updateApiKey(id, {
        name: newName,
        api_key: newApiKeyValue,
        provider: newProvider,
      });
      await loadApiKeys();
      await reloadApiKeys(); // Update setup progress
      showToast("success", "API Key updated successfully");
    } catch (error) {
      showToast("error", error.message || "Failed to update API Key");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApiKey = async (id) => {
    if (!globalThis.confirm("Are you sure you want to delete this API key?"))
      return;

    setLoading(true);
    try {
      await deleteApiKey(id);
      await loadApiKeys();
      await reloadApiKeys(); // Update setup progress
      showToast("success", "API Key deleted successfully");
    } catch (error) {
      showToast("error", error.message || "Failed to delete API Key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col space-y-4 sm:space-y-6 max-w-full sm:max-w-4xl mx-auto my-auto max-h-[90vh]">
      {/* Setup Progress */}
      <div className="w-full max-w-4xl">
        <SetupProgress isCompact={true} />
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-content3 dark:bg-darkbg-glass dark:backdrop-blur-md shadow-glass rounded-2xl border border-border dark:border-border-dark">
          <CardHeader>
            <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
              Profile Settings
            </h1>
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
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      first_name: event.target.value,
                    }))
                  }
                  variant="bordered"
                  fullWidth
                />
                <Input
                  className="flex-1 w-full"
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      last_name: event.target.value,
                    }))
                  }
                  variant="bordered"
                  fullWidth
                />
              </div>
              <Input
                label="Email"
                value={user?.email || ""}
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

        <Card className="bg-content3 dark:bg-darkbg-glass dark:backdrop-blur-md shadow-glass rounded-2xl border border-border dark:border-border-dark">
          <CardHeader className="flex justify-between">
            <h2 className="text-xl font-bold text-foreground dark:text-foreground-dark">
              API Keys
            </h2>
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
              <div className="text-center text-foreground/60 dark:text-foreground-dark/60 py-4">
                No API keys yet. Click Add API Key to create one.
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setNewApiKey({ name: "", api_key: "", provider: "openai" });
        }}
      >
        <ModalContent>
          <form onSubmit={(e) => { e.preventDefault(); handleAddApiKey(); }}>
            <ModalHeader>Add New API Key</ModalHeader>
            <ModalBody>
              <Input
                label="API Key Name"
                placeholder="e.g., Production API Key"
                value={newApiKey.name}
                onChange={(event) =>
                  setNewApiKey((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                variant="bordered"
              />
              <Select
                label="Provider"
                placeholder="Select a provider"
                value={newApiKey.provider}
                onChange={(event) =>
                  setNewApiKey((previous) => ({
                    ...previous,
                    provider: event.target.value,
                  }))
                }
                variant="bordered"
                selectedKeys={[newApiKey.provider]}
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
                  value={newApiKey.api_key}
                  onChange={(event) =>
                    setNewApiKey((previous) => ({
                      ...previous,
                      api_key: event.target.value,
                    }))
                  }
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
              <Button
                color="danger"
                variant="light"
                onPress={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                type="submit"
                isLoading={loading}
              >
                Add Key
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default UserProfileView;
