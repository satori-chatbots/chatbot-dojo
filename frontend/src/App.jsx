import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './views/Home';
import Dashboard from './views/Dashboard';

function App() {
    return (
        <div className="flex flex-col min-h-screen bg-background font-sans antialiased">
            {/* Header */}
            <header className="w-full py-4">
                <nav className="flex justify-center space-x-4">
                    <Link to="/" className="hover:underline">Home</Link>
                    <Link to="/dashboard" className="hover:underline">Dashboard</Link>
                </nav>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex flex-col items-center justify-center p-6">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                </Routes>
            </main>

            {/* Footer */}
            <footer className="w-full py-3 flex items-center justify-center">
                <p className="text-primary">MISO</p>
            </footer>
        </div>
    );
}

export default App;
