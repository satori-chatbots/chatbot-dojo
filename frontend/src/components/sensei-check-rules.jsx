import React, { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Checkbox,
  Chip,
} from "@heroui/react";
import { Upload, Trash, Play, User, Calendar, FileText } from "lucide-react";
import { uploadSenseiCheckRules, deleteSenseiCheckRule } from "../api/file-api";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

const SenseiCheckRules = ({ project, rules, reloadRules }) => {
  const [selectedFiles, setSelectedFiles] = useState();
  const fileInputReference = useRef();
  const { showToast } = useMyCustomToast();
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    isLoading: false,
    ruleId: undefined,
  });
  const [executeSenseiCheckModal, setExecuteSenseiCheckModal] = useState({
    isOpen: false,
    isLoading: false,
  });
  const [selectedSenseiResults, setSelectedSenseiResults] = useState(new Set());

  // TODO: Replace with actual API call to fetch sensei test cases (TestCase model)
  const fakeSenseiChatResults = [
    {
      id: 1,
      name: "User Authentication Test",
      executed_at: "2025-09-15T09:30:00Z",
      status: "SUCCESS",
      execution_time: 245.5,
      llm_model: "gpt-4o-mini",
      llm_provider: "openai",
      total_conversations: 15,
      executed_conversations: 15,
      technology: "REST API",
      profiles_names: ["auth_login", "auth_register", "auth_logout"],
    },
    {
      id: 2,
      name: "Database Query Performance",
      executed_at: "2025-09-14T14:22:00Z",
      status: "SUCCESS",
      execution_time: 180.2,
      llm_model: "gemini-2.0-flash",
      llm_provider: "gemini",
      total_conversations: 12,
      executed_conversations: 12,
      technology: "GraphQL",
      profiles_names: ["db_select", "db_insert", "db_update", "db_delete"],
    },
    {
      id: 3,
      name: "API Rate Limiting Test",
      executed_at: "2025-09-13T11:15:00Z",
      status: "FAILED",
      execution_time: 45.8,
      llm_model: "gpt-4o-mini",
      llm_provider: "openai",
      total_conversations: 8,
      executed_conversations: 5,
      technology: "REST API",
      profiles_names: ["rate_limit_basic", "rate_limit_burst"],
      error_message: "Connection timeout after 30 seconds",
    },
    {
      id: 4,
      name: "Frontend Component Testing",
      executed_at: "2025-09-12T16:45:00Z",
      status: "SUCCESS",
      execution_time: 320.1,
      llm_model: "gemini-2.0-flash",
      llm_provider: "gemini",
      total_conversations: 25,
      executed_conversations: 25,
      technology: "WebDriver",
      profiles_names: [
        "component_render",
        "component_interaction",
        "component_state",
        "component_props",
        "component_lifecycle",
      ],
    },
  ];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((acceptedFiles) => {
      setSelectedFiles(acceptedFiles);
    }, []),
    accept: {
      "text/yaml": [".yaml", ".yml"],
    },
    noClick: false,
  });

  const handleUpload = () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      alert("Please select files to upload.");
      return;
    }

    const formData = new FormData();
    for (const selectedFile of selectedFiles) {
      formData.append("file", selectedFile);
    }

    formData.append("project", project.id);
    uploadSenseiCheckRules(formData)
      .then(async () => {
        await reloadRules();
        setSelectedFiles(undefined);
        if (fileInputReference.current) {
          fileInputReference.current.value = undefined;
        }
        showToast("success", "SENSEI Check rules uploaded successfully!");
      })
      .catch((error) => {
        console.error("Error uploading SENSEI Check rules:", error);
        showToast("error", "Error uploading SENSEI Check rules");
      });
  };

  const handleDelete = (ruleId) => {
    setDeleteConfirmModal({ isOpen: true, isLoading: false, ruleId });
  };

  const confirmDelete = async () => {
    setDeleteConfirmModal((previous) => ({ ...previous, isLoading: true }));
    try {
      await deleteSenseiCheckRule(deleteConfirmModal.ruleId);
      await reloadRules();
      showToast("success", "SENSEI Check rule deleted successfully!");
    } catch (error) {
      console.error("Error deleting SENSEI Check rule:", error);
      showToast("error", "Error deleting SENSEI Check rule.");
    } finally {
      setDeleteConfirmModal({
        isOpen: false,
        isLoading: false,
        ruleId: undefined,
      });
    }
  };

  const handleExecuteSenseiCheck = () => {
    if (rules.length === 0) {
      showToast(
        "warning",
        "No SENSEI Check rules available. Please upload rules first.",
      );
      return;
    }
    setSelectedSenseiResults(new Set());
    setExecuteSenseiCheckModal({ isOpen: true, isLoading: false });
  };

  const handleSelectAllResults = () => {
    if (selectedSenseiResults.size === fakeSenseiChatResults.length) {
      setSelectedSenseiResults(new Set());
    } else {
      setSelectedSenseiResults(
        new Set(fakeSenseiChatResults.map((result) => result.id)),
      );
    }
  };

  const handleResultSelection = (resultId) => {
    const newSelected = new Set(selectedSenseiResults);
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId);
    } else {
      newSelected.add(resultId);
    }
    setSelectedSenseiResults(newSelected);
  };

  const executeChecksOnSelectedResults = async () => {
    if (selectedSenseiResults.size === 0) {
      showToast(
        "warning",
        "Please select at least one sensei result to check.",
      );
      return;
    }

    setExecuteSenseiCheckModal((previous) => ({
      ...previous,
      isLoading: true,
    }));

    try {
      // TODO: Implement actual API call to execute sensei-check on selected TestCase results
      // const selectedTestCaseIds = Array.from(selectedSenseiResults);
      // await executeSenseiCheckOnTestCases(selectedTestCaseIds, rules);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      showToast(
        "success",
        `SENSEI Check executed on ${selectedSenseiResults.size} result(s) successfully!`,
      );
      setExecuteSenseiCheckModal({ isOpen: false, isLoading: false });
      setSelectedSenseiResults(new Set());
    } catch (error) {
      console.error("Error executing SENSEI Check:", error);
      showToast("error", "Error executing SENSEI Check.");
      setExecuteSenseiCheckModal((previous) => ({
        ...previous,
        isLoading: false,
      }));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTestCaseStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case "SUCCESS":
        return "success";
      case "FAILED":
      case "FAILURE":
        return "danger";
      case "RUNNING":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Execute SENSEI Check Button */}
      <div className="flex justify-end">
        <Button
          color="primary"
          startContent={<Play className="w-4 h-4" />}
          onPress={handleExecuteSenseiCheck}
          isDisabled={rules.length === 0}
        >
          Execute SENSEI Check
        </Button>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-5 transition-all duration-300 ease-in-out flex flex-col items-center justify-center ${
          isDragActive
            ? "border-primary bg-primary-50 dark:bg-primary-900/20 shadow-lg"
            : "border-border dark:border-border-dark hover:border-gray-400 dark:hover:border-gray-500"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2 mb-2">
          <Upload
            className={`transition-all duration-300 ease-in-out ${
              isDragActive
                ? "text-primary scale-125 opacity-80"
                : "text-foreground/50 dark:text-foreground-dark/50 hover:text-foreground/70 dark:hover:text-foreground-dark/70"
            } w-10 h-10`}
          />
          <div className="text-center">
            <p
              className={`text-sm font-medium transition-all duration-300 ${
                isDragActive
                  ? "text-primary"
                  : "text-foreground dark:text-foreground-dark"
              }`}
            >
              {isDragActive
                ? "Drop SENSEI Check rule files here"
                : "Drag and drop SENSEI Check rule files here"}
            </p>
            <p className="text-xs mt-0.5 text-foreground/60 dark:text-foreground-dark/60">
              or click to browse
            </p>
          </div>
        </div>

        {selectedFiles && selectedFiles.length > 0 && (
          <div className="mt-4 w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {selectedFiles.length === 1
                  ? "1 file selected"
                  : `${selectedFiles.length} files selected`}
              </span>
              <Button
                size="sm"
                variant="light"
                color="danger"
                onPress={() => {
                  setSelectedFiles(undefined);
                  if (fileInputReference.current) {
                    fileInputReference.current.value = undefined;
                  }
                }}
              >
                Clear
              </Button>
            </div>
            <div className="bg-background-subtle dark:bg-darkbg-card rounded-md p-2 max-h-28 overflow-y-auto backdrop-blur-sm border border-border dark:border-border-dark">
              <ul className="text-sm text-foreground/70 dark:text-foreground-dark/70 space-y-1">
                {[...selectedFiles].map((file, index) => (
                  <li key={index} className="truncate flex items-center">
                    <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
            <Button
              className="mt-3 w-full"
              color="primary"
              onPress={handleUpload}
              startContent={<Upload className="w-4 h-4" />}
            >
              Upload{" "}
              {selectedFiles.length > 1
                ? `${selectedFiles.length} Files`
                : "File"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto mt-4">
        {rules.length > 0 ? (
          <div className="space-y-1">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between bg-background-subtle dark:bg-darkbg-card rounded-md p-2 border border-border dark:border-border-dark"
              >
                <span className="text-sm font-medium text-foreground dark:text-foreground-dark">
                  {rule.name}
                </span>
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  isIconOnly
                  onPress={() => handleDelete(rule.id)}
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-foreground/60 dark:text-foreground-dark/60 text-center">
            No SENSEI Check rules uploaded yet.
          </p>
        )}
      </div>

      <Modal
        isOpen={deleteConfirmModal.isOpen}
        onOpenChange={(isOpen) =>
          setDeleteConfirmModal((previous) => ({ ...previous, isOpen }))
        }
      >
        <ModalContent>
          <ModalHeader>Confirm Deletion</ModalHeader>
          <ModalBody className="text-foreground/70 dark:text-foreground-dark/70">
            Are you sure you want to delete this SENSEI Check rule?
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              onPress={() =>
                setDeleteConfirmModal({
                  isOpen: false,
                  isLoading: false,
                  ruleId: undefined,
                })
              }
            >
              Cancel
            </Button>
            <Button
              color="danger"
              isLoading={deleteConfirmModal.isLoading}
              onPress={confirmDelete}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Execute SENSEI Check Modal */}
      <Modal
        isOpen={executeSenseiCheckModal.isOpen}
        onOpenChange={(isOpen) =>
          setExecuteSenseiCheckModal((previous) => ({ ...previous, isOpen }))
        }
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h3>Execute SENSEI Check</h3>
            <p className="text-sm text-foreground/60 dark:text-foreground-dark/60">
              Select which SENSEI test case results to run the SENSEI Check
              rules against
            </p>
          </ModalHeader>
          <ModalBody>
            {fakeSenseiChatResults.length > 0 ? (
              <div className="space-y-4">
                {/* Select All Checkbox */}
                <div className="flex items-center justify-between border-b border-border dark:border-border-dark pb-3">
                  <Checkbox
                    isSelected={
                      selectedSenseiResults.size ===
                      fakeSenseiChatResults.length
                    }
                    isIndeterminate={
                      selectedSenseiResults.size > 0 &&
                      selectedSenseiResults.size < fakeSenseiChatResults.length
                    }
                    onValueChange={handleSelectAllResults}
                  >
                    <span className="font-medium">
                      Select All ({fakeSenseiChatResults.length} results)
                    </span>
                  </Checkbox>
                  <Chip size="sm" variant="flat" color="primary">
                    {selectedSenseiResults.size} selected
                  </Chip>
                </div>

                {/* Sensei Results List */}
                <div className="space-y-3">
                  {fakeSenseiChatResults.map((result) => (
                    <div
                      key={result.id}
                      className={`border rounded-lg p-4 transition-all duration-200 ${
                        selectedSenseiResults.has(result.id)
                          ? "border-primary bg-primary-50 dark:bg-primary-900/20"
                          : "border-border dark:border-border-dark bg-background-subtle dark:bg-darkbg-card"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          isSelected={selectedSenseiResults.has(result.id)}
                          onValueChange={() => handleResultSelection(result.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-foreground dark:text-foreground-dark truncate">
                              {result.name}
                            </h4>
                            <Chip
                              size="sm"
                              color={getTestCaseStatusColor(result.status)}
                              variant="flat"
                            >
                              {result.status}
                            </Chip>
                          </div>

                          {result.error_message && (
                            <p className="text-sm text-danger-600 dark:text-danger-400 mb-2 line-clamp-2">
                              Error: {result.error_message}
                            </p>
                          )}

                          <div className="grid grid-cols-2 gap-4 text-xs text-foreground/60 dark:text-foreground-dark/60 mb-3">
                            <div>
                              <span className="block">Executed:</span>
                              <span className="text-foreground dark:text-foreground-dark">
                                {formatDate(result.executed_at)}
                              </span>
                            </div>
                            <div>
                              <span className="block">Execution Time:</span>
                              <span className="text-foreground dark:text-foreground-dark">
                                {result.execution_time
                                  ? `${result.execution_time.toFixed(1)}s`
                                  : "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="block">LLM Model:</span>
                              <span className="text-foreground dark:text-foreground-dark">
                                {result.llm_model || "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="block">Conversations:</span>
                              <span className="text-foreground dark:text-foreground-dark">
                                {result.executed_conversations}/
                                {result.total_conversations}
                              </span>
                            </div>
                          </div>

                          {result.profiles_names &&
                            result.profiles_names.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {result.profiles_names
                                  .slice(0, 3)
                                  .map((profile, index) => (
                                    <Chip
                                      key={index}
                                      size="sm"
                                      variant="bordered"
                                      className="text-xs"
                                    >
                                      {profile}
                                    </Chip>
                                  ))}
                                {result.profiles_names.length > 3 && (
                                  <Chip
                                    size="sm"
                                    variant="bordered"
                                    className="text-xs"
                                  >
                                    +{result.profiles_names.length - 3} more
                                  </Chip>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto text-foreground/30 dark:text-foreground-dark/30 mb-3" />
                <p className="text-foreground/60 dark:text-foreground-dark/60">
                  No SENSEI test case results found for this project.
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              onPress={() => {
                setExecuteSenseiCheckModal({ isOpen: false, isLoading: false });
                setSelectedSenseiResults(new Set());
              }}
              isDisabled={executeSenseiCheckModal.isLoading}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={executeChecksOnSelectedResults}
              isLoading={executeSenseiCheckModal.isLoading}
              isDisabled={selectedSenseiResults.size === 0}
              startContent={
                !executeSenseiCheckModal.isLoading && (
                  <Play className="w-4 h-4" />
                )
              }
            >
              {executeSenseiCheckModal.isLoading
                ? `Executing on ${selectedSenseiResults.size} result(s)...`
                : `Execute Check on ${selectedSenseiResults.size} result(s)`}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default SenseiCheckRules;
