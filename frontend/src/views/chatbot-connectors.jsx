import React, { useState, useEffect, useMemo } from "react";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalFooter,
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
import { Plus, RotateCcw, Edit, Trash, Save } from "lucide-react";
import SetupProgress from "../components/setup-progress";
import { useSetup } from "../contexts/setup-context";

const ChatbotConnectors = () => {
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

  // Load available connector parameters when technology changes
  const loadParametersForTechnology = async (technology) => {
    if (!technology) {
      setCurrentParameters([]);
      return;
    }

    try {
      const paramData = await fetchConnectorParameters(technology);
      setCurrentParameters(paramData.parameters || []);
    } catch (error) {
      console.error(
        "Error loading parameters for technology:",
        technology,
        error,
      );
      setCurrentParameters([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load connectors
        const data = await fetchChatbotConnectors();
        setConnectors(data);

        // Load available connectors from TRACER
        try {
          const connectors = await fetchAvailableConnectors();
          setAvailableConnectors(connectors);

          // Set initial selection to first available connector
          if (connectors.length > 0) {
            const firstConnector = connectors[0].name;
            setFormData((previous) => ({
              ...previous,
              technology: firstConnector,
            }));
            // Load parameters for the first connector
            loadParametersForTechnology(firstConnector);
          }
        } catch (error) {
          console.error(
            "Error loading available connectors from TRACER:",
            error,
          );
          // Fallback to empty list if TRACER is not available
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

  const loadAvailableConnectors = async () => {
    try {
      const connectors = await fetchAvailableConnectors();
      setAvailableConnectors(connectors);
      // Set initial selection to first available connector
      if (connectors.length > 0) {
        const firstConnector = connectors[0].name;
        setFormData((previous) => ({
          ...previous,
          technology: firstConnector,
        }));
        // Load parameters for the first connector
        loadParametersForTechnology(firstConnector);
      }
    } catch (error) {
      console.error("Error fetching available connectors:", error);
    }
  };

  // Handle validation of the form for both edit and create
  const handleValidation = async (event, data, oldName = "") => {
    event.preventDefault();
    setLoadingValidation(true);

    try {
      // Technology check
      if (!data.technology) {
        alert("Please select a technology");
        setLoadingValidation(false);
        return false;
      }

      // Skip check only if the user truly didn't change their name
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

      // Otherwise, check if the name exists
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
      alert("An error occurred during validation. Please try again.");
      setLoadingValidation(false);
      return false;
    }
  };

  // Called after the form is submitted
  const handleFormSubmit = async (event) => {
    event.preventDefault();

    const data = formData;

    // Validate the form
    const isValid = await handleValidation(event, data);
    if (!isValid) return;

    try {
      await createChatbotConnector(data);
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
      technology: availableConnectors[0]?.name || "",
      parameters: {},
    });
    setValidationErrors({});
  };

  // Handle the reset of the edit form so it clears the data
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
    event.preventDefault();
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
    { name: "Parameters", key: "parameters", sortable: false },
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
            items-center
            space-y-4 sm:space-y-6 lg:space-y-8
            w-full sm:max-w-4xl
            mx-auto
            my-auto
            max-h-[90vh]
            p-4 sm:p-6 lg:p-8"
    >
      <h1 className="text-2xl sm:text-3xl font-bold text-center text-foreground dark:text-foreground-dark">
        Chatbot Connectors
      </h1>

      {/* Setup Progress */}
      <div className="w-full max-w-4xl">
        <SetupProgress isCompact={true} />
      </div>

      {/* Modal to create new connector */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1 items-center">
                Create New Connector
              </ModalHeader>
              <ModalBody className="flex flex-col gap-4 items-center">
                <Form
                  className="w-full flex flex-col gap-4"
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
                      // Load parameters for the selected technology
                      loadParametersForTechnology(selectedValue);
                    }}
                    fullWidth
                  >
                    {availableConnectors.length === 0 ? (
                      <SelectItem key="no-connectors" value="" isDisabled>
                        No connectors available - TRACER may not be running
                      </SelectItem>
                    ) : (
                      availableConnectors.map((connector) => (
                        <SelectItem key={connector.name} value={connector.name}>
                          {connector.name}
                        </SelectItem>
                      ))
                    )}
                  </Select>

                  {/* Dynamic parameter fields */}
                  {currentParameters.map((param) => (
                    <Input
                      key={param.name}
                      isRequired={param.required}
                      isDisabled={loadingValidation}
                      label={`${param.name} ${param.required ? "*" : ""}`}
                      labelPlacement="outside"
                      placeholder={param.description}
                      value={
                        formData.parameters[param.name] || param.default || ""
                      }
                      isInvalid={!!validationErrors[`parameters.${param.name}`]}
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
                  ))}

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

      <h2 className="text-xl sm:text-2xl font-bold text-center text-foreground dark:text-foreground-dark">
        Existing Connectors
      </h2>

      {/* Table of existing connectors */}
      <Table
        aria-label="Chatbot Connectors Table"
        className="max-h-[60vh] sm:max-h-[50vh] overflow-y-auto"
        sortDescriptor={sortDescriptor}
        onSortChange={setSortDescriptor}
      >
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn key={column.key} allowsSorting={column.sortable}>
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          isLoading={loading}
          loadingContent={<Spinner label="Loading..." />}
          emptyContent="Create a new connector to get started."
        >
          {sortedChatbotConnectors.map((connector) => (
            <TableRow key={connector.id}>
              <TableCell className="px-2 sm:px-4">{connector.name}</TableCell>
              <TableCell className="px-2 sm:px-4">
                {connector.technology}
              </TableCell>
              <TableCell className="px-2 sm:px-4">
                {connector.parameters &&
                Object.keys(connector.parameters).length > 0 ? (
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {Object.entries(connector.parameters).map(
                      ([key, value]) => (
                        <li key={key} className="break-words">
                          <strong>{key}:</strong> {value}
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <span className="text-gray-500 italic">No parameters</span>
                )}
              </TableCell>
              <TableCell className="flex space-x-1 sm:space-x-2 px-2 sm:px-4">
                <Button
                  size="sm"
                  color="secondary"
                  variant="flat"
                  endContent={<Edit className="w-3 h-3" />}
                  onPress={() => handleEdit(connector)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  endContent={<Trash className="w-3 h-3" />}
                  onPress={() => handleDelete(connector.id)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Button to open modal */}
      <Button
        color="primary"
        onPress={onOpen}
        className="w-full sm:max-w-[200px] mx-auto h-10 sm:h-12"
        startContent={<Plus className="w-4 h-4 mr-1" />}
      >
        Create New Connector
      </Button>

      {/* Modal for editing */}
      <Modal
        isOpen={isEditOpen}
        onOpenChange={() => {
          setIsEditOpen(false);
          handleEditFormReset();
          setValidationErrors({});
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1 items-center">
                Edit Connector
              </ModalHeader>
              <ModalBody className="flex flex-col gap-4 items-center">
                <Form
                  className="w-full flex flex-col gap-4"
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
                      // Load parameters for the selected technology
                      loadParametersForTechnology(selectedValue);
                    }}
                  >
                    {availableConnectors.length === 0 ? (
                      <SelectItem key="no-connectors" value="" isDisabled>
                        No connectors available - TRACER may not be running
                      </SelectItem>
                    ) : (
                      availableConnectors.map((connector) => (
                        <SelectItem key={connector.name} value={connector.name}>
                          {connector.name}
                        </SelectItem>
                      ))
                    )}
                  </Select>

                  {/* Dynamic parameter fields for edit */}
                  {currentParameters.map((param) => (
                    <Input
                      key={param.name}
                      isRequired={param.required}
                      isDisabled={loadingValidation}
                      label={`${param.name} ${param.required ? "*" : ""}`}
                      labelPlacement="outside"
                      placeholder={param.description}
                      value={
                        editData.parameters?.[param.name] || param.default || ""
                      }
                      isInvalid={!!validationErrors[`parameters.${param.name}`]}
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
                  ))}
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
                      startContent={<Save className="w-4 h-4 mr-1" />}
                    >
                      Save
                    </Button>
                  </ModalFooter>
                </Form>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default ChatbotConnectors;
