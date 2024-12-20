import React, { useRef, useState } from 'react';
import { Button, Input, Card } from "@nextui-org/react";
import { uploadFiles } from '../api/fileApi';

function UserProfileManager({ files, selectedFiles, toggleSelect, handleDelete, handleExecuteTest, reload }) {
    const [selectedUploadFiles, setSelectedUploadFiles] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = (event) => {
        setSelectedUploadFiles(event.target.files);
    };

    const handleUpload = () => {
        if (!selectedUploadFiles || selectedUploadFiles.length === 0) {
            alert('Please select files to upload.');
            return;
        }

        const formData = new FormData();
        for (let i = 0; i < selectedUploadFiles.length; i++) {
            formData.append('file', selectedUploadFiles[i]);
        }

        uploadFiles(formData)
            .then(() => {
                reload(); // Refresh the file list
                setSelectedUploadFiles(null);
                fileInputRef.current.value = null; // Clear the file input
                alert('Files uploaded successfully.');
            })
            .catch(error => {
                console.error('Error uploading files:', error);
                alert('Error uploading files.');
            });
    };

    return (
        <Card className="p-6 flex flex-col space-y-6 max-w-4xl mx-auto max-h-[80vh]">
            {/* Header */}
            <h1 className="text-3xl font-bold text-center">User Profiles</h1>

            {/* Upload Section */}
            <div className="flex flex-col space-y-4">
                <Input
                    type="file"
                    multiple
                    accept=".yaml,.yml"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    fullWidth
                />
                <Button onPress={handleUpload} color="secondary" fullWidth>
                    Upload
                </Button>
            </div>

            {/* List Section */}
            <div className="flex-1 overflow-y-auto">
                {files.length > 0 ? (
                    <ul className="space-y-2">
                        {files.map(file => (
                            <li key={file.id} className="flex items-start space-x-2">
                                <input
                                    type="checkbox"
                                    checked={selectedFiles.includes(file.id)}
                                    onChange={() => toggleSelect(file.id)}
                                    className="form-checkbox h-4 w-4 mt-1"
                                />
                                <a
                                    href={file.file}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline flex-1 break-words max-w-sm md:max-w-lg lg:max-w-2xl"
                                >
                                    {file.file.split('/').pop().replace('.yml', '')}
                                </a>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 text-center">No profiles uploaded yet.</p>
                )}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex space-x-4">
                <Button color="danger" className="flex-1" onPress={handleDelete}>
                    Delete Selected
                </Button>
                <Button color="primary" className="flex-1" onPress={handleExecuteTest}>
                    Execute Test
                </Button>
            </div>
        </Card>
    );
}

export default UserProfileManager;
