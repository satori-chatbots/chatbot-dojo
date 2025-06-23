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
  fetchChatbotTechnologies,
  createChatbotTechnology,
  fetchTechnologyChoices,
  updateChatbotTechnology,
  deleteChatbotTechnology,
  checkChatbotTechnologyName,
} from "../api/chatbot-technology-api";
import { Plus, RotateCcw, Edit, Trash, Save } from "lucide-react";

const ChatbotTechnologies = () => {
  const [editData, setEditData] = useState({
    name: "",
    technology: "",
    link: "",
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Function to open edit modal
  const handleEdit = (tech) => {
    setEditData(tech);
    setOriginalName(tech.name);
    setIsEditOpen(true);
  };

  const [technologies, setTechnologies] = useState([]);
  const [technologyChoices, setTechnologyChoices] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    technology: "",
    link: "",
  });

  // State of the modal to create new technology
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // Loading state for the serverside validation
  const [loadingValidation, setLoadingValidation] = useState(false);

  // Errors for the serverside validation
  const [validationErrors, setValidationErrors] = useState({});

  // State for the original name
  const [originalName, setOriginalName] = useState("");

  useEffect(() => {
    try {
      loadTechnologies();
      loadTechnologyChoices();
    } catch (error) {
      console.error("Error loading chatbot technologies:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTechnologies = async () => {
    try {
      const data = await fetchChatbotTechnologies();
      setTechnologies(data);
    } catch (error) {
      console.error("Error fetching chatbot technologies:", error);
    }
  };

  const loadTechnologyChoices = async () => {
    try {
      const choices = await fetchTechnologyChoices();
      setTechnologyChoices(choices); // each choice is [key, value]
      // Set initial selection
      setFormData((previous) => ({
        ...previous,
        technology: choices[0]?.[0] || "",
      }));
    } catch (error) {
      console.error("Error fetching technology choices:", error);
    }
  };

  // Handle validation of the form for both edit and create
  const handleValidation = async (event, data, oldName = "") => {
    event.preventDefault();
    setLoadingValidation(true);

    try {
      // URL check
      if (data.link && !/^https?:\/\//.test(data.link)) {
        alert("Please enter a valid URL or leave it empty");
        setLoadingValidation(false);
        return false;
      }

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
      const existsResponse = await checkChatbotTechnologyName(data.name);
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
      await createChatbotTechnology(data);
      // Reset form
      setFormData({
        name: "",
        technology: technologyChoices[0]?.[0] || "",
        link: "",
      });
      loadTechnologies();
      // Close modal
      onOpenChange(false);
    } catch (error) {
      console.log("Error creating chatbot technology:", error);
      alert(`Error creating chatbot technology: ${error.message}`);
    } finally {
      setLoadingValidation(false);
    }
  };

  // Called when the form is reset
  const handleFormReset = () => {
    setFormData({
      name: "",
      technology: technologyChoices[0]?.[0] || "",
      link: "",
    });
    setValidationErrors({});
  };

  // Handle the reset of the edit form so it clears the data
  const handleEditFormReset = () => {
    setEditData({
      name: "",
      technology: "",
      link: "",
    });
    setValidationErrors({});
  };

  // Update technology
  const handleUpdate = async (event) => {
    event.preventDefault();
    const data = {
      name: editData.name,
      technology: editData.technology,
      link: editData.link,
    };

    // Now pass the stored originalName
    const isValid = await handleValidation(event, data, originalName);
    if (!isValid) return;

    try {
      await updateChatbotTechnology(editData.id, data);
      setIsEditOpen(false);
      await loadTechnologies();
    } catch (error) {
      alert(`Error updating chatbot technology: ${error.message}`);
    }
  };

  // Delete existing technology
  const handleDelete = async (id) => {
    if (!globalThis.confirm("Are you sure you want to delete this technology?"))
      return;
    try {
      await deleteChatbotTechnology(id);
      await loadTechnologies();
    } catch (error) {
      alert(`Error deleting chatbot technology: ${error.message}`);
    }
  };

  // Columns for table
  const columns = [
    { name: "Name", key: "name", sortable: true },
    { name: "Technology", key: "technology", sortable: true },
    { name: "URL", key: "link", sortable: true },
    { name: "Actions", key: "actions", sortable: false },
  ];

  const [sortDescriptor, setSortDescriptor] = useState({
    column: "name",
    direction: "ascending",
  });

  const sortedChatbotTechnologies = useMemo(() => {
    const { column, direction } = sortDescriptor;
    return [...technologies].sort((a, b) => {
      const first =
        column === "name"
          ? a.name
          : column === "technology"
            ? a.technology
            : a.link;
      const second =
        column === "name"
          ? b.name
          : column === "technology"
            ? b.technology
            : b.link;
      return direction === "ascending"
        ? first.localeCompare(second)
        : second.localeCompare(first);
    });
  }, [technologies, sortDescriptor]);

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
      <h1 className="text-2xl sm:text-3xl font-bold text-center">
        Chatbot Technologies
      </h1>

      {/* Modal to create new technology */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1 items-center">
                Create New Technology
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
                    placeholder="Enter a name to identify the technology"
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
                      }));
                    }}
                    fullWidth
                  >
                    {technologyChoices.map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value}
                      </SelectItem>
                    ))}
                  </Select>

                  <Input
                    isDisabled={loadingValidation}
                    errorMessage="Please enter a valid URL"
                    label="URL (optional)"
                    labelPlacement="outside"
                    name="link"
                    placeholder="Enter a URL to the technology"
                    value={formData.link}
                    onChange={(event) =>
                      setFormData({ ...formData, link: event.target.value })
                    }
                    isInvalid={
                      formData.link.length > 0 &&
                      !/^https?:\/\//.test(formData.link)
                    }
                    type="url"
                  />

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

      <h2 className="text-xl sm:text-2xl font-bold text-center">
        Existing Technologies
      </h2>

      {/* Table of existing technologies */}
      <Table
        aria-label="Chatbot Technologies Table"
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
          emptyContent="Create a new technology to get started."
        >
          {sortedChatbotTechnologies.map((tech) => (
            <TableRow key={tech.id}>
              <TableCell className="px-2 sm:px-4">{tech.name}</TableCell>
              <TableCell className="px-2 sm:px-4">{tech.technology}</TableCell>
              <TableCell className="px-2 sm:px-4">
                <a href={tech.link} target="_blank" rel="noopener noreferrer">
                  {tech.link}
                </a>
              </TableCell>
              <TableCell className="flex space-x-1 sm:space-x-2 px-2 sm:px-4">
                <Button
                  size="sm"
                  color="secondary"
                  variant="flat"
                  endContent={<Edit className="w-3 h-3" />}
                  onPress={() => handleEdit(tech)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  endContent={<Trash className="w-3 h-3" />}
                  onPress={() => handleDelete(tech.id)}
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
        Create New Technology
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
                Edit Technology
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
                      }));
                    }}
                  >
                    {technologyChoices.map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value}
                      </SelectItem>
                    ))}
                  </Select>
                  <Input
                    label="URL (optional)"
                    name="link"
                    value={editData.link}
                    onChange={(event) =>
                      setEditData({ ...editData, link: event.target.value })
                    }
                    isDisabled={loadingValidation}
                    type="url"
                  />
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

export default ChatbotTechnologies;
