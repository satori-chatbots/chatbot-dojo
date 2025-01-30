import React from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, Tab } from "@heroui/tabs";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Accordion, AccordionItem, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { fetchTestCaseById } from '../api/testCasesApi';
import { fetchGlobalReportsByTestCase } from '../api/reportsApi';
import { fetchTestErrorByGlobalReport } from '../api/testErrorsApi';
import { fetchTestReportByGlobalReportId } from '../api/testReportApi';
import { fetchTestErrorByTestReport } from '../api/testErrorsApi';
import { useEffect, useState } from 'react';

function TestCase() {
    const { id } = useParams();

    // State for the test case
    const [testCase, setTestCase] = useState({});
    // State for the global report
    const [globalReport, setGlobalReport] = useState({});
    // State for the test reports
    const [testReports, setTestReports] = useState([]);

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

                if (status === "RUNNING") {
                    return;
                }

                else if (status === "COMPLETED" || status === "ERROR") {
                    // Fetch the global report
                    const fetchedGlobalReport = await fetchGlobalReportsByTestCase(id);
                    setGlobalReport(fetchedGlobalReport);
                    //console.log("Global Report ID: ", fetchedGlobalReport.id);

                    // Fetch the errors of the global report
                    const fetchedGlobalErrors = await fetchTestErrorByGlobalReport(fetchedGlobalReport.id);
                    setGlobalErrors(fetchedGlobalErrors);
                    //console.log(fetchedGlobalErrors)

                    // Fetch test reports of the global report
                    const fetchedTestReports = await fetchTestReportByGlobalReportId(fetchedGlobalReport.id);
                    console.log(fetchedTestReports);

                    // Fetch the errors of each test report and add them to the test report object
                    for (const report of fetchedTestReports) {
                        const fetchedErrors = await fetchTestErrorByTestReport(report.id);
                        report.errors = fetchedErrors;
                    }


                    setTestReports(fetchedTestReports);
                    console.log("Test Reports: ", fetchedTestReports);

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
                            {testReports.map((report) => (
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
                                                    <p className="text-2xl font-bold">{report.errors.length}</p>
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
                                                        <TableColumn>Error Message</TableColumn>
                                                        <TableColumn>Count</TableColumn>
                                                        <TableColumn>Conversations</TableColumn>
                                                    </TableHeader>
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell>PLACEHOLDER</TableCell>
                                                            <TableCell>PLACEHOLDER</TableCell>
                                                            <TableCell>PLACEHOLDER</TableCell>
                                                            <TableCell>PLACEHOLDER</TableCell>
                                                        </TableRow>
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
                                                    <AccordionItem title="Conversation 1">
                                                        {/* ------------------------ */}
                                                        {/* - Conversation Details - */}
                                                        {/* ------------------------ */}
                                                        <div className="space-y-4">
                                                            {/* Basic Information */}
                                                            <Card shadow="none" className="border-none bg-gray-50 dark:bg-default-100">
                                                                <CardHeader>
                                                                    <h3 className="text-xl font-bold">Basic Information</h3>
                                                                </CardHeader>
                                                                <CardBody>
                                                                    <Table removeWrapper hideHeader>
                                                                        <TableHeader>
                                                                            <TableColumn>Key</TableColumn>
                                                                            <TableColumn>Value</TableColumn>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">Serial Number</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">Language</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">Context</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                        </TableBody>
                                                                    </Table>
                                                                </CardBody>
                                                            </Card>

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
                                                                            <TableRow>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                            <TableRow>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                        </TableBody>
                                                                    </Table>
                                                                </CardBody>
                                                            </Card>

                                                            {/* Conversation Details */}
                                                            <Card shadow="none" className="border-none bg-gray-50 dark:bg-default-100">
                                                                <CardHeader>
                                                                    <h3 className="text-xl font-bold">Conversation Details</h3>
                                                                </CardHeader>
                                                                <CardBody>
                                                                    <Table removeWrapper hideHeader>
                                                                        <TableHeader>
                                                                            <TableColumn>Key</TableColumn>
                                                                            <TableColumn>Value</TableColumn>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">Interaction Style</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">Number</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">Steps</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">All Answered</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
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
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">PLACEHOLDER</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
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
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">Total Cost</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
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
                                                                            <TableColumn>Step</TableColumn>
                                                                            <TableColumn>Time</TableColumn>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">Average</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">Maximum</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
                                                                            </TableRow>
                                                                            <TableRow>
                                                                                <TableCell className="font-medium">Minimum</TableCell>
                                                                                <TableCell>PLACEHOLDER</TableCell>
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
                                                                    <div className="mb-4 text-blue-600 dark:text-blue-400">
                                                                        <p className="font-bold">User:</p>
                                                                        <p>Hey there! 😊 I’m in the mood for some pizza tonight. Can I get a small marinara
                                                                            pizza? Also, I’d love to grab a can of Pepsi with that. What do you think? How
                                                                            much is that going to set me back? 🍕🥤</p>
                                                                    </div>
                                                                    <div className="mb-4 text-green-600 dark:text-green-400">
                                                                        <p className="font-bold">Assistant:</p>
                                                                        <p>Hello</p>
                                                                    </div>
                                                                    <div className="mb-4 text-blue-600 dark:text-blue-400">
                                                                        <p className="font-bold">User:</p>
                                                                        <p>! That sounds like a delicious choice! A small marinara pizza and a can of\
                                                                            \ Pepsi is a classic combo. Let me check the price for you. \n\nBy the way, do\
                                                                            \ you usually go for marinara, or do you have a favorite topping? I’m always curious\
                                                                            \ about what people like! \U0001F60A</p>
                                                                    </div>
                                                                    <div className="mb-4 text-green-600 dark:text-green-400">
                                                                        <p className="font-bold">Assistant:</p>
                                                                        <p>I''m sorry, I did not get what you said. I can help you ordering predefined
                                                                            or custom pizzas, and then drinks.`

                                                                            For troubleshooting, visit: https://python.langchain.com/docs/troubleshooting/errors/OUTPUT_PARSING_FAILURE </p>
                                                                    </div>
                                                                </CardBody>
                                                            </Card>
                                                        </div>
                                                    </AccordionItem>
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
