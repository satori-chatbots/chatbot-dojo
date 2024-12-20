import React from 'react';
import UserProfileList from '../components/UserProfileList';
import UserProfileUpload from '../components/UserProfileUpload';
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
        return <p>Loading files...</p>;
    }

    if (error) {
        return <p>Error fetching files: {error.message}</p>;
    }

    return (
        <Card className="mt-6 p-6 space-y-4">
            <UserProfileList
                files={files}
                selectedFiles={selectedFiles}
                toggleSelect={toggleSelect}
                handleDelete={handleDelete}
                handleExecuteTest={handleExecuteTest}
            />
            <UserProfileUpload onUpload={reload} />
        </Card>
    )
}

export default Home;
