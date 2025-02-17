import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Tabs, Tab } from "@heroui/tabs";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Accordion, AccordionItem, Progress, Snippet, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { fetchTestCaseById } from '../api/testCasesApi';
import { fetchGlobalReportsByTestCase } from '../api/reportsApi';
import { fetchTestErrorByGlobalReport } from '../api/testErrorsApi';
import { fetchProfileReportByGlobalReportId } from '../api/profileReportApi';
import { fetchTestErrorByProfileReport } from '../api/testErrorsApi';
import { fetchConversationsByProfileReport } from '../api/conversationsApi';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fetchProject } from '../api/projectApi';

function TestCase() {
    const { id } = useParams();
    const navigate = useNavigate();
    // State for the test case
    const [testCase, setTestCase] = useState({});
    // State for the global report
    const [globalReport, setGlobalReport] = useState({});
    // State for the test reports
    const [profileReports, setProfileReports] = useState([]);

    // State for the errors of the Global Report
    const [globalErrors, setGlobalErrors] = useState([]);

    // Global Loading State
    const [globalLoading, setGlobalLoading] = useState(true);

    // Status of the test case
    const [status, setStatus] = useState("");

    // status for the project name
    const [projectName, setProjectName] = useState("");

    // Polling interval for fetching the test case if it is still running
    const POLLING_INTERVAL = 2500;

    const [startTime, setStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    const calculateElapsedTime = (startDate) => {
        const now = new Date();
        return Math.floor((now - startDate) / 1000);
    };

    // Initial fetch of the test case and global report
    useEffect(() => {
        const fetchData = async () => {
            try {
                const fetchedTestCase = await fetchTestCaseById(id);

                if (!fetchedTestCase || fetchedTestCase.length === 0) {
                    navigate('/dashboard');
                    return;
                }

                setTestCase(fetchedTestCase);

                const status = fetchedTestCase[0].status;
                setStatus(status);

                if (fetchedTestCase[0].executed_at) {
                    const executedAt = new Date(fetchedTestCase[0].executed_at);
                    setStartTime(executedAt);
                    setElapsedTime(calculateElapsedTime(executedAt));
                }

                if (status === "RUNNING") {
                    return; // Exit early if still running
                }

                if (status === "ERROR") {
                    return; // Exit early if error
                }

                if (status === "COMPLETED") {
                    // Fetch additional data only when completed
                    const fetchedGlobalReport = await fetchGlobalReportsByTestCase(id);
                    setGlobalReport(fetchedGlobalReport);

                    const fetchedGlobalErrors = await fetchTestErrorByGlobalReport(fetchedGlobalReport.id);
                    setGlobalErrors(fetchedGlobalErrors);

                    const fetchedProfileReports = await fetchProfileReportByGlobalReportId(fetchedGlobalReport.id);

                    // Fetch errors and conversations for each report
                    for (const report of fetchedProfileReports) {
                        const [fetchedErrors, fetchedConversations] = await Promise.all([
                            fetchTestErrorByProfileReport(report.id),
                            fetchConversationsByProfileReport(report.id)
                        ]);
                        report.errors = fetchedErrors;
                        report.conversations = fetchedConversations;
                    }

                    setProfileReports(fetchedProfileReports);


                    // Fetch the project to get its name
                    const fetchedProject = await fetchProject(fetchedTestCase[0].project);
                    setProjectName(fetchedProject.name);

                    console.log(fetchedProject);

                }
            } catch (error) {
                if (error.message === '403') {
                    navigate('/dashboard');
                }
                console.error(error);
            } finally {
                setGlobalLoading(false);
            }
        };

        // Initial fetch
        fetchData();

        // Set up polling if status is RUNNING
        let pollInterval;
        if (status === "RUNNING") {
            pollInterval = setInterval(fetchData, POLLING_INTERVAL);
        }

        // Cleanup polling on unmount or status change
        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [id, status]);

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

    // Function to format the execution time
    const formatExecutionTime = (time) => {
        // If < 60s return XX.XXs
        if (time < 60) {
            return `${time.toFixed(2)}s`;
        }

        // If < 3600s return XXm XXs
        if (time < 3600) {
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            return `${minutes}m ${seconds.toFixed(2)}s`;
        }

        // Else return XXh XXm XXs
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = time % 60;
        return `${hours}h ${minutes}m ${seconds.toFixed(2)}s`;
    };

    // Function to format the execution time for running time
    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const remainingSeconds = seconds % 60
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
    }

    if (globalLoading) {
        return (
            <div className="container mx-auto p-4 flex flex-col items-center justify-center">
                <Spinner size="lg" />
                <p className="mt-4 text-xl">Loading test case data...</p>
            </div>
        );
    }

    // Add early return for running state
    if (status === "RUNNING") {
        const progress = testCase[0].total_conversations > 0
            ? Math.round((testCase[0].executed_conversations / testCase[0].total_conversations) * 100)
            : 0;

        return (
            <div className="container mx-auto p-4">
                <h1 className="text-3xl font-bold mb-6">Test Case {id}</h1>
                <Card shadow="sm" className="text-center p-4">
                    <CardHeader className='flex items-center justify-between'>
                        <h2 className="text-2xl font-bold">Test Case is Running</h2>
                        <Spinner size="sm" className="mb-4" />
                    </CardHeader>
                    <CardBody className='space-y-4'>
                        <p className="text-gray-600 dark:text-gray-300 mt-2">
                            Please wait while the test case completes...
                        </p>

                        {/* Progress section */}
                        <div className="mt-6">
                            <h3 className="text-sm font-medium mb-2">Progress</h3>
                            <Progress value={progress} />
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                {progress.toFixed(0)}% - {testCase[0].executed_conversations} of {testCase[0].total_conversations} conversations completed
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="text-sm font-medium mb-1">Started at</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{format(startTime, 'PPpp')}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium mb-1">Running time</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{formatTime(elapsedTime)}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>
        );
    }

    // Add early return for error state
    if (status === "ERROR") {
        return (
            <div className="container mx-auto p-4">
                <h1 className="text-3xl font-bold mb-6">Test Case {id}</h1>
                <Card shadow="sm" className="text-center p-4 bg-red-100 dark:bg-red-500">
                    <CardHeader>
                        <h2 className="text-2xl font-bold text-red-600 dark:text-white">Test Case Error</h2>
                    </CardHeader>
                    <CardBody>
                        {/* Output of the terminal */}
                        <p className="text-xl font-bold dark:text-gray-200">Error Output:</p>
                        <pre className="whitespace-pre-wrap text-left p-4 rounded-lg mt-4 bg-red-200 dark:bg-red-600">
                            {testCase[0].result}
                        </pre>
                    </CardBody>
                </Card>
            </div>
        );
    }

    // Add early return for stopped state
    if (status === "STOPPED") {
        return (
            <div className="container mx-auto p-4">
                <h1 className="text-3xl font-bold mb-6">Test Case {id}</h1>
                <Card shadow="sm" className="text-center p-4">
                    <CardHeader>
                        <h2 className="text-2xl font-bold">Test Case Stopped</h2>
                    </CardHeader>
                    <CardBody>
                        {/* Output of the terminal */}
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
                    {/* ------------------ */}
                    {/* - Global Details - */}
                    {/* ------------------ */}
                    <div className="space-y-4">
                        {/* Execution Times */}
                        <Card shadow="sm">
                            <CardHeader>
                                <h2 className="text-2xl font-bold">Execution Times</h2>
                            </CardHeader>
                            <CardBody>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average:</p>
                                        <p className="text-2xl font-bold">{formatExecutionTime(globalReport.avg_execution_time)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Max:</p>
                                        <p className="text-2xl font-bold">{formatExecutionTime(globalReport.max_execution_time)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Min:</p>
                                        <p className="text-2xl font-bold">{formatExecutionTime(globalReport.min_execution_time)}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>

                        {/* Errors */}
                        <Card shadow="sm">
                            <CardHeader>
                                <h2 className="text-2xl font-bold">Errors</h2>
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
                                                <TableCell>{error.code}</TableCell>
                                                <TableCell>{error.count}</TableCell>
                                                <TableCell>
                                                    <ul>
                                                        {error.conversations.map((conv, index) => (
                                                            <li key={index}>{conv}</li>
                                                        ))}
                                                    </ul>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardBody>
                        </Card>

                        {/* Cost */}
                        <Card shadow="sm">
                            <CardHeader>
                                <h2 className="text-2xl font-bold">Total Cost and Time</h2>
                            </CardHeader>
                            <CardBody>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Cost:</p>
                                        <p className="text-2xl font-bold">${globalReport.total_cost}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Time:</p>
                                        <p className="text-2xl font-bold">{testCase[0].execution_time.toFixed(2)}s</p>
                                    </div>
                                </div>

                            </CardBody>
                        </Card>

                        {/* Technology and others */}
                        <Card shadow="sm">
                            <CardHeader>
                                <h2 className="text-2xl font-bold">Technology and Others</h2>
                            </CardHeader>
                            <CardBody>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Technology:</p>
                                        <p className="text-2xl font-bold">{testCase[0].technology}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Project:</p>
                                        <p className="text-2xl font-bold">{projectName}</p>

                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Number of Profiles</p>
                                        <p className="text-2xl font-bold">{profileReports.length}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>

                        {/* Output of the terminal */}
                        <Card shadow="sm">
                            <CardHeader>
                                <h2 className="text-2xl font-bold">Terminal Output</h2>
                            </CardHeader>
                            <CardBody>
                                <Accordion>
                                    <AccordionItem title="Show Output" className="text-sm font-medium">
                                        <pre className="bg-gray-50 dark:bg-default-100 p-4 rounded-lg whitespace-pre-wrap text-left">
                                            {testCase[0].result}
                                        </pre>
                                    </AccordionItem>
                                </Accordion>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>
                <Tab key="profiles" title="Profiles">
                    {/* ----------------- */}
                    {/* - User Profiles - */}
                    {/* ----------------- */}
                    <div className="space-y-4">

                        <Accordion>
                            {profileReports.map((report) => (
                                <AccordionItem title={
                                    <Card shadow="sm" className="w-full">
                                        <CardHeader>
                                            <h2 className="text-2xl font-bold">{report.name}</h2>
                                        </CardHeader>
                                        <CardBody>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Execution Time:</p>
                                                    <p className="text-2xl font-bold">{formatExecutionTime(report.avg_execution_time)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Cost:</p>
                                                    <p className="text-2xl font-bold">${report.total_cost}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Errors:</p>
                                                    <p className="text-2xl font-bold">{report.errors.reduce((sum, error) => sum + error.count, 0)}</p>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                }>

                                    <div className="mt-4 space-y-4">
                                        {/* Execution Times */}
                                        <Card shadow="sm">
                                            <CardHeader>
                                                <h2 className="text-2xl font-bold">Execution Times</h2>
                                            </CardHeader>
                                            <CardBody>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average:</p>
                                                        <p className="text-2xl font-bold">{formatExecutionTime(report.avg_execution_time)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Max:</p>
                                                        <p className="text-2xl font-bold">{formatExecutionTime(report.max_execution_time)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Min:</p>
                                                        <p className="text-2xl font-bold">{formatExecutionTime(report.min_execution_time)}</p>
                                                    </div>
                                                </div>
                                            </CardBody>
                                        </Card>

                                        {/* Errors */}
                                        <Card shadow="sm">
                                            <CardHeader>
                                                <h2 className="text-2xl font-bold">Errors</h2>
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
                                                        {report.errors && report.errors.map((error) => (
                                                            <TableRow key={error.id}>
                                                                <TableCell>{error.code}</TableCell>
                                                                <TableCell>{error.count}</TableCell>
                                                                <TableCell>
                                                                    <ul>
                                                                        {error.conversations?.map((conv, index) => (
                                                                            <li key={index}>{conv}</li>
                                                                        ))}
                                                                    </ul>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </CardBody>
                                        </Card>

                                        {/* Profile Details */}
                                        <Card shadow="sm">
                                            <CardHeader>
                                                <h2 className="text-2xl font-bold">Profile Details</h2>
                                            </CardHeader>
                                            <CardBody>
                                                <Table removeWrapper hideHeader>
                                                    <TableHeader>
                                                        <TableColumn>Key</TableColumn>
                                                        <TableColumn>Value</TableColumn>
                                                    </TableHeader>
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell className="font-medium">Serial</TableCell>
                                                            <TableCell>{report.serial}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell className="font-medium">Language</TableCell>
                                                            <TableCell>{report.language}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell className="font-medium">Personality</TableCell>
                                                            <TableCell>{report.personality}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell className="font-medium">Context</TableCell>
                                                            <TableCell>
                                                                <ul>
                                                                    {report.context_details?.map((context, index) => (
                                                                        <li key={index}>{context}</li>
                                                                    ))}
                                                                </ul>
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell className="font-medium">Interaction Style</TableCell>
                                                            <TableCell>
                                                                <ul>
                                                                    {report.interaction_style?.map((style, index) => (
                                                                        <li key={index}>{style}</li>
                                                                    ))}
                                                                </ul>
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell className="font-medium">Number of Conversations</TableCell>
                                                            <TableCell>{report.number_conversations}</TableCell>
                                                        </TableRow>
                                                        {/* If steps exist, display the int*/}
                                                        {report.steps && (
                                                            <TableRow>
                                                                <TableCell className="font-medium">Steps</TableCell>
                                                                <TableCell>{report.steps}</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {/* If all_answered exists, display in a more readable format */}
                                                        {report.all_answered && (
                                                            <TableRow>
                                                                <TableCell className="font-medium">All Answered</TableCell>
                                                                <TableCell>
                                                                    {Object.entries(report.all_answered).map(([key, value]) => (
                                                                        <div key={key} className="flex gap-2">
                                                                            <span>{key}:</span>
                                                                            <span>{value}</span>
                                                                        </div>
                                                                    ))}
                                                                </TableCell>
                                                            </TableRow>
                                                        )}


                                                    </TableBody>
                                                </Table>
                                            </CardBody>
                                        </Card>


                                        {/* Conversations */}
                                        <Card shadow="sm">
                                            <CardHeader>
                                                <h2 className="text-2xl font-bold">Conversations</h2>
                                            </CardHeader>
                                            <CardBody>
                                                <Accordion>
                                                    {report.conversations.map((conversation, convIndex) => (
                                                        <AccordionItem key={convIndex} title={conversation.name}>
                                                            {/* ------------------------ */}
                                                            {/* - Conversation Details - */}
                                                            {/* ------------------------ */}
                                                            <div className="space-y-4">
                                                                {/* Ask About */}
                                                                <Card shadow="none" className="border-none bg-gray-50 dark:bg-default-100">
                                                                    <CardHeader>
                                                                        <h3 className="text-xl font-bold">Ask About</h3>
                                                                    </CardHeader>
                                                                    <CardBody>
                                                                        {/* Questions Section */}
                                                                        <div className="mb-4">
                                                                            <h4 className="text-lg font-semibold mb-2">Questions</h4>
                                                                            <div className="space-y-2 pl-4">
                                                                                {conversation.ask_about
                                                                                    .filter(item => typeof item === 'string')
                                                                                    .map((question, index) => (
                                                                                        <p key={index} className="text-default-600">
                                                                                            • {question}
                                                                                        </p>
                                                                                    ))}
                                                                            </div>
                                                                        </div>

                                                                        {/* Variables Section */}
                                                                        <div>
                                                                            <h4 className="text-lg font-semibold mb-2">Variables</h4>
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
                                                                                        .filter(item => typeof item === 'object')
                                                                                        .map((item, index) => {
                                                                                            const [key, value] = Object.entries(item)[0];
                                                                                            return (
                                                                                                <TableRow key={index}>
                                                                                                    <TableCell className="font-medium w-1/3">{key}</TableCell>
                                                                                                    <TableCell>
                                                                                                        {Array.isArray(value)
                                                                                                            ? value.join(', ')
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

                                                                {/* Answer */}
                                                                <Card shadow="none" className="border-none bg-gray-50 dark:bg-default-100">
                                                                    <CardHeader>
                                                                        <h3 className="text-xl font-bold">Answer</h3>
                                                                    </CardHeader>
                                                                    <CardBody>
                                                                        <Table removeWrapper hideHeader>
                                                                            <TableHeader>
                                                                                <TableColumn>Key</TableColumn>
                                                                                <TableColumn>Value</TableColumn>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {conversation.data_output.map((item, index) => (
                                                                                    <TableRow key={index}>
                                                                                        <TableCell className="font-medium">{Object.keys(item)[0]}</TableCell>
                                                                                        <TableCell>{Object.values(item)[0] ?? 'None'}</TableCell>
                                                                                    </TableRow>
                                                                                ))}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </CardBody>
                                                                </Card>


                                                                {/* Errors */}
                                                                <Card shadow="none" className="border-none bg-gray-50 dark:bg-default-100">
                                                                    <CardHeader>
                                                                        <h3 className="text-xl font-bold">Errors</h3>
                                                                    </CardHeader>
                                                                    <CardBody>
                                                                        <Table removeWrapper hideHeader>
                                                                            <TableHeader>
                                                                                <TableColumn>Error Code</TableColumn>
                                                                                <TableColumn>Error Message</TableColumn>
                                                                            </TableHeader>
                                                                            <TableBody
                                                                                emptyContent="There are no errors in this conversation"
                                                                            >
                                                                                {conversation.errors.map((error, index) => (
                                                                                    <TableRow key={index}>
                                                                                        <TableCell className="font-medium">{Object.keys(error)[0]}</TableCell>
                                                                                        <TableCell>{Object.values(error)[0]}</TableCell>
                                                                                    </TableRow>
                                                                                ))}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </CardBody>
                                                                </Card>

                                                                {/* Total Time and Cost */}
                                                                <Card shadow="none" className="border-none bg-gray-50 dark:bg-default-100">
                                                                    <CardHeader>
                                                                        <h3 className="text-xl font-bold">Total Time and Cost</h3>
                                                                    </CardHeader>
                                                                    <CardBody>
                                                                        <Table removeWrapper hideHeader>
                                                                            <TableHeader>
                                                                                <TableColumn>Key</TableColumn>
                                                                                <TableColumn>Value</TableColumn>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                <TableRow>
                                                                                    <TableCell className="font-medium">Total Time</TableCell>
                                                                                    <TableCell>{conversation.conversation_time.toFixed(2)}s</TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell className="font-medium">Total Cost</TableCell>
                                                                                    <TableCell>${conversation.total_cost.toFixed(6)}</TableCell>
                                                                                </TableRow>
                                                                            </TableBody>
                                                                        </Table>
                                                                    </CardBody>
                                                                </Card>

                                                                {/* Response Time Report */}
                                                                <Card shadow="none" className="border-none bg-gray-50 dark:bg-default-100">
                                                                    <CardHeader>
                                                                        <h3 className="text-xl font-bold">Response Time Report</h3>
                                                                    </CardHeader>
                                                                    <CardBody>
                                                                        <Table removeWrapper hideHeader>
                                                                            <TableHeader>
                                                                                <TableColumn>Key</TableColumn>
                                                                                <TableColumn>Value</TableColumn>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                <TableRow>
                                                                                    <TableCell className="font-medium">Average</TableCell>
                                                                                    <TableCell>{conversation.response_time_avg.toFixed(2)}s</TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell className="font-medium">Maximum</TableCell>
                                                                                    <TableCell>{conversation.response_time_max.toFixed(2)}s</TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell className="font-medium">Minimum</TableCell>
                                                                                    <TableCell>{conversation.response_time_min.toFixed(2)}s</TableCell>
                                                                                </TableRow>
                                                                            </TableBody>
                                                                        </Table>
                                                                    </CardBody>
                                                                </Card>

                                                                {/* Interaction */}
                                                                <Card shadow="none" className="border-none bg-gray-50 dark:bg-default-100">
                                                                    <CardHeader>
                                                                        <h3 className="text-xl font-bold">Interaction</h3>
                                                                    </CardHeader>
                                                                    <CardBody>
                                                                        {conversation.interaction.map((message, index) => (
                                                                            <div key={index}
                                                                                className={`mb-4 ${Object.keys(message)[0] === 'User'
                                                                                    ? 'text-blue-600 dark:text-blue-400'
                                                                                    : 'text-green-600 dark:text-green-400'
                                                                                    }`}>
                                                                                <p className="font-bold">{Object.keys(message)[0]}:</p>
                                                                                <p>{Object.values(message)[0]}</p>
                                                                            </div>
                                                                        ))}
                                                                    </CardBody>
                                                                </Card>
                                                            </div>
                                                        </AccordionItem>
                                                    ))}
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
