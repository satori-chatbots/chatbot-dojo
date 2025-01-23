import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './views/Home';
import Dashboard from './views/Dashboard';
import ChatbotTechnologies from './views/ChatbotTechnologies';
import ProjectsDashboard from './views/ProjectsDashboard';

function App() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <header className="w-full py-4">
                <nav className="flex justify-center space-x-4">
                    <Link to="/" className="hover:underline">Home</Link>
                    <Link to="/dashboard" className="hover:underline">Dashboard</Link>
                    <Link to="/chatbot-technologies" className="hover:underline">
                        Chatbot Technologies
                    </Link>
                    <Link to="/projects" className="hover:underline">Projects</Link>

                </nav>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full m-auto flex">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/chatbot-technologies" element={<ChatbotTechnologies />} />
                    <Route path="/projects" element={<ProjectsDashboard />} />
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
