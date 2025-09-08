import React from "react";
import { Routes, Route, Link, useNavigate, useHref } from "react-router-dom";
import { useTheme } from "next-themes";
import { useEffect, useState, Suspense } from "react";
import { Button, Switch, Spinner } from "@heroui/react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { HeroUIProvider } from "@heroui/react";
import { useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/auth-context";
import PrivateRoute from "./components/private-route";
import { MyCustomToastProvider } from "./contexts/my-custom-toast-context";
import { SetupProvider } from "./contexts/setup-context";
import { ChevronDown } from "lucide-react";

// Lazy load components for code splitting
const Home = React.lazy(() => import("./views/home"));
const SenseiDashboard = React.lazy(() => import("./views/sensei-dashboard"));
const ChatbotConnectors = React.lazy(
  () => import("./views/chatbot-connectors"),
);
const ProjectsDashboard = React.lazy(
  () => import("./views/projects-dashboard"),
);
const TestCase = React.lazy(() => import("./views/test-case"));
const LoginView = React.lazy(() => import("./views/login-view"));
const TracerDashboard = React.lazy(() => import("./views/tracer-dashboard"));
const SignupView = React.lazy(() => import("./views/signup-view"));
const UserProfileView = React.lazy(() => import("./views/user-profile-view"));
const YamlEditor = React.lazy(() => import("./views/yaml-editor-view"));
const CustomConnectorYamlEditor = React.lazy(
  () => import("./views/custom-connector-yaml-editor"),
);
const SetupGuide = React.lazy(() => import("./views/setup-guide"));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <Spinner size="lg" color="primary" />
  </div>
);

export const MoonIcon = (properties) => {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height="1em"
      role="presentation"
      viewBox="0 0 24 24"
      width="1em"
      {...properties}
    >
      <path
        d="M21.53 15.93c-.16-.27-.61-.69-1.73-.49a8.46 8.46 0 01-1.88.13 8.409 8.409 0 01-5.91-2.82 8.068 8.068 0 01-1.44-8.66c.44-1.01.13-1.54-.09-1.76s-.77-.55-1.83-.11a10.318 10.318 0 00-6.32 10.21 10.475 10.475 0 007.04 8.99 10 10 0 002.89.55c.16.01.32.02.48.02a10.5 10.5 0 008.47-4.27c.67-.93.49-1.519.32-1.79z"
        fill="currentColor"
      />
    </svg>
  );
};

export const SunIcon = (properties) => {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height="1em"
      role="presentation"
      viewBox="0 0 24 24"
      width="1em"
      {...properties}
    >
      <g fill="currentColor">
        <path d="M19 12a7 7 0 11-7-7 7 7 0 017 7z" />
        <path d="M12 22.96a.969.969 0 01-1-.96v-.08a1 1 0 012 0 1.038 1.038 0 01-1 1.04zm7.14-2.82a1.024 1.024 0 01-.71-.29l-.13-.13a1 1 0 011.41-1.41l.13.13a1 1 0 010 1.41.984.984 0 01-.7.29zm-14.28 0a1.024 1.024 0 01-.71-.29 1 1 0 010-1.41l.13-.13a1 1 0 011.41 1.41l-.13.13a1 1 0 01-.7.29zM22 13h-.08a1 1 0 010-2 1.038 1.038 0 011.04 1 .969.969 0 01-.96 1zM2.08 13H2a1 1 0 010-2 1.038 1.038 0 011.04 1 .969.969 0 01-.96 1zm16.93-7.01a1.024 1.024 0 01-.71-.29 1 1 0 010-1.41l.13-.13a1 1 0 011.41 1.41l-.13.13a.984.984 0 01-.7.29zm-14.02 0a1.024 1.024 0 01-.71-.29l-.13-.14a1 1 0 011.41-1.41l.13.13a1 1 0 010 1.41.97.97 0 01-.7.3zM12 3.04a.969.969 0 01-1-.96V2a1 1 0 012 0 1.038 1.038 0 01-1 1.04z" />
      </g>
    </svg>
  );
};

function AppContent() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem("theme") || "light";
    setTheme(storedTheme);
  }, [setTheme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  if (!mounted) return;

  return (
    <HeroUIProvider
      navigate={navigate}
      useHref={useHref}
      theme={theme}
      className={theme}
    >
      <div className={`flex flex-col min-h-screen ${theme}`}>
        <Navbar
          onMenuOpenChange={setIsMenuOpen}
          maxWidth="full"
          isMenuOpen={isMenuOpen}
          className="bg-background sm:bg-background-subtle dark:bg-darkbg-card px-4"
        >
          <NavbarMenuToggle
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="sm:hidden"
          />

          <NavbarBrand>
            <Link to="/" className="hover:underline text-sm font-bold">
              Chatbot dōjō
            </Link>
          </NavbarBrand>

          {/* Left section */}
          <NavbarContent
            className="hidden sm:flex gap-1 lg:gap-4"
            justify="start"
          >
            {user && (
              <NavbarItem isActive={location.pathname === "/"}>
                <Link to="/" className="hover:underline text-sm">
                  Test Center
                </Link>
              </NavbarItem>
            )}
            <NavbarItem isActive={location.pathname === "/dashboard"}>
              <Link to="/dashboard" className="hover:underline text-sm">
                <span className="hidden lg:inline">SENSEI Dashboard</span>
                <span className="lg:hidden">SENSEI</span>
              </Link>
            </NavbarItem>
            <NavbarItem isActive={location.pathname === "/tracer-dashboard"}>
              <Link to="/tracer-dashboard" className="hover:underline text-sm">
                <span className="hidden lg:inline">TRACER Dashboard</span>
                <span className="lg:hidden">TRACER</span>
              </Link>
            </NavbarItem>
            {user && (
              <Dropdown>
                <NavbarItem>
                  <DropdownTrigger>
                    <Button
                      disableRipple
                      className="p-0 bg-transparent data-[hover=true]:bg-transparent"
                      endContent={<ChevronDown className="w-4 h-4" />}
                      radius="sm"
                      variant="light"
                    >
                      Setup
                    </Button>
                  </DropdownTrigger>
                </NavbarItem>
                <DropdownMenu
                  aria-label="Setup options"
                  className="w-[340px]"
                  itemClasses={{
                    base: "gap-4",
                  }}
                >
                  <DropdownItem
                    key="setup-guide"
                    onPress={() => navigate("/setup")}
                    className={
                      location.pathname === "/setup" ? "bg-primary/10" : ""
                    }
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Setup Guide</span>
                      <span className="text-tiny text-default-400">
                        Follow the step-by-step setup process
                      </span>
                    </div>
                  </DropdownItem>
                  <DropdownItem
                    key="chatbot-connectors"
                    onPress={() => navigate("/chatbot-connectors")}
                    className={
                      location.pathname === "/chatbot-connectors"
                        ? "bg-primary/10"
                        : ""
                    }
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Chatbot Connectors</span>
                      <span className="text-tiny text-default-400">
                        Configure chatbot API connections
                      </span>
                    </div>
                  </DropdownItem>
                  <DropdownItem
                    key="projects"
                    onPress={() => navigate("/projects")}
                    className={
                      location.pathname === "/projects" ? "bg-primary/10" : ""
                    }
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Projects</span>
                      <span className="text-tiny text-default-400">
                        Manage your testing projects
                      </span>
                    </div>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </NavbarContent>

          {/* Center section */}
          <NavbarContent
            className="hidden sm:flex gap-4"
            justify="center"
          ></NavbarContent>

          {/* Right section */}
          <NavbarContent justify="end" className="gap-2">
            {user ? (
              <>
                {/* Welcome text - hide on smaller screens */}
                <NavbarItem className="hidden lg:flex">
                  <span className="text-sm">Welcome, </span>
                </NavbarItem>
                <NavbarItem
                  isActive={location.pathname === "/profile"}
                  className="text-primary hidden sm:flex"
                >
                  <Link to="/profile" className="hover:underline text-sm">
                    {user.first_name}
                  </Link>
                </NavbarItem>
                <NavbarItem className="hidden sm:flex">
                  <Button
                    size="sm"
                    color="default"
                    variant="ghost"
                    className="hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/20 dark:hover:text-danger-400"
                    onPress={() => {
                      logout();
                      navigate("/");
                    }}
                  >
                    Logout
                  </Button>
                </NavbarItem>
              </>
            ) : (
              <>
                <NavbarItem
                  isActive={location.pathname === "/login"}
                  className="hidden md:flex"
                >
                  <Button
                    size="sm"
                    color="primary"
                    variant={location.pathname === "/login" ? "solid" : "ghost"}
                    onPress={() => navigate("/login")}
                  >
                    Login
                  </Button>
                </NavbarItem>
                <NavbarItem
                  isActive={location.pathname === "/signup"}
                  className="hidden md:flex"
                >
                  <Button
                    size="sm"
                    color="default"
                    variant={
                      location.pathname === "/signup" ? "solid" : "ghost"
                    }
                    onPress={() => navigate("/signup")}
                  >
                    Sign Up
                  </Button>
                </NavbarItem>
              </>
            )}
            {/* Theme switch - always visible */}
            <NavbarItem>
              <Switch
                defaultSelected={theme === "dark"}
                color="success"
                endContent={
                  <span aria-hidden="true">
                    <MoonIcon />
                  </span>
                }
                size="md"
                startContent={
                  <span aria-hidden="true">
                    <SunIcon />
                  </span>
                }
                value={mounted}
                onChange={toggleTheme}
              />
            </NavbarItem>
          </NavbarContent>

          <NavbarMenu>
            {user && (
              <NavbarMenuItem isActive={location.pathname === "/"}>
                <Link
                  to="/"
                  className="hover:underline text-sm"
                  onClick={handleLinkClick}
                >
                  Test Center
                </Link>
              </NavbarMenuItem>
            )}
            <NavbarMenuItem isActive={location.pathname === "/dashboard"}>
              <Link
                to="/dashboard"
                className="hover:underline text-sm"
                onClick={handleLinkClick}
              >
                SENSEI Dashboard
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem
              isActive={location.pathname === "/tracer-dashboard"}
            >
              <Link
                to="/tracer-dashboard"
                className="hover:underline text-sm"
                onClick={handleLinkClick}
              >
                TRACER Dashboard
              </Link>
            </NavbarMenuItem>
            {user && (
              <>
                <div className="px-4 py-2 text-tiny text-default-400 font-medium">
                  SETUP
                </div>
                <NavbarMenuItem isActive={location.pathname === "/setup"}>
                  <Link
                    to="/setup"
                    className="hover:underline text-sm"
                    onClick={handleLinkClick}
                  >
                    Setup Guide
                  </Link>
                </NavbarMenuItem>
                <NavbarMenuItem
                  isActive={location.pathname === "/chatbot-connectors"}
                >
                  <Link
                    to="/chatbot-connectors"
                    className="hover:underline text-sm"
                    onClick={handleLinkClick}
                  >
                    Chatbot Connectors
                  </Link>
                </NavbarMenuItem>
                <NavbarMenuItem isActive={location.pathname === "/projects"}>
                  <Link
                    to="/projects"
                    className="hover:underline text-sm"
                    onClick={handleLinkClick}
                  >
                    Projects
                  </Link>
                </NavbarMenuItem>
              </>
            )}
            {user ? (
              <>
                <div className="px-4 py-2 text-tiny text-default-400 font-medium">
                  USER
                </div>
                <NavbarMenuItem isActive={location.pathname === "/profile"}>
                  <Link
                    to="/profile"
                    className="hover:underline text-sm"
                    onClick={handleLinkClick}
                  >
                    {user.first_name}
                  </Link>
                </NavbarMenuItem>
                <NavbarMenuItem>
                  <Link
                    to="#"
                    className="hover:underline text-sm text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-300"
                    onClick={(e) => {
                      e.preventDefault();
                      logout();
                      navigate("/");
                      handleLinkClick();
                    }}
                  >
                    Logout
                  </Link>
                </NavbarMenuItem>
              </>
            ) : (
              <>
                <NavbarMenuItem isActive={location.pathname === "/login"}>
                  <Link
                    to="/login"
                    className="hover:underline text-sm"
                    onClick={handleLinkClick}
                  >
                    Login
                  </Link>
                </NavbarMenuItem>
                <NavbarMenuItem isActive={location.pathname === "/signup"}>
                  <Link
                    to="/signup"
                    className="hover:underline text-sm"
                    onClick={handleLinkClick}
                  >
                    Sign Up
                  </Link>
                </NavbarMenuItem>
              </>
            )}
          </NavbarMenu>
        </Navbar>

        {/* Main Content */}
        <main className="flex-1 w-full m-auto flex">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                }
              />
              <Route path="/dashboard" element={<SenseiDashboard />} />
              <Route path="/sensei-dashboard" element={<SenseiDashboard />} />
              <Route path="/tracer-dashboard" element={<TracerDashboard />} />
              <Route
                path="/chatbot-connectors"
                element={
                  <PrivateRoute>
                    <ChatbotConnectors />
                  </PrivateRoute>
                }
              />
              <Route
                path="/projects"
                element={
                  <PrivateRoute>
                    <ProjectsDashboard />
                  </PrivateRoute>
                }
              />
              <Route path="/test-case/:id" element={<TestCase />} />
              <Route path="/login" element={<LoginView />} />
              <Route path="/signup" element={<SignupView />} />
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <UserProfileView />
                  </PrivateRoute>
                }
              />
              <Route
                path="/yaml-editor"
                element={
                  <PrivateRoute>
                    <YamlEditor />
                  </PrivateRoute>
                }
              />
              <Route
                path="/yaml-editor/:fileId"
                element={
                  <PrivateRoute>
                    <YamlEditor />
                  </PrivateRoute>
                }
              />
              <Route
                path="/custom-connector-editor/:connectorId"
                element={
                  <PrivateRoute>
                    <CustomConnectorYamlEditor />
                  </PrivateRoute>
                }
              />
              <Route
                path="/setup"
                element={
                  <PrivateRoute>
                    <SetupGuide />
                  </PrivateRoute>
                }
              />
            </Routes>
          </Suspense>
        </main>

        {/* Footer */}
        <footer className="w-full py-3 flex items-center justify-center backdrop-blur-md bg-opacity-40 sm:bg-opacity-0 bg-background">
          <p className="text-primary">MISO</p>
        </footer>
      </div>
    </HeroUIProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <SetupProvider>
        <MyCustomToastProvider>
          <AppContent />
        </MyCustomToastProvider>
      </SetupProvider>
    </AuthProvider>
  );
}

export default App;
