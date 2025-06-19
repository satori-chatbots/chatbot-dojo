import React, { createContext, useContext, useState, useCallback } from "react";
import { MyCustomToast } from "../components/my-custom-toast";

const MyCustomToastContext = createContext();

export function MyCustomToastProvider({ children }) {
  const [toast, setToast] = useState({ type: "", message: "" });

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  const hideToast = useCallback(() => {
    setToast({ type: "", message: "" });
  }, []);

  return (
    <MyCustomToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <MyCustomToast
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    </MyCustomToastContext.Provider>
  );
}

export const useMyCustomToast = () => {
  const context = useContext(MyCustomToastContext);
  if (!context) {
    throw new Error(
      "useMyCustomToast must be used within a MyCustomToastProvider",
    );
  }
  return context;
};
