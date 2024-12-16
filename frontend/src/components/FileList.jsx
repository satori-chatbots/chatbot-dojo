import React from 'react'

function FileList({ files, selectedFiles, toggleSelect }) {
    return (
        <div>
            <h1>Uploaded Files</h1>
            {files.length > 0 ? (
                <ul>
                    {files.map(file => (
                        <li key={file.id}>
                            <input
                                type="checkbox"
                                checked={selectedFiles.includes(file.id)}
                                onChange={() => toggleSelect(file.id)}
                            />
                            <a href={file.file} target="_blank" rel="noopener noreferrer">
                                {file.file}
                            </a>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No files uploaded yet.</p>
            )}
        </div>
    )
}

export default FileList
