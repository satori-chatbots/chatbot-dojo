import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { HeroUIProvider } from "@heroui/react"


createRoot(document.getElementById('root')).render(
    <HeroUIProvider>

        <main className="light text-foreground bg-background">
            <BrowserRouter>
                <App />
            </BrowserRouter>

        </main>
    </HeroUIProvider>
);
