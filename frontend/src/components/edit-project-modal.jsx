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
  technologies,
  onProjectUpdated,
}) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: project?.name || "",
    technology: project?.chatbot_technology || "",
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

  const handleNavigateToTechnologies = () => {
    onOpenChange(false);
    navigate("/chatbot-technologies");
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
        technology: project.chatbot_technology,
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

  const handleFormValidation = async (event, name, technology) => {
    event.preventDefault();
    setLoadingValidation(true);

    if (!name.trim() || !technology) {
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
      formData.technology,
    );
    if (!isValid) return;

    try {
      await updateProject(project.id, {
        name: formData.name,
        chatbot_technology: formData.technology,
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
      technology: project.chatbot_technology,
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
    const selectedApiKey = apiKeys.find((key) => key.id === parseInt(apiKeyId));
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
                <label htmlFor="edit-project-technology" className="text-sm">
                  Technology
                </label>
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={handleNavigateToTechnologies}
                  startContent={<Settings className="w-3 h-3 mr-1" />}
                >
                  {technologies.length === 0
                    ? "Create Technology"
                    : "Manage Technologies"}
                </Button>
              </div>
              <Select
                id="edit-project-technology"
                isRequired
                labelPlacement="outside"
                placeholder={
                  technologies.length === 0
                    ? "No technologies available"
                    : "Select Technology"
                }
                name="technology"
                selectedKeys={[String(formData.technology)]}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    technology: event.target.value,
                  }))
                }
                isDisabled={loadingValidation || technologies.length === 0}
              >
                {technologies.map((tech) => (
                  <SelectItem key={String(tech.id)} value={String(tech.id)}>
                    {tech.name}
                  </SelectItem>
                ))}
              </Select>
              {technologies.length === 0 && (
                <p className="text-xs text-danger mt-1">
                  You need to create a technology before updating this project.
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
                <p className="text-xs text-gray-500 mt-1">
                  API Keys are optional but recommended for authentication.
                </p>
              )}
            </div>

            {formData.apiKey && (
              <div className="w-full">
                <label
                  htmlFor="edit-project-llm-model"
                  className="text-sm mb-2 block"
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
                  <p className="text-xs text-gray-500 mt-1">
                    No models available for the selected API key provider.
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
                isDisabled={!formData.name.trim() || !formData.technology}
                startContent={<Save className="w-4 h-4 mr-1" />}
              >
                Update
              </Button>
            </ModalFooter>
          </Form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default EditProjectModal;
