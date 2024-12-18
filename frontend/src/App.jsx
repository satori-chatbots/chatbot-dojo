import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './views/Home';
import Dashboard from './views/Dashboard';

function App() {
    return (
        <div>
            <nav>
                <Link to="/">Home</Link>
                <Link to="/dashboard">Dashboard</Link>
            </nav>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
        </div>
    );
}

export default App;
