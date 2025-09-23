import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
  Input,
  Select,
  SelectItem,
  Pagination,
} from "@heroui/react";
import SenseiCheckResultsModal from "./sensei-check-results-modal";
import {
  Search,
  Eye,
  Trash,
  Download,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

// Helper function to parse CSV data into table format
const parseCsvData = (csvString) => {
  if (!csvString) return [];

  const lines = csvString.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const data = lines.slice(1).map((line) => {
    const values = line.split(",");
    const row = {};
    for (const [index, header] of headers.entries()) {
      row[header.trim()] = values[index]?.trim() || "";
    }
    return row;
  });

  return data;
};

// Helper functions moved outside component
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};

const getStatusColor = (exitCode) => {
  return exitCode === 0 ? "success" : "danger";
};

const getStatusIcon = (exitCode) => {
  return exitCode === 0 ? <CheckCircle size={16} /> : <XCircle size={16} />;
};

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
            } catch {
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
          result.stdout?.toLowerCase().includes(searchTerm.toLowerCase()),
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

  // Export result as CSV
  const exportResult = (result) => {
    if (!result.csv_results) {
      showToast("warning", "No CSV data to export");
      return;
    }

    const dataBlob = new Blob([result.csv_results], { type: "text/csv" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    const safeId =
      result.executionId && result.executionId.trim() !== ""
        ? `-${result.executionId}`
        : "";
    link.download = `sensei-check-result${safeId}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("success", "Result exported successfully");
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
              onSelectionChange={(keys) => setStatusFilter([...keys][0])}
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
                    {/* Header with status and execution ID */}
                    <div className="flex items-center gap-3 mb-2">
                      <Chip
                        color={getStatusColor(result.exit_code)}
                        variant="flat"
                        startContent={getStatusIcon(result.exit_code)}
                      >
                        {result.exit_code === 0 ? "Success" : "Failed"}
                      </Chip>
                      {/* executionId removed - not shown in card */}
                    </div>

                    {/* Execution details */}
                    <div className="flex items-center gap-4 text-sm text-foreground-600 mb-2">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(result.executedAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText size={14} />
                        {result.test_cases_checked} test cases
                      </div>
                    </div>

                    {/* CSV Results Preview */}
                    {result.csv_results && (
                      <div className="bg-background-subtle rounded p-3 mb-2">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 size={16} className="text-primary" />
                          <span className="text-sm font-medium">
                            Statistics Summary
                          </span>
                        </div>
                        {(() => {
                          const csvData = parseCsvData(result.csv_results);
                          if (csvData.length > 0) {
                            const totalFails = csvData.reduce(
                              (sum, row) =>
                                sum + Number.parseInt(row.fail || 0, 10),
                              0,
                            );
                            const totalChecks = csvData.reduce(
                              (sum, row) =>
                                sum + Number.parseInt(row.checks || 0, 10),
                              0,
                            );
                            const overallFailRate =
                              totalChecks > 0
                                ? ((totalFails / totalChecks) * 100).toFixed(1)
                                : 0;
                            return (
                              <div className="text-sm">
                                <span className="text-foreground-600">
                                  {csvData.length} rules, {totalChecks} total
                                  checks, {totalFails} failures (
                                  {overallFailRate}% fail rate)
                                </span>
                              </div>
                            );
                          }
                          return (
                            <span className="text-xs text-foreground-500">
                              Statistics available
                            </span>
                          );
                        })()}
                      </div>
                    )}
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

      <SenseiCheckResultsModal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal({ isOpen: false })}
        result={selectedResult}
        onExport={exportResult}
      />

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
