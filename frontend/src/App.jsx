import React from 'react';
import { Routes, Route, Link, useNavigate, useHref } from 'react-router-dom';
import Home from './views/Home';
import Dashboard from './views/Dashboard';
import ChatbotTechnologies from './views/ChatbotTechnologies';
import ProjectsDashboard from './views/ProjectsDashboard';
import TestCase from './views/TestCase';
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Switch } from "@heroui/react";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarMenuToggle, NavbarMenu, NavbarMenuItem } from "@heroui/react";
import { Card, CardFooter } from "@nextui-org/react";
import { HeroUIProvider } from "@heroui/react";

export const MoonIcon = (props) => {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            height="1em"
            role="presentation"
            viewBox="0 0 24 24"
            width="1em"
            {...props}
        >
            <path
                d="M21.53 15.93c-.16-.27-.61-.69-1.73-.49a8.46 8.46 0 01-1.88.13 8.409 8.409 0 01-5.91-2.82 8.068 8.068 0 01-1.44-8.66c.44-1.01.13-1.54-.09-1.76s-.77-.55-1.83-.11a10.318 10.318 0 00-6.32 10.21 10.475 10.475 0 007.04 8.99 10 10 0 002.89.55c.16.01.32.02.48.02a10.5 10.5 0 008.47-4.27c.67-.93.49-1.519.32-1.79z"
                fill="currentColor"
            />
        </svg>
    );
};

export const SunIcon = (props) => {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            height="1em"
            role="presentation"
            viewBox="0 0 24 24"
            width="1em"
            {...props}
        >
            <g fill="currentColor">
                <path d="M19 12a7 7 0 11-7-7 7 7 0 017 7z" />
                <path d="M12 22.96a.969.969 0 01-1-.96v-.08a1 1 0 012 0 1.038 1.038 0 01-1 1.04zm7.14-2.82a1.024 1.024 0 01-.71-.29l-.13-.13a1 1 0 011.41-1.41l.13.13a1 1 0 010 1.41.984.984 0 01-.7.29zm-14.28 0a1.024 1.024 0 01-.71-.29 1 1 0 010-1.41l.13-.13a1 1 0 011.41 1.41l-.13.13a1 1 0 01-.7.29zM22 13h-.08a1 1 0 010-2 1.038 1.038 0 011.04 1 .969.969 0 01-.96 1zM2.08 13H2a1 1 0 010-2 1.038 1.038 0 011.04 1 .969.969 0 01-.96 1zm16.93-7.01a1.024 1.024 0 01-.71-.29 1 1 0 010-1.41l.13-.13a1 1 0 011.41 1.41l-.13.13a.984.984 0 01-.7.29zm-14.02 0a1.024 1.024 0 01-.71-.29l-.13-.14a1 1 0 011.41-1.41l.13.13a1 1 0 010 1.41.97.97 0 01-.7.3zM12 3.04a.969.969 0 01-1-.96V2a1 1 0 012 0 1.038 1.038 0 01-1 1.04z" />
            </g>
        </svg>
    );
};

function App() {
    const [mounted, setMounted] = useState(false)
    const { theme, setTheme } = useTheme()
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        setMounted(true);
        const storedTheme = localStorage.getItem('theme') || 'light';
        setTheme(storedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const handleLinkClick = () => {
        setIsMenuOpen(false);
    };

    if (!mounted) return null;

    return (
        <HeroUIProvider navigate={navigate} useHref={useHref}>

            <div className="flex flex-col min-h-screen">
                {/* Header */}
                <Navbar
                    onMenuOpenChange={setIsMenuOpen}
                    maxWidth='lg'
                    isMenuOpen={isMenuOpen}
                >
                    <NavbarMenuToggle
                        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                        className="sm:hidden"
                    />

                    <NavbarBrand>
                        <Link to="/" className="text-primary">SENSEI</Link>
                    </NavbarBrand>

                    <NavbarContent className="hidden sm:flex gap-4" justify='center'>
                        <Link to="/" className="hover:underline">Home</Link>
                        <Link to="/dashboard" className="hover:underline">Dashboard</Link>
                        <Link to="/chatbot-technologies" className="hover:underline">
                            Chatbot Technologies
                        </Link>
                        <Link to="/projects" className="hover:underline">Projects</Link>
                    </NavbarContent>

                    <NavbarContent justify='end'>
                        <Switch
                            defaultSelected={theme === 'dark'}
                            color="success"
                            endContent={<span aria-hidden="true"><MoonIcon /></span>}
                            size="md"
                            startContent={<span aria-hidden="true"><SunIcon /></span>}
                            value={mounted}
                            onChange={toggleTheme}
                        />

                    </NavbarContent>

                    <NavbarMenu >
                        <NavbarMenuItem>
                            <Link to="/" className="hover:underline" onClick={handleLinkClick}>Home</Link>
                        </NavbarMenuItem>
                        <NavbarMenuItem>
                            <Link to="/dashboard" className="hover:underline" onClick={handleLinkClick}>Dashboard</Link>
                        </NavbarMenuItem>
                        <NavbarMenuItem>
                            <Link to="/chatbot-technologies" className="hover:underline" onClick={handleLinkClick}>
                                Chatbot Technologies
                            </Link>
                        </NavbarMenuItem>
                        <NavbarMenuItem>
                            <Link to="/projects" className="hover:underline" onClick={handleLinkClick}>Projects</Link>
                        </NavbarMenuItem>
                    </NavbarMenu>
                </Navbar>

                {/* Main Content */}
                <main className="flex-1 w-full m-auto flex">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/chatbot-technologies" element={<ChatbotTechnologies />} />
                        <Route path="/projects" element={<ProjectsDashboard />} />
                        <Route path="/test-case/:id" element={<TestCase />} />
                    </Routes>
                </main>

                {/* Footer */}
                <footer className="w-full py-3 flex items-center justify-center backdrop-blur-md bg-opacity-40 sm:bg-opacity-0 bg-background">
                    <p className="text-primary">MISO</p>
                </footer>
            </div>
        </HeroUIProvider>
    );
}

export default App;
