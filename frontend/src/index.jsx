import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { HeroUIProvider } from "@heroui/react"
import { ThemeProvider as NextThemesProvider } from "next-themes";

createRoot(document.getElementById('root')).render(

    <HeroUIProvider>
        <NextThemesProvider attribute="class" defaultTheme="light">
            <main className="text-foreground bg-background">
                <BrowserRouter>
                    <App />
                </BrowserRouter>

            </main>
        </NextThemesProvider>
    </HeroUIProvider>
);
