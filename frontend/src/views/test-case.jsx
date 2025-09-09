import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tabs, Tab } from "@heroui/react";
import { Card, CardHeader, CardBody } from "@heroui/react";

// Constants
const POLLING_INTERVAL_MS = 2000;
import {
  Accordion,
  AccordionItem,
  Progress,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import {
  fetchTestCaseById,
  checkSENSEIExecutionStatus,
} from "../api/test-cases-api";
import { fetchGlobalReportsByTestCase } from "../api/reports-api";
import { fetchTestErrorByGlobalReport } from "../api/test-errors-api";
import { fetchProfileReportByGlobalReportId } from "../api/profile-report-api";
import { fetchTestErrorByProfileReport } from "../api/test-errors-api";
import { fetchConversationsByProfileReport } from "../api/conversations-api";
import { format } from "date-fns";
import { fetchProject } from "../api/project-api";
import { getProviderDisplayName } from "../constants/providers";
import {
  formatExecutionTime,
  formatTime,
  calculateElapsedTime,
} from "../utils/time-utils";
import HTMLMessageRenderer, {
  containsHTML,
} from "../components/html-message-renderer";

function TestCase() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [testCase, setTestCase] = useState({});
  const [globalReport, setGlobalReport] = useState({});
  const [profileReports, setProfileReports] = useState([]);
  const [globalErrors, setGlobalErrors] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [projectName, setProjectName] = useState("");
  const [startTime, setStartTime] = useState();
  const [elapsedTime, setElapsedTime] = useState(0);

  // New state for Celery task progress tracking
  const [taskId, setTaskId] = useState();
  const [progressStage, setProgressStage] = useState("");
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [executedConversations, setExecutedConversations] = useState(0);
  const [totalConversations, setTotalConversations] = useState(0);

  // Extract report fetching logic into a reusable function
  const fetchReportsData = useCallback(
    async (testCaseData) => {
      try {
        setReportsLoading(true);
        console.log("Fetching reports data for successful test case");
        const fetchedGlobalReport = await fetchGlobalReportsByTestCase(id);
        setGlobalReport(fetchedGlobalReport);

        const fetchedGlobalErrors = await fetchTestErrorByGlobalReport(
          fetchedGlobalReport.id,
        );
        setGlobalErrors(fetchedGlobalErrors);

        const fetchedProfileReports = await fetchProfileReportByGlobalReportId(
          fetchedGlobalReport.id,
        );

        for (const report of fetchedProfileReports) {
          const [fetchedErrors, fetchedConversations] = await Promise.all([
            fetchTestErrorByProfileReport(report.id),
            fetchConversationsByProfileReport(report.id),
          ]);
          report.errors = fetchedErrors;
          report.conversations = fetchedConversations;
        }

        setProfileReports(fetchedProfileReports);
        const fetchedProject = await fetchProject(testCaseData.project);
        setProjectName(fetchedProject.name);
        console.log("Successfully fetched reports data");
      } catch (error) {
        console.error("Error fetching reports data:", error);
      } finally {
        setReportsLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedTestCase = await fetchTestCaseById(id);

        if (!fetchedTestCase || fetchedTestCase.length === 0) {
          navigate("/dashboard");
          return;
        }

        setTestCase(fetchedTestCase);
        const currentStatus = fetchedTestCase[0].status;
        setStatus(currentStatus);

        // Store task ID if available for progress tracking
        if (fetchedTestCase[0].celery_task_id) {
          setTaskId(fetchedTestCase[0].celery_task_id);
          console.log(
            "Found Celery task ID:",
            fetchedTestCase[0].celery_task_id,
          );
        } else {
          console.log("No Celery task ID found for test case");
        }

        if (fetchedTestCase[0].executed_at) {
          const executedAt = new Date(fetchedTestCase[0].executed_at);
          setStartTime(executedAt);
          setElapsedTime(calculateElapsedTime(executedAt));
        }

        // Set initial conversation counts from test case data
        if (fetchedTestCase[0].executed_conversations !== undefined) {
          setExecutedConversations(fetchedTestCase[0].executed_conversations);
        }
        if (fetchedTestCase[0].total_conversations !== undefined) {
          setTotalConversations(fetchedTestCase[0].total_conversations);
        }

        if (["RUNNING", "FAILURE"].includes(currentStatus)) {
          return;
        }

        if (currentStatus === "SUCCESS") {
          await fetchReportsData(fetchedTestCase[0]);
        }
      } catch (error) {
        if (error.message === "403") {
          navigate("/dashboard");
        }
        console.error(error);
      } finally {
        setGlobalLoading(false);
      }
    };

    fetchData();
  }, [id, navigate, fetchReportsData]);

  // Separate useEffect for polling to avoid dependency issues
  useEffect(() => {
    let pollInterval;

    if (status === "RUNNING") {
      const pollTaskStatus = async () => {
        if (taskId) {
          try {
            console.log("Polling Celery task:", taskId);
            const taskStatus = await checkSENSEIExecutionStatus(taskId);
            console.log("Task status response:", taskStatus);

            // Update progress stage from Celery task
            setProgressStage(taskStatus.stage || "Processing");

            // Update conversation counts if available
            if (taskStatus.executed_conversations !== undefined) {
              setExecutedConversations(taskStatus.executed_conversations);
            }
            if (taskStatus.total_conversations !== undefined) {
              setTotalConversations(taskStatus.total_conversations);
            }

            // Calculate progress percentage based on conversations
            if (taskStatus.total_conversations > 0) {
              const conversationProgress = Math.round(
                (taskStatus.executed_conversations /
                  taskStatus.total_conversations) *
                  100,
              );
              setProgressPercentage(conversationProgress);
            } else {
              // Fall back to task progress if no conversation data
              setProgressPercentage(taskStatus.progress || 0);
            }

            // Use unified status from API response
            const unifiedStatus =
              taskStatus.test_case_status || taskStatus.status;
            if (unifiedStatus && unifiedStatus !== status) {
              console.log(`Status changed from ${status} to ${unifiedStatus}`);
              setStatus(unifiedStatus);

              // Update test case data with new status and error message if applicable
              setTestCase((prevTestCase) => {
                if (prevTestCase && prevTestCase[0]) {
                  return [
                    {
                      ...prevTestCase[0],
                      status: unifiedStatus,
                      error_message:
                        taskStatus.error_message ||
                        prevTestCase[0].error_message,
                    },
                  ];
                }
                return prevTestCase;
              });

              // If task completed or failed, refresh full test case data
              if (unifiedStatus === "SUCCESS" || unifiedStatus === "FAILURE") {
                console.log("Task completed, refreshing test case data");
                const fetchedTestCase = await fetchTestCaseById(id);
                if (fetchedTestCase && fetchedTestCase.length > 0) {
                  setTestCase(fetchedTestCase);

                  // Auto-fetch reports when status changes to SUCCESS
                  if (unifiedStatus === "SUCCESS") {
                    console.log(
                      "Status changed to SUCCESS, fetching reports data",
                    );
                    await fetchReportsData(fetchedTestCase[0]);
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error polling SENSEI task status:", error);
            // On error, fall back to database polling
            try {
              const fetchedTestCase = await fetchTestCaseById(id);
              if (fetchedTestCase && fetchedTestCase.length > 0) {
                const currentStatus = fetchedTestCase[0].status;
                if (currentStatus !== status) {
                  console.log(
                    `Fallback polling detected status change: ${status} -> ${currentStatus}`,
                  );
                  setTestCase(fetchedTestCase);
                  setStatus(currentStatus);

                  // Auto-fetch reports when status changes to SUCCESS
                  if (currentStatus === "SUCCESS") {
                    console.log(
                      "Fallback error polling detected SUCCESS status, fetching reports data",
                    );
                    await fetchReportsData(fetchedTestCase[0]);
                  }
                }
              }
            } catch (fallbackError) {
              console.error(
                "Error in fallback polling after task error:",
                fallbackError,
              );
            }
          }
        } else {
          // Fallback polling if no task ID
          try {
            console.log("Fallback polling without task ID");
            const fetchedTestCase = await fetchTestCaseById(id);
            if (fetchedTestCase && fetchedTestCase.length > 0) {
              const currentStatus = fetchedTestCase[0].status;

              // Only update if status actually changed to avoid unnecessary re-renders
              if (currentStatus !== status) {
                console.log(`Status changed: ${status} -> ${currentStatus}`);
                setTestCase(fetchedTestCase);
                setStatus(currentStatus);

                // Auto-fetch reports when status changes to SUCCESS
                if (currentStatus === "SUCCESS") {
                  console.log(
                    "Fallback polling detected SUCCESS status, fetching reports data",
                  );
                  await fetchReportsData(fetchedTestCase[0]);
                }
              }

              if (fetchedTestCase[0].executed_conversations !== undefined) {
                setExecutedConversations(
                  fetchedTestCase[0].executed_conversations,
                );
              }
              if (fetchedTestCase[0].total_conversations !== undefined) {
                setTotalConversations(fetchedTestCase[0].total_conversations);
              }
            }
          } catch (error) {
            console.error("Error in fallback polling:", error);
          }
        }
      };

      // Poll immediately, then set interval
      pollTaskStatus();
      pollInterval = setInterval(pollTaskStatus, POLLING_INTERVAL_MS);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [status, taskId, id, fetchReportsData]);

  useEffect(() => {
    let timerInterval;
    if (status === "RUNNING" && startTime) {
      timerInterval = setInterval(() => {
        setElapsedTime(calculateElapsedTime(startTime));
      }, 1000);
    }
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [status, startTime]);

  if (globalLoading) {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="mt-4 text-xl">Loading test case data...</p>
      </div>
    );
  }

  if (status === "RUNNING") {
    // Use conversation-based progress if we have conversation data
    const progress =
      totalConversations > 0
        ? Math.round((executedConversations / totalConversations) * 100)
        : progressPercentage || 0;

    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">SENSEI Test Case {id}</h1>
        <Card shadow="sm" className="text-center p-4">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Test Case is Running</h2>
            <Spinner size="sm" className="mb-4" />
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-foreground/70 mt-2">
              Please wait while the test case completes...
            </p>

            {/* Progress Stage */}
            {progressStage &&
              progressStage !== "Task is waiting to be processed" && (
                <div className="mb-2">
                  <p className="text-sm font-medium text-primary">
                    {progressStage}
                  </p>
                </div>
              )}

            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Progress</h3>
              <Progress value={progress} />
              {totalConversations > 0 ? (
                <p className="text-sm text-default-500 mt-2">
                  {progress}% - {executedConversations} of {totalConversations}{" "}
                  conversations completed
                </p>
              ) : (
                <p className="text-sm text-default-500 mt-2">
                  {progress}% complete {progressStage && `- ${progressStage}`}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-1">Started at</h3>
                <p className="text-sm text-default-500">
                  {startTime && format(startTime, "PPpp")}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">Running time</h3>
                <p className="text-sm text-default-500">
                  {formatTime(elapsedTime)}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (status === "FAILURE") {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">SENSEI Test Case {id}</h1>
        <div className="space-y-4">
          <Card
            shadow="sm"
            className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          >
            <CardHeader>
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">
                ❌ SENSEI Execution Failed
              </h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {testCase[0].error_message && (
                <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-lg border border-red-200 dark:border-red-700">
                  <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
                    Error Details
                  </h3>
                  <p className="text-red-800 dark:text-red-200 whitespace-pre-wrap">
                    {testCase[0].error_message}
                  </p>
                </div>
              )}

              {/* Debug Information - Collapsible */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    🔍 Debug Information
                  </h3>

                  {/* Standard Output */}
                  {testCase[0].stdout && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Standard Output (stdout):
                      </h4>
                      <pre className="bg-gray-800 text-gray-200 dark:bg-black dark:text-green-400 p-3 rounded text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                        {testCase[0].stdout}
                      </pre>
                    </div>
                  )}

                  {/* Standard Error */}
                  {testCase[0].stderr && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Standard Error (stderr):
                      </h4>
                      <pre className="bg-red-900 text-red-100 dark:bg-red-950 dark:text-red-200 p-3 rounded text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                        {testCase[0].stderr}
                      </pre>
                    </div>
                  )}

                  {/* Fallback to result field if new fields are empty */}
                  {!testCase[0].stdout &&
                    !testCase[0].stderr &&
                    testCase[0].result && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Raw Output:
                        </h4>
                        <pre className="bg-gray-800 text-gray-200 dark:bg-black dark:text-green-400 p-3 rounded text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                          {testCase[0].result}
                        </pre>
                      </div>
                    )}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  if (status === "STOPPED") {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">SENSEI Test Case {id}</h1>
        <Card shadow="sm" className="text-center p-4">
          <CardHeader>
            <h2 className="text-2xl font-bold">Test Case Stopped</h2>
          </CardHeader>
          <CardBody>
            <p className="text-xl font-bold">Stopped Output:</p>
            <pre className="whitespace-pre-wrap text-left p-4">
              {testCase[0].result}
            </pre>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">SENSEI Test Case {id}</h1>
      {reportsLoading && (
        <Card
          shadow="sm"
          className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
        >
          <CardBody className="flex flex-row items-center justify-center p-4">
            <Spinner size="sm" className="mr-2" />
            <p className="text-blue-600 dark:text-blue-400">
              Loading test reports...
            </p>
          </CardBody>
        </Card>
      )}
      <Tabs defaultValue="global" className="space-y-4">
        <Tab key="global" title="Global Details">
          <div className="space-y-4">
            <Card shadow="sm" className="bg-default-50 dark:bg-default-50">
              <CardHeader>
                <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                  Execution Times
                </h2>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-default-500 dark:text-default-400">
                      Average:
                    </p>
                    <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                      {formatExecutionTime(globalReport.avg_execution_time)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-default-500 dark:text-default-400">
                      Max:
                    </p>
                    <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                      {formatExecutionTime(globalReport.max_execution_time)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-default-500 dark:text-default-400">
                      Min:
                    </p>
                    <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                      {formatExecutionTime(globalReport.min_execution_time)}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card shadow="sm" className="bg-default-100 dark:bg-default-100">
              <CardHeader>
                <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                  Errors
                </h2>
              </CardHeader>
              <CardBody>
                <Table removeWrapper>
                  <TableHeader>
                    <TableColumn>Error Code</TableColumn>
                    <TableColumn>Count</TableColumn>
                    <TableColumn>Conversations</TableColumn>
                  </TableHeader>
                  <TableBody
                    isLoading={globalLoading}
                    loadingContent={<Spinner />}
                    emptyContent="No errors found"
                  >
                    {globalErrors.map((error) => (
                      <TableRow key={error.id}>
                        <TableCell className="w-1/3 text-foreground dark:text-foreground-dark">
                          {error.code}
                        </TableCell>
                        <TableCell className="w-1/3 text-foreground dark:text-foreground-dark">
                          {error.count}
                        </TableCell>
                        <TableCell className="w-1/3 text-foreground dark:text-foreground-dark">
                          <ul>
                            {error.conversations.map((conv, index) => (
                              <li
                                key={index}
                                className="text-foreground dark:text-foreground-dark"
                              >
                                {conv}
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>

            <Card shadow="sm" className="bg-default-50 dark:bg-default-50">
              <CardHeader>
                <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                  Cost and LLM
                </h2>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-default-500 dark:text-default-400">
                      Total Cost:
                    </p>
                    <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                      ${globalReport.total_cost}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-default-500 dark:text-default-400">
                      Total Time:
                    </p>
                    <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                      {formatExecutionTime(testCase[0].execution_time)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-default-500 dark:text-default-400">
                      LLM Model Used:
                    </p>
                    {testCase[0].llm_model ? (
                      <div className="flex flex-col">
                        <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                          {testCase[0].llm_model}
                        </p>
                        <p className="text-sm text-default-500 dark:text-default-400">
                          {getProviderDisplayName(testCase[0].llm_provider)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-2xl font-bold text-default-500 dark:text-default-400 italic">
                        No model recorded
                      </p>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card shadow="sm" className="bg-default-100 dark:bg-default-100">
              <CardHeader>
                <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                  Connector Information
                </h2>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-sm font-medium text-default-500 dark:text-default-400">
                      Technology:
                    </p>
                    <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                      {testCase[0].technology}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card shadow="sm" className="bg-default-50 dark:bg-default-50">
              <CardHeader>
                <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                  Project Details
                </h2>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-default-500 dark:text-default-400">
                      Project Name:
                    </p>
                    <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                      {projectName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-default-500 dark:text-default-400">
                      Number of Profiles:
                    </p>
                    <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                      {profileReports.length}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card shadow="sm" className="bg-default-100 dark:bg-default-100">
              <CardHeader>
                <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                  SENSEI Execution Output
                </h2>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {/* Standard Output */}
                  {testCase[0].stdout && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground dark:text-foreground-dark mb-2">
                        📤 Standard Output
                      </h3>
                      <pre className="bg-gray-800 text-gray-200 dark:bg-black dark:text-green-400 p-4 rounded-lg whitespace-pre-wrap text-left font-mono overflow-x-auto">
                        {testCase[0].stdout}
                      </pre>
                    </div>
                  )}

                  {/* Standard Error */}
                  {testCase[0].stderr && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground dark:text-foreground-dark mb-2">
                        ⚠️ Standard Error
                      </h3>
                      <pre className="bg-red-900 text-red-100 dark:bg-red-950 dark:text-red-200 p-4 rounded-lg whitespace-pre-wrap text-left font-mono overflow-x-auto">
                        {testCase[0].stderr}
                      </pre>
                    </div>
                  )}

                  {/* Fallback to combined output if new fields are empty */}
                  {!testCase[0].stdout &&
                    !testCase[0].stderr &&
                    testCase[0].result && (
                      <div>
                        <h3 className="text-lg font-semibold text-foreground dark:text-foreground-dark mb-2">
                          📄 Combined Output
                        </h3>
                        <pre className="bg-gray-800 text-gray-200 dark:bg-black dark:text-green-400 p-4 rounded-lg whitespace-pre-wrap text-left font-mono overflow-x-auto">
                          {testCase[0].result}
                        </pre>
                      </div>
                    )}

                  {/* No output message */}
                  {!testCase[0].stdout &&
                    !testCase[0].stderr &&
                    !testCase[0].result && (
                      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No execution output available
                      </div>
                    )}
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>
        <Tab key="profiles" title="Profiles">
          <div className="space-y-4">
            <Accordion>
              {profileReports.map((report) => (
                <AccordionItem
                  key={report.id}
                  title={
                    <Card
                      shadow="sm"
                      className="w-full bg-default-50 dark:bg-default-50"
                    >
                      <CardHeader>
                        <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                          {report.name}
                        </h2>
                      </CardHeader>
                      <CardBody>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium text-default-500 dark:text-default-400">
                              Avg Execution Time:
                            </p>
                            <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                              {formatExecutionTime(report.avg_execution_time)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-default-500 dark:text-default-400">
                              Total Cost:
                            </p>
                            <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                              ${report.total_cost}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-default-500 dark:text-default-400">
                              Total Errors:
                            </p>
                            <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                              {report.errors.reduce(
                                (sum, error) => sum + error.count,
                                0,
                              )}
                            </p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  }
                >
                  <div className="mt-4 space-y-4">
                    <Card
                      shadow="sm"
                      className="bg-default-100 dark:bg-default-100"
                    >
                      <CardHeader>
                        <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                          Execution Times
                        </h2>
                      </CardHeader>
                      <CardBody>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium text-default-500 dark:text-default-400">
                              Average:
                            </p>
                            <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                              {formatExecutionTime(report.avg_execution_time)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-default-500 dark:text-default-400">
                              Max:
                            </p>
                            <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                              {formatExecutionTime(report.max_execution_time)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-default-500 dark:text-default-400">
                              Min:
                            </p>
                            <p className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                              {formatExecutionTime(report.min_execution_time)}
                            </p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card
                      shadow="sm"
                      className="bg-default-50 dark:bg-default-50"
                    >
                      <CardHeader>
                        <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                          Errors
                        </h2>
                      </CardHeader>
                      <CardBody>
                        <Table removeWrapper>
                          <TableHeader>
                            <TableColumn>Error Code</TableColumn>
                            <TableColumn>Count</TableColumn>
                            <TableColumn>Conversations</TableColumn>
                          </TableHeader>
                          <TableBody
                            isLoading={globalLoading}
                            loadingContent={<Spinner />}
                            emptyContent="No errors found"
                          >
                            {report.errors &&
                              report.errors.map((error) => (
                                <TableRow key={error.id}>
                                  <TableCell className="w-1/3 text-foreground dark:text-foreground-dark">
                                    {error.code}
                                  </TableCell>
                                  <TableCell className="w-1/3 text-foreground dark:text-foreground-dark">
                                    {error.count}
                                  </TableCell>
                                  <TableCell className="w-1/3 text-foreground dark:text-foreground-dark">
                                    <ul>
                                      {error.conversations?.map(
                                        (conv, index) => (
                                          <li
                                            key={index}
                                            className="text-foreground dark:text-foreground-dark"
                                          >
                                            {conv}
                                          </li>
                                        ),
                                      )}
                                    </ul>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </CardBody>
                    </Card>

                    <Card
                      shadow="sm"
                      className="bg-default-100 dark:bg-default-100"
                    >
                      <CardHeader>
                        <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                          Profile Details
                        </h2>
                      </CardHeader>
                      <CardBody>
                        <Table removeWrapper hideHeader>
                          <TableHeader>
                            <TableColumn>Key</TableColumn>
                            <TableColumn>Value</TableColumn>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                Serial
                              </TableCell>
                              <TableCell className="text-foreground dark:text-foreground-dark">
                                {report.serial}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                Language
                              </TableCell>
                              <TableCell className="text-foreground dark:text-foreground-dark">
                                {report.language}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                Personality
                              </TableCell>
                              <TableCell className="text-foreground dark:text-foreground-dark">
                                {report.personality}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                Context
                              </TableCell>
                              <TableCell className="text-foreground dark:text-foreground-dark">
                                <ul>
                                  {report.context_details?.map(
                                    (context, index) => (
                                      <li
                                        key={index}
                                        className="text-foreground dark:text-foreground-dark"
                                      >
                                        {context}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                Interaction Style
                              </TableCell>
                              <TableCell className="text-foreground dark:text-foreground-dark">
                                <ul>
                                  {report.interaction_style?.map(
                                    (style, index) => (
                                      <li
                                        key={index}
                                        className="text-foreground dark:text-foreground-dark"
                                      >
                                        {style}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                Number of Conversations
                              </TableCell>
                              <TableCell className="text-foreground dark:text-foreground-dark">
                                {report.number_conversations}
                              </TableCell>
                            </TableRow>
                            {report.steps && (
                              <TableRow>
                                <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                  Steps
                                </TableCell>
                                <TableCell className="text-foreground dark:text-foreground-dark">
                                  {report.steps}
                                </TableCell>
                              </TableRow>
                            )}
                            {report.all_answered && (
                              <TableRow>
                                <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                  All Answered
                                </TableCell>
                                <TableCell className="text-foreground dark:text-foreground-dark">
                                  {Object.entries(report.all_answered).map(
                                    ([key, value]) => (
                                      <div
                                        key={key}
                                        className="flex gap-2 text-foreground dark:text-foreground-dark"
                                      >
                                        <span>{key}:</span>
                                        <span>{value}</span>
                                      </div>
                                    ),
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardBody>
                    </Card>

                    <Card
                      shadow="sm"
                      className="bg-default-50 dark:bg-default-50"
                    >
                      <CardHeader>
                        <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                          Conversations
                        </h2>
                      </CardHeader>
                      <CardBody>
                        <Accordion>
                          {report.conversations.map(
                            (conversation, convIndex) => (
                              <AccordionItem
                                key={convIndex}
                                title={conversation.name}
                                classNames={{
                                  title:
                                    "text-foreground dark:text-foreground-dark",
                                }}
                              >
                                <div className="space-y-4">
                                  <Card
                                    shadow="none"
                                    className="border-none bg-default-100 dark:bg-default-100"
                                  >
                                    <CardHeader>
                                      <h3 className="text-xl font-bold text-foreground dark:text-foreground-dark">
                                        Ask About
                                      </h3>
                                    </CardHeader>
                                    <CardBody>
                                      <div className="mb-4">
                                        <h4 className="text-lg font-semibold mb-2 text-foreground dark:text-foreground-dark">
                                          Questions
                                        </h4>
                                        <div className="space-y-2 pl-4">
                                          {conversation.ask_about
                                            .filter(
                                              (item) =>
                                                typeof item === "string",
                                            )
                                            .map((question, index) => (
                                              <p
                                                key={index}
                                                className="text-default-600 dark:text-default-400"
                                              >
                                                • {question}
                                              </p>
                                            ))}
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="text-lg font-semibold mb-2 text-foreground dark:text-foreground-dark">
                                          Variables
                                        </h4>
                                        <Table
                                          removeWrapper
                                          hideHeader
                                          className="pl-4"
                                        >
                                          <TableHeader>
                                            <TableColumn>Variable</TableColumn>
                                            <TableColumn>Value</TableColumn>
                                          </TableHeader>
                                          <TableBody>
                                            {conversation.ask_about
                                              .filter(
                                                (item) =>
                                                  typeof item === "object",
                                              )
                                              .map((item, index) => {
                                                const [key, value] =
                                                  Object.entries(item)[0];
                                                return (
                                                  <TableRow key={index}>
                                                    <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                                      {key}
                                                    </TableCell>
                                                    <TableCell className="text-foreground dark:text-foreground-dark">
                                                      {Array.isArray(value)
                                                        ? value.join(", ")
                                                        : value}
                                                    </TableCell>
                                                  </TableRow>
                                                );
                                              })}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </CardBody>
                                  </Card>

                                  <Card
                                    shadow="none"
                                    className="border-none bg-default-100 dark:bg-default-100"
                                  >
                                    <CardHeader>
                                      <h3 className="text-xl font-bold text-foreground dark:text-foreground-dark">
                                        Answer
                                      </h3>
                                    </CardHeader>
                                    <CardBody>
                                      <Table
                                        removeWrapper
                                        hideHeader
                                        className="pl-4"
                                      >
                                        <TableHeader>
                                          <TableColumn>Key</TableColumn>
                                          <TableColumn>Value</TableColumn>
                                        </TableHeader>
                                        <TableBody>
                                          {conversation.data_output.map(
                                            (item, index) => (
                                              <TableRow key={index}>
                                                <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                                  {Object.keys(item)[0]}
                                                </TableCell>
                                                <TableCell className="text-foreground dark:text-foreground-dark">
                                                  {Object.values(item)[0] ??
                                                    "None"}
                                                </TableCell>
                                              </TableRow>
                                            ),
                                          )}
                                        </TableBody>
                                      </Table>
                                    </CardBody>
                                  </Card>

                                  <Card
                                    shadow="none"
                                    className="border-none bg-default-100 dark:bg-default-100"
                                  >
                                    <CardHeader>
                                      <h3 className="text-xl font-bold text-foreground dark:text-foreground-dark">
                                        Errors
                                      </h3>
                                    </CardHeader>
                                    <CardBody>
                                      <Table
                                        removeWrapper
                                        hideHeader
                                        className="pl-4"
                                      >
                                        <TableHeader>
                                          <TableColumn>Error Code</TableColumn>
                                          <TableColumn>
                                            Error Message
                                          </TableColumn>
                                        </TableHeader>
                                        <TableBody emptyContent="There are no errors in this conversation">
                                          {conversation.errors.map(
                                            (error, index) => (
                                              <TableRow key={index}>
                                                <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                                  {Object.keys(error)[0]}
                                                </TableCell>
                                                <TableCell className="text-foreground dark:text-foreground-dark">
                                                  {Object.values(error)[0]}
                                                </TableCell>
                                              </TableRow>
                                            ),
                                          )}
                                        </TableBody>
                                      </Table>
                                    </CardBody>
                                  </Card>

                                  <Card
                                    shadow="none"
                                    className="border-none bg-default-100 dark:bg-default-100"
                                  >
                                    <CardHeader>
                                      <h3 className="text-xl font-bold text-foreground dark:text-foreground-dark">
                                        Total Time and Cost
                                      </h3>
                                    </CardHeader>
                                    <CardBody>
                                      <Table
                                        removeWrapper
                                        hideHeader
                                        className="pl-4"
                                      >
                                        <TableHeader>
                                          <TableColumn>Key</TableColumn>
                                          <TableColumn>Value</TableColumn>
                                        </TableHeader>
                                        <TableBody>
                                          <TableRow>
                                            <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                              Total Time
                                            </TableCell>
                                            <TableCell className="text-foreground dark:text-foreground-dark">
                                              {formatExecutionTime(
                                                conversation.conversation_time,
                                              )}
                                            </TableCell>
                                          </TableRow>
                                          <TableRow>
                                            <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                              Total Cost
                                            </TableCell>
                                            <TableCell className="text-foreground dark:text-foreground-dark">
                                              $
                                              {conversation.total_cost.toFixed(
                                                6,
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </CardBody>
                                  </Card>

                                  <Card
                                    shadow="none"
                                    className="border-none bg-default-100 dark:bg-default-100"
                                  >
                                    <CardHeader>
                                      <h3 className="text-xl font-bold text-foreground dark:text-foreground-dark">
                                        Response Time Report
                                      </h3>
                                    </CardHeader>
                                    <CardBody>
                                      <Table
                                        removeWrapper
                                        hideHeader
                                        className="pl-4"
                                      >
                                        <TableHeader>
                                          <TableColumn>Key</TableColumn>
                                          <TableColumn>Value</TableColumn>
                                        </TableHeader>
                                        <TableBody>
                                          <TableRow>
                                            <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                              Average
                                            </TableCell>
                                            <TableCell className="text-foreground dark:text-foreground-dark">
                                              {conversation.response_time_avg.toFixed(
                                                2,
                                              )}
                                              s
                                            </TableCell>
                                          </TableRow>
                                          <TableRow>
                                            <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                              Maximum
                                            </TableCell>
                                            <TableCell className="text-foreground dark:text-foreground-dark">
                                              {conversation.response_time_max.toFixed(
                                                2,
                                              )}
                                              s
                                            </TableCell>
                                          </TableRow>
                                          <TableRow>
                                            <TableCell className="font-medium w-1/3 text-foreground dark:text-foreground-dark">
                                              Minimum
                                            </TableCell>
                                            <TableCell className="text-foreground dark:text-foreground-dark">
                                              {conversation.response_time_min.toFixed(
                                                2,
                                              )}
                                              s
                                            </TableCell>
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </CardBody>
                                  </Card>

                                  <Card
                                    shadow="none"
                                    className="border-none bg-default-100 dark:bg-default-100"
                                  >
                                    <CardHeader>
                                      <h3 className="text-xl font-bold text-foreground dark:text-foreground-dark">
                                        Interaction
                                      </h3>
                                    </CardHeader>
                                    <CardBody className="pl-4">
                                      {conversation.interaction.map(
                                        (message, index) => {
                                          const isUser =
                                            Object.keys(message)[0] === "User";
                                          const messageContent =
                                            Object.values(message)[0];

                                          return (
                                            <div
                                              key={index}
                                              className={`mb-4 p-3 rounded-lg ${
                                                isUser
                                                  ? "bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                                                  : "bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-200"
                                              }`}
                                            >
                                              <p className="font-bold">
                                                {isUser
                                                  ? "🧑‍💻 User:"
                                                  : "🤖 Agent:"}
                                              </p>
                                              {/* Check if content contains HTML tags */}
                                              {containsHTML(messageContent) ? (
                                                <HTMLMessageRenderer
                                                  htmlContent={messageContent}
                                                  isAgent={!isUser}
                                                />
                                              ) : (
                                                <p className="mt-1">
                                                  {messageContent}
                                                </p>
                                              )}
                                            </div>
                                          );
                                        },
                                      )}
                                    </CardBody>
                                  </Card>
                                </div>
                              </AccordionItem>
                            ),
                          )}
                        </Accordion>
                      </CardBody>
                    </Card>
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}

export default TestCase;
