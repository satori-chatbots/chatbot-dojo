import { useEffect, useState, useRef } from 'react';
import { deleteFiles, uploadFiles, fetchFiles } from '../api/fileApi';
import { executeTest } from '../api/testCasesApi';
import { fetchProjects } from '../api/projectApi';
import { form } from '@nextui-org/react';

function useFileHandlers(reload, reloadProjects, projects) {
    const [testResult, setTestResult] = useState(null);

    function useFetchFiles() {
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);

        const loadFiles = () => {
            setLoading(true);
            fetchFiles()
                .then(data => {
                    setFiles(data);
                    setLoading(false);
                })
                .catch(err => {
                    setError(err);
                    setLoading(false);
                });
        };

        useEffect(() => {
            loadFiles();
        }, []);

        return { files, loading, error, reload: loadFiles };
    }

    const { files, loading, error, reload: reloadFiles } = useFetchFiles();

    // Fetch files






    // Handle file change




    return {

        selectFile,
        handleDelete,
        handleExecuteTest,
        projects,

        handleProjectChange,
        selectedUploadFiles,

        setSelectedUploadFiles,
        fileInputRef,
        handleFileChange,
        handleUpload,
        files,
        loading,
        error,
        reloadFiles,
    };
}

export default useFileHandlers;
