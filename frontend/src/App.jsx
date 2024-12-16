import React from 'react'
import FileList from './components/FileList'
import FileUpload from './components/FileUpload'
import useFetchFiles from './hooks/useFetchFiles'

function App() {
    const { files, loading, error, reload } = useFetchFiles()

    if (loading) {
        return <p>Loading files...</p>
    }

    if (error) {
        return <p>Error fetching files: {error.message}</p>
    }

    return (
        <div>
            <FileList files={files} />
            <FileUpload onUpload={reload} />
        </div>
    )
}

export default App
