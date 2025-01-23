import React from 'react';
import UserProfileManager from '../components/UserProfileManager';
import useFetchFiles from '../hooks/useFetchFiles';
import useFileHandlers from '../hooks/userFileHandlers';
import useFetchProjects from '../hooks/useFetchProjects';
import { Card } from "@heroui/react";

function Home() {
    return (
        <div className="flex flex-col
        items-center justify-center
        p-6
        w-full
        ">

                <UserProfileManager />

        </div>
    );
}

export default Home;
