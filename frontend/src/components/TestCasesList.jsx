import React from 'react';

function TestCasesList({ testCases }) {
    const getFileName = (filePath) => {
        return filePath.split('/').pop();
    };

    return (
        <div>
            <h1>Test Cases</h1>
            {testCases.length > 0 ? (
                <ul>
                    {testCases.map(testCase => (
                        <li key={testCase.id}>
                            <p><strong>Executed At:</strong> {new Date(testCase.executed_at).toLocaleString()}</p>
                            <p><strong>Execution Time:</strong> {testCase.execution_time} seconds</p>
                            <p><strong>User Profiles Used:</strong>
                                <ul>
                                    {testCase.copied_files && testCase.copied_files.length > 0 ? (
                                        testCase.copied_files.map((filePath, index) => (
                                            <li key={`${filePath}-${index}`}>
                                                <a href={filePath} target="_blank" rel="noopener noreferrer">
                                                    {getFileName(filePath)}
                                                </a>
                                            </li>
                                        ))
                                    ) : (
                                        <li>No files available.</li>
                                    )}
                                </ul>
                            </p>
                            <p><strong>Conversation:</strong> {testCase.result}</p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No test cases yet.</p>
            )}
        </div>
    )
}

export default TestCasesList
