import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Form,
  Switch,
} from "@heroui/react";
import { createProject, checkProjectName } from "../api/project-api";
import { RotateCcw, Plus, Settings } from "lucide-react";
import { getUserApiKeys } from "../api/authentication-api";
import { fetchLLMModels } from "../api/api-client";
import { useNavigate } from "react-router-dom";

const CreateProjectModal = ({
  isOpen,
  onOpenChange,
  connectors,
  onProjectCreated,
}) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    connector: "",
    apiKey: undefined,
    llmModel: "",
    public: false,
  });
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(true);
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const handleNavigateToConnectors = () => {
    onOpenChange(false);
    navigate("/chatbot-connectors");
  };

  const handleNavigateToProfile = () => {
    onOpenChange(false);
    navigate("/profile");
  };

  useEffect(() => {
    if (isOpen) {
      const loadApiKeys = async () => {
        setLoadingApiKeys(true);
        try {
          const keys = await getUserApiKeys();
          setApiKeys(keys);
        } catch (error) {
          console.error("Error fetching API keys:", error);
        } finally {
          setLoadingApiKeys(false);
        }
      };

      loadApiKeys();
    }
  }, [isOpen]);

  const handleProjectNameChange = (event) => {
    setFormData((previous) => ({ ...previous, name: event.target.value }));
  };

  const handleConnectorChange = (event) => {
    setFormData((previous) => ({ ...previous, connector: event.target.value }));
  };

  const handleApiKeyChange = async (event) => {
    const selectedKeyId = event.target.value;
    setFormData((previous) => ({
      ...previous,
      apiKey: selectedKeyId,
      llmModel: "",
    }));

    // Find the selected API key to get its provider
    const selectedApiKey = apiKeys.find(
      (key) => key.id === Number.parseInt(selectedKeyId),
    );
    if (selectedApiKey && selectedApiKey.provider) {
      setLoadingModels(true);
      try {
        const models = await fetchLLMModels(selectedApiKey.provider);
        setAvailableModels(models);
      } catch (error) {
        console.error("Error fetching models:", error);
        setAvailableModels([]);
      } finally {
        setLoadingModels(false);
      }
    } else {
      setAvailableModels([]);
    }
  };

  const handleModelChange = (event) => {
    setFormData((previous) => ({ ...previous, llmModel: event.target.value }));
  };

  const handlePublicChange = (value) => {
    setFormData((previous) => ({ ...previous, public: value }));
  };

  const handleFormReset = () => {
    setFormData({
      name: "",
      connector: "",
      apiKey: undefined,
      llmModel: "",
      public: false,
    });
    setValidationErrors({});
    setAvailableModels([]);
  };

  const handleFormValidation = async (event) => {
    event.preventDefault();
    setLoadingValidation(true);

    if (!formData.name.trim() || !formData.connector) {
      setLoadingValidation(false);
      return false;
    }

    const existsResponse = await checkProjectName(formData.name.trim());
    if (existsResponse.exists) {
      setValidationErrors({
        name: "This name is already taken, choose another one.",
      });
      setLoadingValidation(false);
      return false;
    }

    setValidationErrors({});
    setLoadingValidation(false);
    return true;
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();

    const isValid = await handleFormValidation(event);
    if (!isValid) {
      return;
    }

    try {
      const newProject = await createProject({
        name: formData.name,
        chatbot_connector: formData.connector,
        api_key: formData.apiKey,
        llm_model: formData.llmModel,
        public: formData.public,
      });
      handleFormReset();
      onOpenChange(false);
      if (onProjectCreated) {
        onProjectCreated(newProject);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      try {
        const errorData = JSON.parse(error.message);
        const errors = Object.entries(errorData).map(
          ([key, value]) => `${key}: ${value}`,
        );
        alert(`Error creating project: ${errors.join("\n")}`);
      } catch {
        alert(`Error creating project: ${error.message}`);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1 items-center">
              Create New Project
            </ModalHeader>
            <ModalBody className="flex flex-col gap-4 items-center">
              <Form
                className="w-full flex flex-col gap-4"
                onSubmit={handleCreateProject}
                onReset={handleFormReset}
                validationBehavior="native"
                validationErrors={validationErrors}
              >
                <Input
                  placeholder="Enter project name"
                  name="name"
                  fullWidth
                  isRequired
                  labelPlacement="outside"
                  value={formData.name}
                  variant="bordered"
                  label="Project Name"
                  onChange={handleProjectNameChange}
                  maxLength={255}
                  minLength={3}
                  isDisabled={loadingValidation}
                />

                <div className="w-full">
                  <div className="flex w-full justify-between mb-2">
                    <label htmlFor="project-connector" className="text-sm">
                      Connector
                    </label>
                    <Button
                      size="sm"
                      variant="light"
                      color="primary"
                      onPress={handleNavigateToConnectors}
                      startContent={<Settings className="w-3 h-3 mr-1" />}
                    >
                      {connectors.length === 0
                        ? "Create Connector"
                        : "Manage Connectors"}
                    </Button>
                  </div>
                  <Select
                    id="project-connector"
                    placeholder={
                      connectors.length === 0
                        ? "No connectors available"
                        : "Select chatbot connector"
                    }
                    fullWidth
                    labelPlacement="outside"
                    onChange={handleConnectorChange}
                    isRequired
                    value={formData.connector}
                    isDisabled={loadingValidation || connectors.length === 0}
                  >
                    {connectors.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </Select>
                  {connectors.length === 0 && (
                    <p className="text-xs text-danger mt-1">
                      You need to create a connector before creating a project.
                    </p>
                  )}
                </div>

                <div className="w-full">
                  <div className="flex w-full justify-between mb-2">
                    <label htmlFor="project-api-key" className="text-sm">
                      API Key
                    </label>
                    <Button
                      size="sm"
                      variant="light"
                      color="primary"
                      onPress={handleNavigateToProfile}
                      startContent={<Settings className="w-3 h-3 mr-1" />}
                    >
                      {apiKeys.length === 0
                        ? "Create API Key"
                        : "Manage API Keys"}
                    </Button>
                  </div>
                  <Select
                    id="project-api-key"
                    placeholder={
                      apiKeys.length === 0
                        ? "No API Keys available"
                        : "Select API Key (Optional)"
                    }
                    fullWidth
                    labelPlacement="outside"
                    onChange={handleApiKeyChange}
                    value={formData.apiKey || ""}
                    isDisabled={loadingValidation || loadingApiKeys}
                  >
                    {apiKeys.map((key) => (
                      <SelectItem key={key.id} value={key.id}>
                        {key.name}
                      </SelectItem>
                    ))}
                  </Select>
                  {apiKeys.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      API Keys are optional but recommended for authentication.
                    </p>
                  )}
                  {apiKeys.length > 0 && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800 mt-2">
                      ℹ️ <strong>Important:</strong> API provider must match the
                      provider in your user profiles.
                    </div>
                  )}
                </div>

                {formData.apiKey && (
                  <div className="w-full">
                    <label
                      htmlFor="project-llm-model"
                      className="text-sm mb-2 block"
                    >
                      LLM Model
                    </label>
                    <Select
                      id="project-llm-model"
                      placeholder={
                        loadingModels
                          ? "Loading models..."
                          : availableModels.length === 0
                            ? "No models available"
                            : "Select LLM model"
                      }
                      fullWidth
                      labelPlacement="outside"
                      onChange={handleModelChange}
                      value={formData.llmModel}
                      isDisabled={
                        loadingValidation ||
                        loadingModels ||
                        availableModels.length === 0
                      }
                    >
                      {availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </Select>
                    {availableModels.length === 0 && !loadingModels && (
                      <p className="text-xs text-gray-500 mt-1">
                        No models available for the selected API key provider.
                      </p>
                    )}
                    {availableModels.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        This model will be used for TRACER (profile generation).
                      </p>
                    )}
                  </div>
                )}

                <div className="flex w-full justify-between items-center">
                  <label htmlFor="project-public" className="text-sm">
                    Make Project Public
                  </label>
                  <Switch
                    id="project-public"
                    isSelected={formData.public}
                    onValueChange={handlePublicChange}
                    isDisabled={loadingValidation}
                  />
                </div>

                <ModalFooter className="w-full flex justify-center gap-4">
                  <Button
                    type="reset"
                    color="danger"
                    variant="light"
                    startContent={<RotateCcw className="w-4 h-4 mr-1" />}
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    color="primary"
                    isDisabled={!formData.name.trim() || !formData.connector}
                    startContent={<Plus className="w-4 h-4 mr-1" />}
                  >
                    Create
                  </Button>
                </ModalFooter>
              </Form>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default CreateProjectModal;
