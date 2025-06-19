import React, { useState, useEffect, useCallback } from "react";
import { Transition } from "@headlessui/react";

export function MyCustomToast({ message, type, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    // Wait for animation to complete before calling onClose
    const cleanup = setTimeout(() => {
      onClose();
    }, 500);
    return () => clearTimeout(cleanup);
  }, [onClose]);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      // Longer messages stay 5s, short 3s
      const duration = message.length > 50 ? 5000 : 3000;
      const timer = setTimeout(handleClose, duration);

      // Cleanup function that will run when component unmounts
      return () => {
        clearTimeout(timer);
        handleClose();
      };
    }
  }, [message, handleClose]);

  // If no message, don't render anything
  if (!message) return;

  // Determine styling based on toast type
  let toastStyle = "";
  if (type === "error") {
    toastStyle = "bg-danger-200/30 dark:bg-danger-50/30 text-danger";
  } else if (type === "warning") {
    toastStyle = "bg-warning-200/30 dark:bg-warning-50/50 text-warning";
  } else {
    // Default success styling
    toastStyle = "bg-success-200/30 dark:bg-success-50/30 text-success";
  }

  return (
    <Transition
      show={isVisible}
      appear={true}
      enter="transition-opacity duration-500"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-500"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      afterLeave={onClose}
    >
      <div
        className={`
                fixed left-1/2 transform -translate-x-1/2
                px-6 py-3 rounded-lg shadow-lg
                text-sm text-center z-50
                ${toastStyle}
                backdrop-blur-md
            `}
        style={{
          top: "calc(85%)",
        }}
      >
        {message}
      </div>
    </Transition>
  );
}
