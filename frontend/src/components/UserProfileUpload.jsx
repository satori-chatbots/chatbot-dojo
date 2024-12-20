import React, { useRef, useState } from 'react'
import { uploadFiles } from '../api/fileApi'
import { Button, Input } from "@nextui-org/react";

function UserProfileUpload({ onUpload }) {
    const [selectedFiles, setSelectedFiles] = useState(null)
    const fileInputRef = useRef(null)

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

        uploadFiles(formData)
            .then(() => {
                onUpload()  // Refresh the file list
                setSelectedFiles(null)
                fileInputRef.current.value = null  // Clear the file input
                alert('Files uploaded successfully.')
            })
            .catch(error => {
                console.error('Error uploading files:', error)
                alert('Error uploading files.')
            })
    }

    return (
        <div>
            <h2>Upload New Profiles</h2>
            <Input type="file" multiple accept=".yaml,.yml" onChange={handleFileChange} ref={fileInputRef} />
            <Button onPress={handleUpload}>Upload</Button>
        </div>
    )
}

export default UserProfileUpload
