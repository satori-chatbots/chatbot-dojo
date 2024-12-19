import React from 'react';
import { useFetchTestCases } from '../hooks/useFetchTestCases';
import TestCasesList from '../components/TestCasesList';

function Dashboard() {
    const { testCases, loading, error } = useFetchTestCases();

    if (loading) {
        return <p>Loading test cases...</p>;
    }

    if (error) {
        return <p>Error fetching test cases: {error.message}</p>;
    }

    return (
        <div>
            <h1>Dashboard</h1>
            <p>Welcome to the dashboard.</p>
            <TestCasesList testCases={testCases} />
        </div>
    );
}

export default Dashboard;
