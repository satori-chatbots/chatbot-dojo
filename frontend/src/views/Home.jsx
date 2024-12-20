import React from 'react';
import UserProfileList from '../components/UserProfileList';
import UserProfileUpload from '../components/UserProfileUpload';
import useFetchFiles from '../hooks/useFetchFiles';
import useFileHandlers from '../hooks/userFileHandlers';

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
        <section>
            <UserProfileList
                files={files}
                selectedFiles={selectedFiles}
                toggleSelect={toggleSelect}
                handleDelete={handleDelete}
                handleExecuteTest={handleExecuteTest}
            />
            <UserProfileUpload onUpload={reload} />
        </section>
    )
}

export default Home;
