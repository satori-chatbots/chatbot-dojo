import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tabs, Tab } from "@heroui/react";
import { Card, CardHeader, CardBody } from "@heroui/react";
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
import { fetchTestCaseById } from "../api/test-cases-api";
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

function TestCase() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [testCase, setTestCase] = useState({});
  const [globalReport, setGlobalReport] = useState({});
  const [profileReports, setProfileReports] = useState([]);
  const [globalErrors, setGlobalErrors] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [projectName, setProjectName] = useState("");
  const POLLING_INTERVAL = 2500;
  const [startTime, setStartTime] = useState();
  const [elapsedTime, setElapsedTime] = useState(0);

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

        if (fetchedTestCase[0].executed_at) {
          const executedAt = new Date(fetchedTestCase[0].executed_at);
          setStartTime(executedAt);
          setElapsedTime(calculateElapsedTime(executedAt));
        }

        if (["RUNNING", "ERROR"].includes(currentStatus)) {
          return;
        }

        if (currentStatus === "COMPLETED") {
          const fetchedGlobalReport = await fetchGlobalReportsByTestCase(id);
          setGlobalReport(fetchedGlobalReport);

          const fetchedGlobalErrors = await fetchTestErrorByGlobalReport(
            fetchedGlobalReport.id,
          );
          setGlobalErrors(fetchedGlobalErrors);

          const fetchedProfileReports =
            await fetchProfileReportByGlobalReportId(fetchedGlobalReport.id);

          for (const report of fetchedProfileReports) {
            const [fetchedErrors, fetchedConversations] = await Promise.all([
              fetchTestErrorByProfileReport(report.id),
              fetchConversationsByProfileReport(report.id),
            ]);
            report.errors = fetchedErrors;
            report.conversations = fetchedConversations;
          }

          setProfileReports(fetchedProfileReports);
          const fetchedProject = await fetchProject(fetchedTestCase[0].project);
          setProjectName(fetchedProject.name);
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

    let pollInterval;
    if (status === "RUNNING") {
      pollInterval = setInterval(fetchData, POLLING_INTERVAL);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [id, status, navigate]);

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
    const progress =
      testCase[0].total_conversations > 0
        ? Math.round(
            (testCase[0].executed_conversations /
              testCase[0].total_conversations) *
              100,
          )
        : 0;

    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Test Case {id}</h1>
        <Card shadow="sm" className="text-center p-4">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Test Case is Running</h2>
            <Spinner size="sm" className="mb-4" />
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-foreground/70 mt-2">
              Please wait while the test case completes...
            </p>
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Progress</h3>
              <Progress value={progress} />
              <p className="text-sm text-default-500 mt-2">
                {progress.toFixed(0)}% - {testCase[0].executed_conversations} of{" "}
                {testCase[0].total_conversations} conversations completed
              </p>
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

  if (status === "ERROR") {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Test Case {id}</h1>
        <Card
          shadow="sm"
          className="text-center p-4 bg-red-100 dark:bg-red-500"
        >
          <CardHeader>
            <h2 className="text-2xl font-bold text-red-600 dark:text-white">
              Test Case Error
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-xl font-bold text-foreground">Error Output:</p>
            <pre className="whitespace-pre-wrap text-left p-4 rounded-lg mt-4 bg-red-200 dark:bg-red-600">
              {testCase[0].result}
            </pre>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (status === "STOPPED") {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Test Case {id}</h1>
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
      <h1 className="text-3xl font-bold mb-6">Test Case {id}</h1>
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
                  Terminal Output
                </h2>
              </CardHeader>
              <CardBody>
                <Accordion>
                  <AccordionItem
                    title="Show Output"
                    classNames={{
                      title: "text-foreground dark:text-foreground-dark",
                    }}
                  >
                    <pre className="bg-gray-800 text-gray-200 dark:bg-black dark:text-green-400 p-4 rounded-lg whitespace-pre-wrap text-left font-mono">
                      {testCase[0].result}
                    </pre>
                  </AccordionItem>
                </Accordion>
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
                                        (message, index) => (
                                          <div
                                            key={index}
                                            className={`mb-4 p-3 rounded-lg ${
                                              Object.keys(message)[0] === "User"
                                                ? "bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                                                : "bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-200"
                                            }`}
                                          >
                                            <p className="font-bold">
                                              {Object.keys(message)[0] ===
                                              "User"
                                                ? "🧑‍💻 User:"
                                                : "🤖 Agent:"}
                                            </p>
                                            <p className="mt-1">
                                              {Object.values(message)[0]}
                                            </p>
                                          </div>
                                        ),
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
