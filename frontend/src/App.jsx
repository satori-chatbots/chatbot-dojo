import { useState, useEffect, useRef } from 'react'

function App() {
    const [files, setFiles] = useState([])
    const [selectedFiles, setSelectedFiles] = useState(null)
    const fileInputRef = useRef(null)

    useEffect(() => {
        fetch('http://localhost:8000/testfiles/')
            .then(response => response.json())
            .then(data => setFiles(data))
            .catch(error => console.error('Error fetching files:', error))
    }, [])

    const handleFileChange = (event) => {
        setSelectedFiles(event.target.files)
    }

    const handleUpload = () => {
        if (!selectedFiles || selectedFiles.length === 0) {
            alert('Please select files to upload.')
            return
        }

        const formData = new FormData()
        for (let i = 0; i < selectedFiles.length; i++) {
            formData.append('file', selectedFiles[i])
        }

        fetch('http://localhost:8000/upload/', {
            method: 'POST',
            body: formData,
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`)
                }
                return response.json()
            })
            .then(data => {
                // Refresh the files list
                fetch('http://localhost:8000/testfiles/')
                    .then(response => response.json())
                    .then(data => setFiles(data))
                    .catch(error => console.error('Error fetching files:', error))
                setSelectedFiles(null)
                fileInputRef.current.value = null  // Clear the file input
                alert('Files uploaded successfully.')
            })
            .catch(error => console.error('Error uploading files:', error))
    }

    return (
        <div>
            <h1>Uploaded Files</h1>
            {files.length > 0 ? (
                <ul>
                    {files.map(file => (
                        <li key={file.id}>
                            <a href={file.file} target="_blank" rel="noopener noreferrer">{file.file}</a>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No files uploaded yet.</p>
            )}

            <h2>Upload New Files</h2>
            <input type="file" multiple onChange={handleFileChange} ref={fileInputRef} />
            <button onClick={handleUpload}>Upload</button>
        </div>
    )
}

export default App
