import { useState } from 'react';
import { deleteFiles } from '../api/fileApi';
import { executeTest } from '../api/executeTestsApi';

function useFileHandlers(reload) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [testResult, setTestResult] = useState(null);

    const toggleSelect = (id) => {
        setSelectedFiles((prev) =>
            prev.includes(id) ? prev.filter((fileId) => fileId !== id) : [...prev, id]
        );
    };

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
                alert('Selected files deleted successfully.');
                setSelectedFiles([]);
                reload();
            })
            .catch((error) => {
                console.error('Error deleting files:', error);
                alert('Error deleting files.');
            });
    };

    const handleExecuteTest = () => {
        executeTest()
            .then((data) => {
                setTestResult(data.result);
                alert('Test executed successfully.');
            })
            .catch((error) => {
                console.error('Error executing test:', error);
                alert('Error executing test.');
            });
    };

    return {
        selectedFiles,
        testResult,
        toggleSelect,
        handleDelete,
        handleExecuteTest,
    };
}

export default useFileHandlers;
