import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  Button,
  Input,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Pagination,
  Select,
  SelectItem,
  Divider,
} from "@heroui/react";
import {
  Search,
  Eye,
  Trash,
  Download,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

const SenseiCheckResultsDashboard = ({ project }) => {
  const { showToast } = useMyCustomToast();
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedResult, setSelectedResult] = useState();
  const [detailModal, setDetailModal] = useState({ isOpen: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    resultId: undefined,
  });

  const itemsPerPage = 10;

  // Load results from localStorage
  const loadResults = useCallback(() => {
    try {
      let allResults = [];

      // Try to load project-specific results first
      if (project?.id) {
        const projectKey = `senseiCheckResults_${project.id}`;
        const projectResults = localStorage.getItem(projectKey);
        if (projectResults) {
          const parsed = JSON.parse(projectResults);
          allResults = [...parsed];
        }
      }

      // If no project-specific results or no project selected, try to load 'all' results
      if (allResults.length === 0) {
        const allKey = `senseiCheckResults_all`;
        const allStoredResults = localStorage.getItem(allKey);
        if (allStoredResults) {
          const parsed = JSON.parse(allStoredResults);
          allResults = [...parsed];
        }
      }

      // Also check for any results in localStorage with senseiCheckResults prefix
      if (allResults.length === 0) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("senseiCheckResults_")) {
            try {
              const value = localStorage.getItem(key);
              const parsed = JSON.parse(value || "[]");
              if (parsed.length > 0) {
                allResults = [...allResults, ...parsed];
              }
            } catch (e) {
              // Skip invalid entries
            }
          }
        }
      }

      if (allResults.length > 0) {
        // Sort by execution date, newest first
        allResults.sort(
          (a, b) => new Date(b.executedAt) - new Date(a.executedAt),
        );
        // Remove duplicates based on ID
        const uniqueResults = allResults.filter(
          (result, index, self) =>
            index === self.findIndex((r) => r.id === result.id),
        );
        setResults(uniqueResults);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("Error loading SENSEI check results:", error);
      setResults([]);
    }
  }, [project?.id]);

  // Save results to localStorage
  const saveResults = useCallback(
    (newResults) => {
      try {
        localStorage.setItem(
          `senseiCheckResults_${project?.id || "all"}`,
          JSON.stringify(newResults),
        );
      } catch (error) {
        console.error("Error saving SENSEI check results:", error);
        showToast("error", "Failed to save results to local storage");
      }
    },
    [project?.id, showToast],
  );

  // Filter results based on search term and status
  useEffect(() => {
    let filtered = results;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (result) =>
          result.command_executed
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          result.stdout?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          result.executionId?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((result) => {
        if (statusFilter === "success") return result.exit_code === 0;
        if (statusFilter === "error") return result.exit_code !== 0;
        return true;
      });
    }

    setFilteredResults(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [results, searchTerm, statusFilter]);

  // Load results on component mount and project change
  useEffect(() => {
    loadResults();
  }, [loadResults]);

  // Delete a result
  const deleteResult = (resultId) => {
    const updatedResults = results.filter((result) => result.id !== resultId);
    setResults(updatedResults);
    saveResults(updatedResults);
    setDeleteModal({ isOpen: false, resultId: undefined });
    showToast("success", "Result deleted successfully");
  };

  // Export result as JSON
  const exportResult = (result) => {
    const dataStr = JSON.stringify(result, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sensei-check-result-${result.executionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("success", "Result exported successfully");
  };

  // Export all results as JSON
  const exportAllResults = () => {
    if (results.length === 0) {
      showToast("warning", "No results to export");
      return;
    }

    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sensei-check-results-${project?.name || "all"}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("success", "All results exported successfully");
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (exitCode) => {
    return exitCode === 0 ? "success" : "danger";
  };

  const getStatusIcon = (exitCode) => {
    return exitCode === 0 ? <CheckCircle size={16} /> : <XCircle size={16} />;
  };

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">SENSEI Check Results</h2>
          <p className="text-foreground-500">
            {project ? `Results for ${project.name}` : "All results"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            color="default"
            variant="bordered"
            startContent={<RefreshCw size={16} />}
            onPress={loadResults}
          >
            Refresh
          </Button>
          <Button
            color="primary"
            variant="bordered"
            startContent={<Download size={16} />}
            onPress={exportAllResults}
            isDisabled={results.length === 0}
          >
            Export All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search results..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              startContent={<Search size={16} />}
              className="md:max-w-xs"
            />
            <Select
              label="Status Filter"
              value={statusFilter}
              onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0])}
              className="md:max-w-xs"
            >
              <SelectItem key="all" value="all">
                All Status
              </SelectItem>
              <SelectItem key="success" value="success">
                Success Only
              </SelectItem>
              <SelectItem key="error" value="error">
                Errors Only
              </SelectItem>
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Results List */}
      {filteredResults.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <FileText size={48} className="mx-auto mb-4 text-foreground-300" />
            <h3 className="text-lg font-medium mb-2">No Results Found</h3>
            <p className="text-foreground-500">
              {results.length === 0
                ? "No SENSEI check results have been executed yet."
                : "No results match your current filters."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Results Cards */}
          {paginatedResults.map((result) => (
            <Card key={result.id} className="hover:shadow-lg transition-shadow">
              <CardBody>
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                    {/* Header with status */}
                    <div className="flex items-center gap-3">
                      <Chip
                        color={getStatusColor(result.exit_code)}
                        variant="flat"
                        startContent={getStatusIcon(result.exit_code)}
                      >
                        {result.exit_code === 0 ? "Success" : "Failed"}
                      </Chip>
                      <span className="text-sm text-foreground-500">
                        Exit Code: {result.exit_code}
                      </span>
                    </div>

                    {/* Execution details */}
                    <div className="flex items-center gap-4 text-sm text-foreground-600">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(result.executedAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText size={14} />
                        {result.test_cases_checked} test cases
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        ID: {result.executionId}
                      </div>
                    </div>

                    {/* Command preview */}
                    <div className="bg-background-subtle rounded p-2">
                      <code className="text-xs">
                        {result.command_executed?.length > 100
                          ? `${result.command_executed.substring(0, 100)}...`
                          : result.command_executed}
                      </code>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => {
                        setSelectedResult(result);
                        setDetailModal({ isOpen: true });
                      }}
                      startContent={<Eye size={14} />}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => exportResult(result)}
                      startContent={<Download size={14} />}
                    >
                      Export
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() =>
                        setDeleteModal({ isOpen: true, resultId: result.id })
                      }
                      startContent={<Trash size={14} />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                total={totalPages}
                page={currentPage}
                onChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal({ isOpen: false })}
        size="5xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-3">
              <span>SENSEI Check Result Details</span>
              {selectedResult && (
                <Chip
                  color={getStatusColor(selectedResult.exit_code)}
                  variant="flat"
                  startContent={getStatusIcon(selectedResult.exit_code)}
                >
                  {selectedResult.exit_code === 0 ? "Success" : "Failed"}
                </Chip>
              )}
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedResult && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-sm text-foreground/60">
                      Executed At:
                    </span>
                    <p className="font-medium">
                      {formatDate(selectedResult.executedAt)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-foreground/60">
                      Exit Code:
                    </span>
                    <p className="font-medium">{selectedResult.exit_code}</p>
                  </div>
                  <div>
                    <span className="text-sm text-foreground/60">
                      Execution ID:
                    </span>
                    <p className="font-medium">{selectedResult.executionId}</p>
                  </div>
                  <div>
                    <span className="text-sm text-foreground/60">
                      Test Cases Checked:
                    </span>
                    <p className="font-medium">
                      {selectedResult.test_cases_checked}
                    </p>
                  </div>
                </div>

                <Divider />

                {/* Command Executed */}
                <div className="space-y-2">
                  <h4 className="font-medium">Command Executed:</h4>
                  <code className="text-sm bg-background-subtle p-3 rounded block overflow-x-auto">
                    {selectedResult.command_executed}
                  </code>
                </div>

                {/* Standard Output */}
                {selectedResult.stdout && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Output:</h4>
                    <pre className="text-sm bg-background-subtle p-3 rounded overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
                      {selectedResult.stdout}
                    </pre>
                  </div>
                )}

                {/* Standard Error */}
                {selectedResult.stderr && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-danger-600">Errors:</h4>
                    <pre className="text-sm bg-danger-50 border border-danger-200 p-3 rounded overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap text-danger-700">
                      {selectedResult.stderr}
                    </pre>
                  </div>
                )}

                {/* CSV Results */}
                {selectedResult.csv_results && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Statistics (CSV):</h4>
                    <pre className="text-sm bg-background-subtle p-3 rounded overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
                      {selectedResult.csv_results}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => setDetailModal({ isOpen: false })}
            >
              Close
            </Button>
            {selectedResult && (
              <Button
                color="primary"
                onPress={() => exportResult(selectedResult)}
                startContent={<Download size={16} />}
              >
                Export
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, resultId: undefined })}
      >
        <ModalContent>
          <ModalHeader>Confirm Delete</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete this SENSEI check result? This
              action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() =>
                setDeleteModal({ isOpen: false, resultId: undefined })
              }
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={() => deleteResult(deleteModal.resultId)}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default SenseiCheckResultsDashboard;
