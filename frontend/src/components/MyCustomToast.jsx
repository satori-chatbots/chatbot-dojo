import React, { useState, useEffect } from 'react';
import { Transition } from '@headlessui/react'

// Toast that I did because HeroUI doesnt have any
export function MyCustomToast({ message, type, onClose }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (message) {
            setIsVisible(true);
            // Longer messages stay 5s, short 3s
            const duration = message.length > 50 ? 5000 : 3000;
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onClose, 200);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

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
        >
            <div className={`
                fixed left-1/2 transform -translate-x-1/2
                px-6 py-3 rounded-lg shadow-lg
                text-sm text-center z-50
                ${type === 'error' ? 'bg-danger-50/30 text-danger' : 'bg-success-50/30 text-success'}
                backdrop-blur-md
            `}
                style={{
                    top: 'calc(85%)'
                }}
            >
                {message}
            </div>
        </Transition>
    );
}
