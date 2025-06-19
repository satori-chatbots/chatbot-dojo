import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider as NextThemesProvider } from "next-themes";

createRoot(document.querySelector("#root")).render(
  <NextThemesProvider attribute="class" defaultTheme="light">
    <main className="text-foreground bg-background dark:bg-[radial-gradient(circle_at_top_left,theme(colors.blue.950)_-100%,transparent_40%),radial-gradient(circle_at_bottom_right,theme(colors.purple.950)_-100%,transparent_40%)]">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </main>
  </NextThemesProvider>,
);
