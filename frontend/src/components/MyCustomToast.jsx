import React, { useEffect } from 'react';


// Toast that I did because HeroUI doesnt have any
export function MyCustomToast({ message, type, onClose }) {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) return null;

    return (
        <div className={`
            fixed left-1/2 transform -translate-x-1/2
            px-6 py-3 rounded-lg shadow-lg
            text-sm text-center z-50
            ${type === 'error' ? 'bg-danger-50 text-danger' : 'bg-success-50 text-success'}
        `}
            style={{
                top: 'calc(50% + 280px)'
            }}
        >
            {message}
        </div>
    );
}
