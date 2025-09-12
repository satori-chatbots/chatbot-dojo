import React, { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Upload, Trash } from "lucide-react";
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

  return (
    <div className="flex flex-col space-y-4">
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
    </div>
  );
};

export default SenseiCheckRules;
