import React from 'react';
import UserProfileManager from '../components/UserProfileManager';
import useFetchFiles from '../hooks/useFetchFiles';
import useFileHandlers from '../hooks/userFileHandlers';
import useFetchProjects from '../hooks/useFetchProjects';
import { Card } from "@heroui/react";

function Home() {
    return (
        <div className="flex justify-center items-start">
            <div className="w-full max-w-4xl">
                <UserProfileManager
                />
            </div>
        </div>
    );
}

export default Home;
