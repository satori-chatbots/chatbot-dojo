import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  useDisclosure,
  Form,
  Spinner,
} from "@heroui/react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import {
  fetchChatbotConnectors,
  createChatbotConnector,
  fetchAvailableConnectors,
  fetchConnectorParameters,
  updateChatbotConnector,
  deleteChatbotConnector,
  checkChatbotConnectorName,
} from "../api/chatbot-connector-api";
import { Plus, RotateCcw, Edit, Trash, Save, FileText } from "lucide-react";
import SetupProgress from "../components/setup-progress";
import { useSetup } from "../contexts/setup-context";

const ChatbotConnectors = () => {
  const navigate = useNavigate();
  const { reloadConnectors } = useSetup();
  const [editData, setEditData] = useState({
    name: "",
    technology: "",
    parameters: {},
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Function to open edit modal
  const handleEdit = (tech) => {
    setEditData(tech);
    setOriginalName(tech.name);
    loadParametersForTechnology(tech.technology);
    setIsEditOpen(true);
  };

  const [connectors, setConnectors] = useState([]);
  const [availableConnectors, setAvailableConnectors] = useState([]);
  const [currentParameters, setCurrentParameters] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    technology: "",
    parameters: {},
  });

  // State of the modal to create new connector
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // Loading state for the serverside validation
  const [loadingValidation, setLoadingValidation] = useState(false);

  // Errors for the serverside validation
  const [validationErrors, setValidationErrors] = useState({});

  // State for the original name
  const [originalName, setOriginalName] = useState("");

  // Check if form is valid for submission
  const isFormValid = useMemo(() => {
    if (!formData.name || formData.name.trim() === "") return false;
    if (!formData.technology) return false;

    // Check required parameters
    for (const param of currentParameters) {
      if (param.required) {
        const value = formData.parameters?.[param.name];
        if (!value || value.toString().trim() === "") return false;
      }
    }

    return true;
  }, [formData, currentParameters]);

  // Check if edit form is valid for submission
  const isEditFormValid = useMemo(() => {
    if (!editData.name || editData.name.trim() === "") return false;
    if (!editData.technology) return false;

    // Check required parameters
    for (const param of currentParameters) {
      if (param.required) {
        const value = editData.parameters?.[param.name];
        if (!value || value.toString().trim() === "") return false;
      }
    }

    return true;
  }, [editData, currentParameters]);

  // Load parameters for the selected technology
  const loadParametersForTechnology = async (technology) => {
    if (!technology) {
      setCurrentParameters([]);
      return;
    }

    // Handle custom technology differently - no parameters needed
    if (technology === "custom") {
      setCurrentParameters([]);
      setLoadingValidation(false);
      return;
    }

    setLoadingValidation(true);
    try {
      const paramData = await fetchConnectorParameters(technology);
      const parameters = paramData.parameters || [];
      setCurrentParameters(parameters);
    } catch (error) {
      console.error("Error loading parameters:", error);
      setCurrentParameters([]);
    } finally {
      setLoadingValidation(false);
    }
  };
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load both API endpoints in parallel for better performance
        const [connectorsData, availableConnectorsData] =
          await Promise.allSettled([
            fetchChatbotConnectors(),
            fetchAvailableConnectors(),
          ]);

        if (connectorsData.status === "fulfilled") {
          setConnectors(connectorsData.value);
        } else {
          console.error("Error loading connectors:", connectorsData.reason);
        }

        if (availableConnectorsData.status === "fulfilled") {
          const connectors = availableConnectorsData.value;
          // Only add "custom" if not present in the API response
          const hasCustom = connectors.some((c) => c.name === "custom");
          const connectorsWithCustom = hasCustom
            ? connectors
            : [
                ...connectors,
                {
                  name: "custom",
                  description: "Custom connector with YAML configuration",
                  usage: "Define your own connector using YAML configuration",
                },
              ];
          setAvailableConnectors(connectorsWithCustom);

          setFormData((previous) => ({
            ...previous,
            technology: "",
            parameters: {},
          }));
        } else {
          console.error(
            "Error loading available connectors from TRACER:",
            availableConnectorsData.reason,
          );
          setAvailableConnectors([]);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const loadConnectors = async () => {
    try {
      const data = await fetchChatbotConnectors();
      setConnectors(data);
    } catch (error) {
      console.error("Error fetching chatbot connectors:", error);
    }
  };

  // Handle validation of the form for both edit and create
  const handleValidation = async (event, data, oldName = "") => {
    if (event && event.preventDefault) {
      event.preventDefault();
    }
    setLoadingValidation(true);

    const errors = {};

    try {
      // Basic validation
      if (!data.name || data.name.trim() === "") {
        errors.name = "Name is required";
      }

      // Technology check
      if (!data.technology) {
        errors.technology = "Please select a technology";
      }

      // Validate required parameters
      for (const param of currentParameters) {
        if (param.required) {
          const value = data.parameters?.[param.name];
          if (!value || value.toString().trim() === "") {
            errors[`parameters.${param.name}`] = `${param.name} is required`;
          }
        }
      }

      // If there are validation errors, show them and don't proceed
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        setLoadingValidation(false);
        return false;
      }

      // Skip server-side name check only if the user truly didn't change their name
      if (oldName && data.name === oldName) {
        console.log(
          "Skipping validation for name, name:",
          data.name,
          "originalName:",
          oldName,
        );
        setValidationErrors({});
        setLoadingValidation(false);
        return true;
      }

      // Otherwise, check if the name exists on the server
      const existsResponse = await checkChatbotConnectorName(data.name);
      if (existsResponse.exists) {
        setValidationErrors({ name: "Name already exists" });
        setLoadingValidation(false);
        return false;
      }

      setValidationErrors({});
      setLoadingValidation(false);
      return true;
    } catch (error) {
      console.error("Validation error:", error);
      setValidationErrors({
        general: "An error occurred during validation. Please try again.",
      });
      setLoadingValidation(false);
      return false;
    }
  };

  // Called after the form is submitted
  const handleFormSubmit = async (event) => {
    if (event && event.preventDefault) {
      event.preventDefault();
    }

    const data = formData;

    // Validate the form
    const isValid = await handleValidation(event, data);
    if (!isValid) return;

    try {
      const newConnector = await createChatbotConnector(data);

      // Reset form
      setFormData({
        name: "",
        technology: availableConnectors[0]?.name || "",
        parameters: {},
      });
      loadConnectors();
      await reloadConnectors(); // Update setup progress

      // Close modal
      onOpenChange(false);

      // If this is a custom connector, redirect to YAML editor
      if (data.technology === "custom") {
        navigate(`/custom-connector-editor/${newConnector.id}`);
      }
    } catch (error) {
      console.log("Error creating chatbot connector:", error);
      alert(`Error creating chatbot connector: ${error.message}`);
    } finally {
      setLoadingValidation(false);
    }
  };

  // Called when the form is reset
  const handleFormReset = () => {
    setFormData({
      name: "",
      technology: "",
      parameters: {},
    });
    setCurrentParameters([]);
    setValidationErrors({});
  };

  // Handle the reset of the edit form
  const handleEditFormReset = () => {
    setEditData({
      name: "",
      technology: "",
      parameters: {},
    });
    setValidationErrors({});
  };

  // Update connector
  const handleUpdate = async (event) => {
    if (event && event.preventDefault) {
      event.preventDefault();
    }
    const data = {
      name: editData.name,
      technology: editData.technology,
      parameters: editData.parameters,
    };

    // Now pass the stored originalName
    const isValid = await handleValidation(event, data, originalName);
    if (!isValid) return;

    try {
      await updateChatbotConnector(editData.id, data);
      setIsEditOpen(false);
      await loadConnectors();
      await reloadConnectors(); // Update setup progress
    } catch (error) {
      alert(`Error updating chatbot connector: ${error.message}`);
    }
  };

  // Delete existing connector
  const handleDelete = async (id) => {
    if (!globalThis.confirm("Are you sure you want to delete this connector?"))
      return;
    try {
      await deleteChatbotConnector(id);
      await loadConnectors();
      await reloadConnectors(); // Update setup progress
    } catch (error) {
      alert(`Error deleting chatbot connector: ${error.message}`);
    }
  };

  // Columns for table
  const columns = [
    { name: "Name", key: "name", sortable: true },
    { name: "Technology", key: "technology", sortable: true },
    {
      name: "Configuration",
      key: "parameters",
      sortable: false,
      className: "hidden lg:table-cell",
    },
    { name: "Actions", key: "actions", sortable: false },
  ];

  const [sortDescriptor, setSortDescriptor] = useState({
    column: "name",
    direction: "ascending",
  });

  const sortedChatbotConnectors = useMemo(() => {
    const { column, direction } = sortDescriptor;
    return [...connectors].sort((a, b) => {
      const first =
        column === "name"
          ? a.name
          : column === "technology"
            ? a.technology
            : column === "parameters"
              ? Object.keys(a.parameters || {}).length // Sort by number of parameters
              : a.name; // Default to name for non-sortable columns
      const second =
        column === "name"
          ? b.name
          : column === "technology"
            ? b.technology
            : column === "parameters"
              ? Object.keys(b.parameters || {}).length // Sort by number of parameters
              : b.name; // Default to name for non-sortable columns

      if (column === "parameters") {
        // For parameters, sort by number of parameters
        return direction === "ascending" ? first - second : second - first;
      }

      return direction === "ascending"
        ? first.localeCompare(second)
        : second.localeCompare(first);
    });
  }, [connectors, sortDescriptor]);

  return (
    <div
      className="flex flex-col
            w-full sm:max-w-6xl
            mx-auto
            min-h-0
            p-3 sm:p-4 md:p-6 lg:p-8
            space-y-4 sm:space-y-6"
    >
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground dark:text-foreground-dark">
            Connector Management
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-4">
            Configure and manage chatbot connectors to communicate TRACER and
            Sensei with other chatbots. Built with{" "}
            <a
              href="https://github.com/Chatbot-TRACER/chatbot-connectors"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
            >
              chatbot-connectors library
            </a>
            .
          </p>
        </div>

        {/* Setup Progress */}
        <div className="w-full max-w-4xl mx-auto px-4">
          <SetupProgress isCompact={true} />
        </div>
      </div>

      {/* Modal to create new connector */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 pb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Create New Connector
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Set up a new connector to integrate with external platforms
                </p>
              </ModalHeader>
              <ModalBody className="pt-6">
                <Form
                  className="w-full flex flex-col gap-6"
                  onSubmit={handleFormSubmit}
                  onReset={handleFormReset}
                  validationBehavior="aria"
                  validationErrors={validationErrors}
                >
                  <Input
                    isRequired
                    label="Name"
                    isDisabled={loadingValidation}
                    labelPlacement="outside"
                    name="name"
                    placeholder="Enter a name to identify the connector"
                    value={formData.name}
                    onChange={(event) => {
                      setFormData({ ...formData, name: event.target.value });
                      // Clear validation errors when user starts typing
                      if (validationErrors.name) {
                        setValidationErrors({
                          ...validationErrors,
                          name: undefined,
                        });
                      }
                    }}
                    type="text"
                    isInvalid={!!validationErrors.name}
                    errorMessage={validationErrors.name}
                  />

                  {/* Select for technology choices */}
                  <Select
                    isRequired
                    isDisabled={loadingValidation}
                    label="Technology"
                    labelPlacement="outside"
                    placeholder="Select Technology"
                    name="technology"
                    selectedKeys={
                      formData.technology ? [formData.technology] : []
                    }
                    onSelectionChange={(keys) => {
                      const selectedValue = [...keys][0];
                      setFormData((previous) => ({
                        ...previous,
                        technology: selectedValue,
                        parameters: {}, // Reset parameters when technology changes
                      }));
                      // Clear any validation errors when technology changes
                      setValidationErrors({});
                      // Load parameters for the selected technology
                      if (selectedValue) {
                        loadParametersForTechnology(selectedValue);
                      } else {
                        setCurrentParameters([]);
                      }
                    }}
                    fullWidth
                  >
                    {availableConnectors.length === 0 ? (
                      <SelectItem key="no-connectors" value="" isDisabled>
                        No connectors available - TRACER may not be running (
                        <a
                          href="https://github.com/Chatbot-TRACER/chatbot-connectors"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          learn more
                        </a>
                        )
                      </SelectItem>
                    ) : (
                      availableConnectors.map((connector) => (
                        <SelectItem key={connector.name} value={connector.name}>
                          {connector.name}
                        </SelectItem>
                      ))
                    )}
                  </Select>

                  {/* Dynamic parameter fields or custom connector info */}
                  {formData.technology === "custom" ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start space-x-3">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                            Custom YAML Configuration
                          </h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Custom connectors use YAML configuration files for
                            maximum flexibility. After creating the connector,
                            you&apos;ll be redirected to the YAML editor where
                            you can define your custom integration logic.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : loadingValidation && formData.technology ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="flex flex-col items-center space-y-3">
                        <Spinner size="md" color="primary" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Loading parameters for {formData.technology}...
                        </span>
                      </div>
                    </div>
                  ) : (
                    currentParameters.map((param) => (
                      <Input
                        key={param.name}
                        isRequired={param.required}
                        isDisabled={loadingValidation}
                        label={param.name}
                        labelPlacement="outside"
                        placeholder={param.description}
                        value={
                          formData.parameters[param.name] || param.default || ""
                        }
                        isInvalid={
                          !!validationErrors[`parameters.${param.name}`]
                        }
                        errorMessage={
                          validationErrors[`parameters.${param.name}`]
                        }
                        onValueChange={(value) => {
                          setFormData((previous) => ({
                            ...previous,
                            parameters: {
                              ...previous.parameters,
                              [param.name]: value,
                            },
                          }));
                        }}
                        fullWidth
                        type={param.type === "integer" ? "number" : "text"}
                      />
                    ))
                  )}
                </Form>

                <div className="flex flex-col sm:flex-row justify-center gap-3 w-full px-6 py-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    type="reset"
                    color="default"
                    variant="bordered"
                    startContent={<RotateCcw className="w-4 h-4" />}
                    onPress={handleFormReset}
                    className="w-full sm:w-auto"
                  >
                    Reset
                  </Button>
                  <Button
                    color="primary"
                    isDisabled={!isFormValid || loadingValidation}
                    isLoading={loadingValidation}
                    startContent={
                      !loadingValidation && <Plus className="w-4 h-4" />
                    }
                    onPress={handleFormSubmit}
                    className="w-full sm:w-auto"
                  >
                    Create Connector
                  </Button>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Main Content Section */}
      <div className="flex flex-col space-y-4 sm:space-y-6">
        {/* Header with Create Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground dark:text-foreground-dark">
              Active Connectors
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {connectors.length} connector{connectors.length === 1 ? "" : "s"}{" "}
              configured
            </p>
          </div>
          <Button
            color="primary"
            onPress={() => {
              // Reset form when opening modal
              setFormData({
                name: "",
                technology: "",
                parameters: {},
              });
              setCurrentParameters([]);
              setValidationErrors({});
              onOpen();
            }}
            className="w-full sm:w-auto"
            startContent={<Plus className="w-4 h-4" />}
            size="lg"
          >
            Add Connector
          </Button>
        </div>

        {/* Connectors Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Mobile view - Cards for small screens */}
          <div className="block sm:hidden">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Spinner label="Loading connectors..." />
              </div>
            ) : sortedChatbotConnectors.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <Plus className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      No connectors yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Get started by creating your first connector
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              sortedChatbotConnectors.map((connector) => (
                <div
                  key={connector.id}
                  className="p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="space-y-3">
                    {/* Header with name and technology */}
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {connector.name}
                        </h3>
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {connector.technology}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Configuration details */}
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {connector.technology === "custom" ? (
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <span>YAML Configuration</span>
                        </div>
                      ) : connector.parameters &&
                        Object.keys(connector.parameters).length > 0 ? (
                        <div className="space-y-1">
                          {Object.entries(connector.parameters)
                            .slice(0, 2)
                            .map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span>{" "}
                                <span className="break-all">{value}</span>
                              </div>
                            ))}
                          {Object.keys(connector.parameters).length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{Object.keys(connector.parameters).length - 2}{" "}
                              more
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="italic">No parameters</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        color="default"
                        variant="flat"
                        startContent={<Edit className="w-3 h-3" />}
                        onPress={() => handleEdit(connector)}
                        className="flex-1"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        startContent={<Trash className="w-3 h-3" />}
                        onPress={() => handleDelete(connector.id)}
                        className="flex-1"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop view - Table for larger screens */}
          <div className="hidden sm:block">
            <Table
              aria-label="Chatbot Connectors Table"
              className="min-h-[300px]"
              sortDescriptor={sortDescriptor}
              onSortChange={setSortDescriptor}
              removeWrapper
            >
              <TableHeader columns={columns}>
                {(column) => (
                  <TableColumn
                    key={column.key}
                    allowsSorting={column.sortable}
                    className={column.className}
                  >
                    {column.name}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody
                isLoading={loading}
                loadingContent={<Spinner label="Loading connectors..." />}
                emptyContent={
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <Plus className="w-6 h-6 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                          No connectors yet
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                          Get started by creating your first connector
                        </p>
                      </div>
                    </div>
                  </div>
                }
              >
                {sortedChatbotConnectors.map((connector) => (
                  <TableRow
                    key={connector.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <TableCell className="px-4 py-4 font-medium">
                      {connector.name}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {connector.technology}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 hidden lg:table-cell">
                      {connector.technology === "custom" ? (
                        <div className="flex items-center space-x-2 text-sm">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700 dark:text-gray-300">
                            YAML Configuration
                          </span>
                        </div>
                      ) : connector.parameters &&
                        Object.keys(connector.parameters).length > 0 ? (
                        <div className="space-y-1">
                          {Object.entries(connector.parameters)
                            .slice(0, 3)
                            .map(([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {key}:
                                </span>{" "}
                                <span className="text-gray-600 dark:text-gray-400 break-all">
                                  {value}
                                </span>
                              </div>
                            ))}
                          {Object.keys(connector.parameters).length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{Object.keys(connector.parameters).length - 3}{" "}
                              more
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-sm">
                          No parameters
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          color="default"
                          variant="flat"
                          startContent={<Edit className="w-3 h-3" />}
                          onPress={() => handleEdit(connector)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          startContent={<Trash className="w-3 h-3" />}
                          onPress={() => handleDelete(connector.id)}
                          className="text-xs"
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Modal for editing */}
      <Modal
        isOpen={isEditOpen}
        onOpenChange={() => {
          setIsEditOpen(false);
          handleEditFormReset();
          setValidationErrors({});
        }}
        size="lg"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 pb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Edit Connector
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Modify the configuration for &ldquo;{editData.name}&rdquo;
                </p>
              </ModalHeader>
              <ModalBody className="pt-6">
                <Form
                  className="w-full flex flex-col gap-6"
                  onSubmit={handleUpdate}
                  onReset={handleEditFormReset}
                  validationBehavior="aria"
                  validationErrors={validationErrors}
                >
                  <Input
                    isRequired
                    label="Name"
                    name="name"
                    value={editData.name}
                    isDisabled={loadingValidation}
                    onChange={(event) => {
                      setEditData({ ...editData, name: event.target.value });
                      // Clear validation errors when user starts typing
                      if (validationErrors.name) {
                        setValidationErrors({
                          ...validationErrors,
                          name: undefined,
                        });
                      }
                    }}
                    type="text"
                    isInvalid={!!validationErrors.name}
                    errorMessage={validationErrors.name}
                  />
                  <Select
                    isRequired
                    label="Technology"
                    isDisabled={loadingValidation}
                    placeholder="Select a new Technology"
                    name="technology"
                    selectedKeys={
                      editData.technology ? [editData.technology] : []
                    }
                    onSelectionChange={(keys) => {
                      const selectedValue = [...keys][0];
                      setEditData((previous) => ({
                        ...previous,
                        technology: selectedValue,
                        parameters: previous.parameters || {}, // Preserve existing parameters
                      }));
                      // Clear any validation errors when technology changes
                      setValidationErrors({});
                      // Load parameters for the selected technology
                      if (selectedValue) {
                        loadParametersForTechnology(selectedValue);
                      } else {
                        setCurrentParameters([]);
                      }
                    }}
                  >
                    {availableConnectors.length === 0 ? (
                      <SelectItem key="no-connectors" value="" isDisabled>
                        No connectors available - TRACER may not be running (
                        <a
                          href="https://github.com/Chatbot-TRACER/chatbot-connectors"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          learn more
                        </a>
                        )
                      </SelectItem>
                    ) : (
                      availableConnectors.map((connector) => (
                        <SelectItem key={connector.name} value={connector.name}>
                          {connector.name}
                        </SelectItem>
                      ))
                    )}
                  </Select>

                  {/* Dynamic parameter fields for edit or custom connector section */}
                  {editData.technology === "custom" ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start space-x-3">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                            Custom YAML Configuration
                          </h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                            This connector uses a custom YAML configuration
                            file. Use the button below to edit the configuration
                            in the dedicated editor.
                          </p>
                          <Button
                            color="primary"
                            variant="flat"
                            onPress={() => {
                              navigate(
                                `/custom-connector-editor/${editData.id || "new"}`,
                              );
                            }}
                            startContent={<Edit className="w-4 h-4" />}
                            size="sm"
                          >
                            Edit YAML Configuration
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : loadingValidation && editData.technology ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="flex flex-col items-center space-y-3">
                        <Spinner size="md" color="primary" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Loading parameters for {editData.technology}...
                        </span>
                      </div>
                    </div>
                  ) : (
                    currentParameters.map((param) => (
                      <Input
                        key={param.name}
                        isRequired={param.required}
                        isDisabled={loadingValidation}
                        label={param.name}
                        labelPlacement="outside"
                        placeholder={param.description}
                        value={
                          editData.parameters?.[param.name] ||
                          param.default ||
                          ""
                        }
                        isInvalid={
                          !!validationErrors[`parameters.${param.name}`]
                        }
                        errorMessage={
                          validationErrors[`parameters.${param.name}`]
                        }
                        onValueChange={(value) => {
                          setEditData((previous) => ({
                            ...previous,
                            parameters: {
                              ...previous.parameters,
                              [param.name]: value,
                            },
                          }));
                        }}
                        fullWidth
                        type={param.type === "integer" ? "number" : "text"}
                      />
                    ))
                  )}
                </Form>

                <div className="flex flex-col sm:flex-row justify-center gap-3 w-full px-6 py-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    type="reset"
                    color="default"
                    variant="bordered"
                    startContent={<RotateCcw className="w-4 h-4" />}
                    onPress={handleEditFormReset}
                    className="w-full sm:w-auto"
                  >
                    Reset
                  </Button>
                  <Button
                    color="primary"
                    isDisabled={!isEditFormValid || loadingValidation}
                    isLoading={loadingValidation}
                    startContent={
                      !loadingValidation && <Save className="w-4 h-4" />
                    }
                    onPress={handleUpdate}
                    className="w-full sm:w-auto"
                  >
                    Save Changes
                  </Button>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default ChatbotConnectors;
