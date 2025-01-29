import React from 'react';
import { useParams } from 'react-router-dom';

function TestCase() {
    const { id } = useParams();

    return (
        <div>
            <h1>Test Case {id}</h1>
        </div>
    );
}

export default TestCase;
