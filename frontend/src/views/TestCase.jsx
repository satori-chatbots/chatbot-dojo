import React from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, Tab } from "@heroui/tabs";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';

function TestCase() {
    const { id } = useParams();

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
                        <Card>
                            <CardHeader>
                                <h2 className="text-2xl font-bold">Execution Times</h2>
                            </CardHeader>
                            <CardBody>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm font-medium">Average:</p>
                                        <p className="text-2xl font-bold">PLACEHOLDER</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Max:</p>
                                        <p className="text-2xl font-bold">PLACEHOLDER</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Min:</p>
                                        <p className="text-2xl font-bold">PLACEHOLDER</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>

                        {/* Errors */}
                        <Card>
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

                        {/* Cost */}
                        <Card>
                            <CardHeader>
                                <h2 className="text-2xl font-bold">Cost</h2>
                            </CardHeader>
                            <CardBody>
                                <p className="text-2xl font-bold">PLACEHOLDER</p>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>
                <Tab key="profiles" title="Profiles">
                    Profiles
                </Tab>
            </Tabs>
        </div>
    );
}

export default TestCase;
