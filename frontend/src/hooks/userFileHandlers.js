import { useEffect, useState, useRef } from 'react';
import { deleteFiles, uploadFiles } from '../api/fileApi';
import { executeTest } from '../api/testCasesApi';
import { fetchProjects } from '../api/projectApi';


function useFileHandlers(reload, reloadProjects, projects) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [testResult, setTestResult] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedUploadFiles, setSelectedUploadFiles] = useState(null);
    const fileInputRef = useRef(null);

    // Fetch files
    const selectFile = (id) => {
        setSelectedFiles((prev) =>
            prev.includes(id) ? prev.filter((fileId) => fileId !== id) : [...prev, id]
        );
    };

    // Delete selected files
    const handleDelete = () => {
        if (selectedFiles.length === 0) {
            alert('No files selected for deletion.');
            return;
        }

        if (!window.confirm('Are you sure you want to delete the selected files?')) {
            return;
        }

        deleteFiles(selectedFiles)
            .then(() => {
                /*alert('Selected files deleted successfully.');*/
                setSelectedFiles([]);
                reload();
            })
            .catch((error) => {
                console.error('Error deleting files:', error);
                alert('Error deleting files.');
            });
    };

    // Execute test on selected files and project
    const handleExecuteTest = () => {
        if (selectedFiles.length === 0) {
            alert('No files selected for test execution.');
            return;
        }

        if (!selectedProject) {
            alert('Please select a project to execute the test.');
            return;
        }

        console.log('Selected files:', selectedFiles);
        console.log('Selected project:', selectedProject);

        executeTest(selectedFiles, selectedProject.id)
            .then((data) => {
                setTestResult(data.result);
                alert('Test executed successfully.');
            })
            .catch((error) => {
                console.error('Error executing test:', error);
                alert(`Error executing test: ${error.message}`);
            });
    };

    const handleProjectChange = (projectId) => {
        const project = projects.find(project => project.id === projectId);
        setSelectedProject(project);
    }

    // Handle file change
    const handleFileChange = (event) => {
        setSelectedUploadFiles(event.target.files);
    };

    // Handle upload
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
                if (fileInputRef.current) {
                    fileInputRef.current.value = null; // Clear the file input
                }
                //alert('Files uploaded successfully.');
            })
            .catch(error => {
                console.error('Error uploading files:', error);
                alert('Error uploading files:\n' + error.message);
            });
    };

    return {
        selectedFiles,
        testResult,
        selectFile,
        handleDelete,
        handleExecuteTest,
        projects,
        selectedProject,
        handleProjectChange,
        selectedUploadFiles,
        setSelectedProject,
        setSelectedUploadFiles,
        fileInputRef,
        handleFileChange,
        handleUpload,
    };
}

export default useFileHandlers;
