import React, { useRef, useState } from 'react';
import { Button, Input, Card, Dropdown, Modal, ModalBody, DropdownItem, DropdownTrigger, DropdownMenu } from "@nextui-org/react";
import useFileHandlers from '../hooks/userFileHandlers';
import { uploadFiles } from '../api/fileApi';
import { MEDIA_URL } from '../api/config';

function UserProfileManager({ files, reload, projects, reloadProjects }) {

    const {
        selectedFiles,
        selectFile,
        handleDelete,
        handleExecuteTest,
        selectedProject,
        handleProjectChange,
        selectedUploadFiles,
        handleUpload,
        handleFileChange,
        fileInputRef,
    } = useFileHandlers(reload);


    return (
        <Card className="p-6 flex flex-col space-y-6 max-w-4xl mx-auto max-h-[80vh]">
            {/* Header */}
            <h1 className="text-3xl font-bold text-center">User Profiles</h1>

            <div className="flex flex-col space-y-4">
                <Dropdown className="full-width">
                    <DropdownTrigger>
                        <Button color="secondary" variant="bordered">
                            {selectedProject ? selectedProject.name : 'Select Project'}
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Static Actions">
                        <DropdownItem >Create Project</DropdownItem>
                        {projects && projects.map(project => (
                            <DropdownItem key={project.id} onPress={() => handleProjectChange(project.id)}>
                                {project.name}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            </div>

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
                            <li key={file.id} className="flex flex-col space-y-1">
                                <div className="flex items-start space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedFiles.includes(file.id)}
                                        onChange={() => selectFile(file.id)}
                                        className="form-checkbox h-4 w-4 mt-1"
                                    />
                                    <a
                                        href={`${file.file}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline flex-1 break-words max-w-sm md:max-w-lg lg:max-w-2xl"
                                    >
                                        {file.name}
                                    </a>
                                </div>
                                <p className="text-gray-600 text-sm ml-6">
                                    {file.file.split('/').pop()}
                                </p>
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
