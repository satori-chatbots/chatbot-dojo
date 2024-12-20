import React from 'react'
import { Button, Input } from "@nextui-org/react";

function UserProfileList({ files, selectedFiles, toggleSelect, handleDelete, handleExecuteTest }) {
    return (
        <div>
            <h1>User Profiles</h1>
            {files.length > 0 ? (
                <>
                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                        {files.map(file => (
                            <li key={file.id}>
                                <input
                                    type="checkbox"
                                    checked={selectedFiles.includes(file.id)}
                                    onChange={() => toggleSelect(file.id)}
                                />
                                <a href={file.file} target="_blank" rel="noopener noreferrer">
                                    {file.file.split('/').pop().replace('.yml', '')}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <Button onPress={handleDelete}>Delete Selected</Button>
                    <Button onPress={handleExecuteTest}>Execute Test</Button>
                </>
            ) : (
                <p>No profiles uploaded yet.</p>
            )}
        </div>
    )
}

export default UserProfileList
