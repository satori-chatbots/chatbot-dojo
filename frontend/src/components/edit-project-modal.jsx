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
import { updateProject, checkProjectName } from "../api/project-api";
import { RotateCcw, Save, Settings } from "lucide-react";
import { getUserApiKeys } from "../api/authentication-api";
import { fetchLLMModels } from "../api/api-client";
import { useNavigate } from "react-router-dom";

const EditProjectModal = ({
  isOpen,
  onOpenChange,
  project,
  connectors,
  onProjectUpdated,
}) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: project?.name || "",
    connector: project?.chatbot_connector || "",
    apiKey: project?.api_key || undefined,
    llmModel: project?.llm_model || "",
    public: project?.public || false,
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

  // Update form data when project changes
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        connector: project.chatbot_connector,
        apiKey: project.api_key || undefined,
        llmModel: project.llm_model || "",
        public: project.public || false,
      });
      //console.log('Project:', project);
    }
  }, [project]);

  useEffect(() => {
    if (isOpen) {
      const loadApiKeys = async () => {
        setLoadingApiKeys(true);
        try {
          const keys = await getUserApiKeys();
          setApiKeys(keys);
          //console.log('API Keys:', keys);

          // Load models if project has an API key
          if (project?.api_key) {
            const selectedApiKey = keys.find(
              (key) => key.id === project.api_key,
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
            }
          }
        } catch (error) {
          console.error("Error fetching API keys:", error);
        } finally {
          setLoadingApiKeys(false);
        }
      };

      loadApiKeys();
    }
  }, [isOpen, project?.api_key]);

  const handleFormValidation = async (event, name, connector) => {
    event.preventDefault();
    setLoadingValidation(true);

    if (!name.trim() || !connector) {
      setLoadingValidation(false);
      return false;
    }

    // Skip validation if name hasn't changed
    if (name === project?.name) {
      setLoadingValidation(false);
      return true;
    }

    const existsResponse = await checkProjectName(name);
    if (existsResponse.exists) {
      setValidationErrors({ name: "Project name already exists" });
      setLoadingValidation(false);
      return false;
    }

    setValidationErrors({});
    setLoadingValidation(false);
    return true;
  };

  const handleUpdateProject = async (event) => {
    event.preventDefault();

    const isValid = await handleFormValidation(
      event,
      formData.name,
      formData.connector,
    );
    if (!isValid) return;

    try {
      await updateProject(project.id, {
        name: formData.name,
        chatbot_connector: formData.connector,
        api_key: formData.apiKey,
        llm_model: formData.llmModel,
        public: formData.public,
      });
      onOpenChange(false);
      if (onProjectUpdated) {
        await onProjectUpdated();
      }
    } catch (error) {
      console.error("Error updating project:", error);
      const errorData = JSON.parse(error.message);
      const errors = Object.entries(errorData).map(
        ([key, value]) => `${key}: ${value}`,
      );
      alert(`Error updating project: ${errors.join("\n")}`);
    }
  };

  const handleReset = () => {
    setFormData({
      name: project.name,
      connector: project.chatbot_connector,
      apiKey: project.api_key || undefined,
      llmModel: project.llm_model || "",
      public: project.public || false,
    });
    setValidationErrors({});
  };

  const handleProjectNameChange = (event) => {
    setFormData((previous) => ({ ...previous, name: event.target.value }));
  };

  const handleApiKeyChange = async (event) => {
    const apiKeyId = event.target.value;
    setFormData((previous) => ({
      ...previous,
      apiKey: apiKeyId,
      llmModel: "",
    }));

    // Find the selected API key to get its provider
    const selectedApiKey = apiKeys.find(
      (key) => key.id === Number.parseInt(apiKeyId),
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

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleReset();
        onOpenChange(open);
      }}
    >
      <ModalContent>
        <ModalHeader>Edit Project</ModalHeader>
        <ModalBody>
          <Form
            className="w-full flex flex-col gap-4"
            onSubmit={handleUpdateProject}
            onReset={handleReset}
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
                <label htmlFor="edit-project-connector" className="text-sm">
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
                id="edit-project-connector"
                isRequired
                labelPlacement="outside"
                placeholder={
                  connectors.length === 0
                    ? "No connectors available"
                    : "Select Connector"
                }
                name="connector"
                selectedKeys={[String(formData.connector)]}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    connector: event.target.value,
                  }))
                }
                isDisabled={loadingValidation || connectors.length === 0}
              >
                {connectors.map((tech) => (
                  <SelectItem key={String(tech.id)} value={String(tech.id)}>
                    {tech.name}
                  </SelectItem>
                ))}
              </Select>
              {connectors.length === 0 && (
                <p className="text-xs text-danger mt-1">
                  You need to create a connector before updating this project.
                </p>
              )}
            </div>

            <div className="w-full">
              <div className="flex w-full justify-between mb-2">
                <label htmlFor="edit-project-api-key" className="text-sm">
                  API Key
                </label>
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={handleNavigateToProfile}
                  startContent={<Settings className="w-3 h-3 mr-1" />}
                >
                  {apiKeys.length === 0 ? "Create API Key" : "Manage API Keys"}
                </Button>
              </div>
              <Select
                id="edit-project-api-key"
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
                selectedKeys={formData.apiKey ? [String(formData.apiKey)] : []}
              >
                {apiKeys.map((key) => (
                  <SelectItem key={key.id} value={key.id}>
                    {key.name}
                  </SelectItem>
                ))}
              </Select>
              {apiKeys.length === 0 && (
                <p className="text-xs text-foreground/60 dark:text-foreground-dark/60 mt-1">
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
                  htmlFor="edit-project-llm-model"
                  className="text-sm mb-2 block text-foreground dark:text-foreground-dark"
                >
                  LLM Model
                </label>
                <Select
                  id="edit-project-llm-model"
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
                  selectedKeys={formData.llmModel ? [formData.llmModel] : []}
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
                  <p className="text-xs text-foreground/60 dark:text-foreground-dark/60 mt-1">
                    No models available for the selected API key provider.
                  </p>
                )}
                {availableModels.length > 0 && (
                  <p className="text-xs text-foreground/60 dark:text-foreground-dark/60 mt-1">
                    This model will be used for TRACER (profile generation).
                  </p>
                )}
              </div>
            )}

            <div className="flex w-full justify-between items-center">
              <label htmlFor="edit-project-public" className="text-sm">
                Make Project Public
              </label>
              <Switch
                id="edit-project-public"
                isSelected={formData.public}
                onValueChange={handlePublicChange}
                isDisabled={loadingValidation}
              />
            </div>

            <ModalFooter className="w-full flex justify-center gap-4">
              <Button
                color="danger"
                variant="light"
                type="reset"
                startContent={<RotateCcw className="w-4 h-4 mr-1" />}
              >
                Reset
              </Button>
              <Button
                color="primary"
                type="submit"
                isDisabled={!formData.name.trim() || !formData.connector}
                startContent={<Save className="w-4 h-4 mr-1" />}
              >
                Save
              </Button>
            </ModalFooter>
          </Form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default EditProjectModal;
