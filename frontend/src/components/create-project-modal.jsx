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
import { useNavigate } from "react-router-dom";

const CreateProjectModal = ({
  isOpen,
  onOpenChange,
  technologies,
  onProjectCreated,
}) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    technology: "",
    apiKey: null,
    public: false,
  });
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(true);

  const handleNavigateToTechnologies = () => {
    onOpenChange(false);
    navigate("/chatbot-technologies");
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

  const handleTechnologyChange = (event) => {
    setFormData((previous) => ({
      ...previous,
      technology: event.target.value,
    }));
  };

  const handleApiKeyChange = (event) => {
    setFormData((previous) => ({ ...previous, apiKey: event.target.value }));
  };

  const handlePublicChange = (value) => {
    setFormData((previous) => ({ ...previous, public: value }));
  };

  const handleFormReset = () => {
    setFormData({
      name: "",
      technology: "",
      apiKey: null,
      public: false,
    });
    setValidationErrors({});
  };

  const handleFormValidation = async (event) => {
    event.preventDefault();
    setLoadingValidation(true);

    if (!formData.name.trim() || !formData.technology) {
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
        chatbot_technology: formData.technology,
        api_key: formData.apiKey,
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
                    <label className="text-sm">Technology</label>
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
                    placeholder={
                      technologies.length === 0
                        ? "No technologies available"
                        : "Select chatbot technology"
                    }
                    fullWidth
                    labelPlacement="outside"
                    onChange={handleTechnologyChange}
                    isRequired
                    value={formData.technology}
                    isDisabled={loadingValidation || technologies.length === 0}
                  >
                    {technologies.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </Select>
                  {technologies.length === 0 && (
                    <p className="text-xs text-danger mt-1">
                      You need to create a technology before creating a project.
                    </p>
                  )}
                </div>

                <div className="w-full">
                  <div className="flex w-full justify-between mb-2">
                    <label className="text-sm">API Key</label>
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
                </div>

                <div className="flex w-full justify-between items-center">
                  <label className="text-sm">Make Project Public</label>
                  <Switch
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
                    isDisabled={!formData.name.trim() || !formData.technology}
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
