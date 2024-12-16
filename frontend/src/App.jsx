import React, { useState } from 'react'
import FileList from './components/FileList'
import FileUpload from './components/FileUpload'
import useFetchFiles from './hooks/useFetchFiles'
import { deleteFiles } from './api/fileApi'

function App() {
    const { files, loading, error, reload } = useFetchFiles()
    const [selectedFiles, setSelectedFiles] = useState([])

    const toggleSelect = (id) => {
        setSelectedFiles(prev =>
            prev.includes(id) ? prev.filter(fileId => fileId !== id) : [...prev, id]
        )
    }

    const handleDelete = () => {
        if (selectedFiles.length === 0) {
            alert('No files selected for deletion.')
            return
        }

        if (!window.confirm('Are you sure you want to delete the selected files?')) {
            return
        }

        deleteFiles(selectedFiles)
            .then(() => {
                alert('Selected files deleted successfully.')
                setSelectedFiles([])
                reload()
            })
            .catch(error => {
                console.error('Error deleting files:', error)
                alert('Error deleting files.')
            })
    }

    if (loading) {
        return <p>Loading files...</p>
    }

    if (error) {
        return <p>Error fetching files: {error.message}</p>
    }

    return (
        <div>
            <FileList files={files} selectedFiles={selectedFiles} toggleSelect={toggleSelect} />
            <button onClick={handleDelete}>Delete Selected</button>
            <FileUpload onUpload={reload} />
        </div>
    )
}

export default App
