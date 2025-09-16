import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
  Accordion,
  AccordionItem,
  Button,
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { BarChart3, Terminal, XCircle, Download } from "lucide-react";
import TerminalOutput from "./terminal-output";

// Helper to parse CSV data (should be moved to utils if needed)
function parseCsvData(csv) {
  if (!csv) return [];
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim().toLowerCase().replace(/ /g, "_")] = values[i];
    });
    return obj;
  });
}

function getStatusColor(exitCode) {
  return exitCode === 0 ? "success" : "danger";
}
function getStatusIcon(exitCode) {
  return exitCode === 0 ? (
    <BarChart3 className="w-4 h-4" />
  ) : (
    <XCircle className="w-4 h-4" />
  );
}
function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString();
}

const SenseiCheckResultsModal = ({ isOpen, onClose, result, onExport }) => (
  <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
    <ModalContent>
      <ModalHeader>
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <span>SENSEI Check Results</span>
          {result && (
            <>
              <Chip
                color={getStatusColor(result.exit_code)}
                variant="flat"
                startContent={getStatusIcon(result.exit_code)}
                size="sm"
              >
                {result.exit_code === 0 ? "Success" : "Failed"}
              </Chip>
            </>
          )}
        </div>
      </ModalHeader>
      <ModalBody>
        {result && (
          <div className="space-y-6">
            {/* Statistics Table */}
            {result.csv_results && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Test Results Statistics
                </h3>
                {(() => {
                  const csvData = parseCsvData(result.csv_results);
                  if (csvData.length > 0) {
                    return (
                      <Card>
                        <CardBody className="p-0">
                          <Table aria-label="SENSEI check results statistics">
                            <TableHeader>
                              <TableColumn>RULE</TableColumn>
                              <TableColumn>CHECKS</TableColumn>
                              <TableColumn>PASS</TableColumn>
                              <TableColumn>FAIL</TableColumn>
                              <TableColumn>NOT APPLICABLE</TableColumn>
                              <TableColumn>FAIL RATE</TableColumn>
                            </TableHeader>
                            <TableBody>
                              {csvData.map((row, index) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    <span className="font-medium">
                                      {row.rule}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-foreground-600">
                                      {row.checks}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      color="success"
                                      variant="flat"
                                      size="sm"
                                    >
                                      {row.pass}
                                    </Chip>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      color={
                                        Number.parseInt(row.fail, 10) > 0
                                          ? "danger"
                                          : "default"
                                      }
                                      variant="flat"
                                      size="sm"
                                    >
                                      {row.fail}
                                    </Chip>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-foreground-500">
                                      {row.not_applicable}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      color={
                                        Number.parseFloat(row.fail_rate) > 0
                                          ? "warning"
                                          : "success"
                                      }
                                      variant="flat"
                                      size="sm"
                                    >
                                      {row.fail_rate}
                                    </Chip>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardBody>
                      </Card>
                    );
                  }
                  return (
                    <div className="text-center py-8 text-foreground-500">
                      <p>No statistics data available</p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Summary Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-background/50 rounded-lg">
              <div>
                <span className="text-sm text-foreground/60">Executed At:</span>
                <p className="font-medium">
                  {formatDate(result.executedAt || result.executed_at)}
                </p>
              </div>
              <div>
                <span className="text-sm text-foreground/60">Test Cases:</span>
                <p className="font-medium">{result.test_cases_checked}</p>
              </div>
            </div>

            {/* Details Accordion */}
            <Accordion variant="bordered">
              {/* Command Details */}
              <AccordionItem
                key="command"
                aria-label="Command Details"
                title={
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    <span>Command Details</span>
                  </div>
                }
              >
                <div className="space-y-2">
                  <TerminalOutput
                    title="Command Executed"
                    content={result.command_executed}
                    variant="command"
                  />
                </div>
              </AccordionItem>

              {/* Output */}
              {result.stdout && (
                <AccordionItem
                  key="output"
                  aria-label="Standard Output"
                  title={
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      <span>Standard Output</span>
                    </div>
                  }
                >
                  <TerminalOutput
                    title="Standard Output"
                    content={result.stdout}
                    variant="output"
                  />
                </AccordionItem>
              )}

              {/* Errors */}
              {result.stderr && (
                <AccordionItem
                  key="errors"
                  aria-label="Standard Error"
                  title={
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-danger" />
                      <span>Error Output</span>
                    </div>
                  }
                >
                  <TerminalOutput
                    title="Error Output"
                    content={result.stderr}
                    variant="error"
                  />
                </AccordionItem>
              )}
            </Accordion>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          Close
        </Button>
        {result && onExport && (
          <Button
            color="primary"
            onPress={() => onExport(result)}
            startContent={<Download size={16} />}
          >
            Export
          </Button>
        )}
      </ModalFooter>
    </ModalContent>
  </Modal>
);

export default SenseiCheckResultsModal;
