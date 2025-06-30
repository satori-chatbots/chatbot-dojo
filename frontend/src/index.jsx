import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider as NextThemesProvider } from "next-themes";

createRoot(document.querySelector("#root")).render(
  <NextThemesProvider
    attribute="class"
    defaultTheme="light"
    enableSystem={false}
  >
    <main className="text-foreground bg-light-gradient dark:bg-dark-gradient dark:text-foreground-dark min-h-screen">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </main>
  </NextThemesProvider>,
);
