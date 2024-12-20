import React from 'react';
import UserProfileManager from '../components/UserProfileManager';
import useFetchFiles from '../hooks/useFetchFiles';
import useFileHandlers from '../hooks/userFileHandlers';
import { Card } from '@nextui-org/react';

function Home() {
    const { files, loading, error, reload } = useFetchFiles();
    const {
        selectedFiles,
        toggleSelect,
        handleDelete,
        handleExecuteTest,
    } = useFileHandlers(reload);

    if (loading) {
        return <p className="text-center">Loading files...</p>;
    }

    if (error) {
        return <p className="text-center text-red-500">Error fetching files: {error.message}</p>;
    }

    return (
        <div className="flex justify-center items-start">
            <div className="w-full max-w-4xl">
                <UserProfileManager
                    files={files}
                    selectedFiles={selectedFiles}
                    toggleSelect={toggleSelect}
                    handleDelete={handleDelete}
                    handleExecuteTest={handleExecuteTest}
                    reload={reload}
                />
            </div>
        </div>
    );
}

export default Home;
