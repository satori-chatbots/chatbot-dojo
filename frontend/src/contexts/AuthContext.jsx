import React, { createContext, useContext, useState, useEffect } from 'react';
import { validateToken } from '../api/authenticationApi';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [currentProject, setCurrentProject] = useState(null);

    const checkTokenValidity = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            clearAllData();
            return false;
        }
        try {
            const isValid = await validateToken();
            if (!isValid) {
                clearAllData();
            }
            return isValid;
        } catch (error) {
            clearAllData();
            return false;
        }
    };

    const clearAllData = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('currentProject');
        setUser(null);
        setCurrentProject(null);
    };

    useEffect(() => {
        const initAuth = async () => {
            const userData = localStorage.getItem('user');
            if (userData && await checkTokenValidity()) {
                const parsedUserData = JSON.parse(userData);
                setUser(parsedUserData.user);
                const projectData = localStorage.getItem('currentProject');
                if (projectData) {
                    setCurrentProject(JSON.parse(projectData));
                }
            }
        };
        initAuth();
    }, []);

    const login = (userData) => {
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', userData.token);
        setUser(userData.user);
    };

    const logout = () => {
        clearAllData();
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            currentProject,
            setCurrentProject,
            checkTokenValidity
        }}>
            {children}
        </AuthContext.Provider>
    );
};
