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
    apiKey: project?.api_key || null,
    public: project?.public || false,
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

  // Update form data when project changes
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        technology: project.chatbot_technology,
        apiKey: project.api_key || null,
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
        } catch (error) {
          console.error("Error fetching API keys:", error);
        } finally {
          setLoadingApiKeys(false);
        }
      };

      loadApiKeys();
    }
  }, [isOpen]);

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
      apiKey: project.api_key || null,
      public: project.public || false,
    });
    setValidationErrors({});
  };

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
                isRequired
                labelPlacement="outside"
                placeholder={
                  technologies.length === 0
                    ? "No technologies available"
                    : "Select Technology"
                }
                name="technology"
                selectedKeys={[String(formData.technology)]}
                onChange={(e) =>
                  setFormData((previous) => ({
                    ...previous,
                    technology: e.target.value,
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
                <label className="text-sm">API Key</label>
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
