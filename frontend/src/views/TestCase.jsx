import React from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, Tab } from "@heroui/tabs";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Accordion, AccordionItem, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { fetchTestCaseById } from '../api/testCasesApi';
import { fetchGlobalReportsByTestCase } from '../api/reportsApi';
import { fetchTestErrorByGlobalReport } from '../api/testErrorsApi';
import { fetchProfileReportByGlobalReportId } from '../api/profileReportApi';
import { fetchTestErrorByProfileReport } from '../api/testErrorsApi';
import { fetchConversationsByProfileReport } from '../api/conversationsApi';
import { useEffect, useState } from 'react';

function TestCase() {
    const { id } = useParams();

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

    // Initial fetch of the test case and global report
    useEffect(() => {
        const fetchData = async () => {
            try {
                const fetchedTestCase = await fetchTestCaseById(id);
                setTestCase(fetchedTestCase);

                const status = fetchedTestCase[0].status;
                setStatus(status);
                //console.log("Test Case Status: ", status);

                if (status === "RUNNING" || status === "ERROR") {
                    return;
                }

                else if (status === "COMPLETED") {
                    // Fetch the global report
                    const fetchedGlobalReport = await fetchGlobalReportsByTestCase(id);
                    setGlobalReport(fetchedGlobalReport);
                    //console.log("Global Report ID: ", fetchedGlobalReport.id);

                    // Fetch the errors of the global report
                    const fetchedGlobalErrors = await fetchTestErrorByGlobalReport(fetchedGlobalReport.id);
                    setGlobalErrors(fetchedGlobalErrors);
                    //console.log(fetchedGlobalErrors)

                    // Fetch test reports of the global report
                    const fetchedProfileReports = await fetchProfileReportByGlobalReportId(fetchedGlobalReport.id);
                    // console.log(fetchedTestReports);

                    // Fetch the errors of each test report and add them to the test report object
                    for (const report of fetchedProfileReports) {
                        const fetchedErrors = await fetchTestErrorByProfileReport(report.id);
                        report.errors = fetchedErrors;
                    }

                    // Fetch the conversations of each test report and add them to the test report object
                    for (const report of fetchedProfileReports) {
                        const fetchedConversations = await fetchConversationsByProfileReport(report.id);
                        report.conversations = fetchedConversations;
                    }

                    setProfileReports(fetchedProfileReports);
                    console.log("Test Reports: ", fetchedProfileReports);

                }
            } catch (error) {
                console.error(error);
            } finally {
                setGlobalLoading(false);
            }
        };

        fetchData();
    }, [id]);

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
        return (
            <div className="container mx-auto p-4">
                <h1 className="text-3xl font-bold mb-6">Test Case {id}</h1>
                <Card shadow="sm" className="text-center p-4">
                    <CardBody>
                        <Spinner size="lg" className="mb-4" />
                        <h2 className="text-2xl font-bold">Test Case is Running</h2>
                        <p className="text-gray-600 mt-2">Please wait while the test case completes...</p>
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
                <Card shadow="sm" className="text-center p-4">
                    <CardHeader>
                        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Test Case Failed</h2>
                    </CardHeader>
                    <CardBody>
                        {/* Output of the terminal */}
                        <p className="text-xl font-bold">Error Output</p>
                        <pre className="whitespace-pre-wrap text-left bg-gray-100 dark:bg-default-100 p-4 rounded-lg mt-4">
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
                                        <p className="text-sm font-medium">Average:</p>
                                        <p className="text-2xl font-bold">{formatExecutionTime(globalReport.avg_execution_time)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Max:</p>
                                        <p className="text-2xl font-bold">{formatExecutionTime(globalReport.max_execution_time)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Min:</p>
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
                                <h2 className="text-2xl font-bold">Cost</h2>
                            </CardHeader>
                            <CardBody>
                                <p className="text-2xl font-bold">${globalReport.total_cost}</p>
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
                                                    <p className="text-sm font-medium">Avg Execution Time:</p>
                                                    <p className="text-2xl font-bold">{formatExecutionTime(report.avg_execution_time)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Total Cost:</p>
                                                    <p className="text-2xl font-bold">${report.total_cost}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Total Errors:</p>
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
                                                        <p className="text-sm font-medium">Average:</p>
                                                        <p className="text-2xl font-bold">{formatExecutionTime(report.avg_execution_time)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">Max:</p>
                                                        <p className="text-2xl font-bold">{formatExecutionTime(report.max_execution_time)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">Min:</p>
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
                                                        <AccordionItem key={convIndex} title={`Conversation ${convIndex + 1}`}>
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
                                                                        <Table removeWrapper hideHeader>
                                                                            <TableHeader>
                                                                                <TableColumn>Value</TableColumn>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {conversation.ask_about.map((item, index) => (
                                                                                    <TableRow key={index}>
                                                                                        <TableCell>{typeof item === 'string' ? item : JSON.stringify(item)}</TableCell>
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
                                                                            <TableBody>
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
