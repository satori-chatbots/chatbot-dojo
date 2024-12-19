import React from 'react'

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
                    <button onClick={handleDelete}>Delete Selected</button>
                    <button onClick={handleExecuteTest}>Execute Test</button>
                </>
            ) : (
                <p>No profiles uploaded yet.</p>
            )}
        </div>
    )
}

export default UserProfileList
