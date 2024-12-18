import React from 'react';
import UserProfileList from './components/UserProfileList';
import UserProfileUpload from './components/UserProfileUpload';
import useFetchFiles from './hooks/useFetchFiles';
import useFileHandlers from './hooks/userFileHandlers';

function App() {
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
        <div>
            <UserProfileList
                files={files}
                selectedFiles={selectedFiles}
                toggleSelect={toggleSelect}
                handleDelete={handleDelete}
                handleExecuteTest={handleExecuteTest}
            />
            <UserProfileUpload onUpload={reload} />
        </div>
    );
}

export default App;
