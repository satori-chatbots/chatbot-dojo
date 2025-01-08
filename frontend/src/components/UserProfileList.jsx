import React from 'react';
import { Button } from "@nextui-org/react";

function UserProfileList({ files, selectedFiles, toggleSelect, handleDelete, handleExecuteTest }) {
    return (
        <div className='flex flex-col items-center'>
            <h1 className="text-3xl font-bold mb-4">User Profiles</h1>
            {files.length > 0 ? (
                <>
                    <ul className="space-y-2">
                        {files.map(file => (
                            <li key={file.id} className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={selectedFiles.includes(file.id)}
                                    onChange={() => toggleSelect(file.id)}
                                    className="form-checkbox h-4 w-4"
                                />
                                <a href={file.file} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                    {file.file.split('/').pop().replace('.yml', '')}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-4 flex w-full space-x-2">
                        <Button color="danger" className="flex-1" onPress={handleDelete}>Delete Selected</Button>
                        <Button color='primary' className="flex-1" onPress={handleExecuteTest}>Execute Test</Button>
                    </div>
                </>
            ) : (
                <p className="text-gray-500">No profiles uploaded yet.</p>
            )}
        </div>
    )
}

export default UserProfileList
