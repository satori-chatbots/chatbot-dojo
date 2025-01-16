import { useState, useEffect } from 'react'
import { fetchFiles } from '../api/fileApi'

function useFetchFiles(project_id) {
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const loadFiles = () => {
        setLoading(true)
        fetchFiles(project_id)
            .then(data => {
                setFiles(data)
                setLoading(false)
            })
            .catch(err => {
                setError(err)
                setLoading(false)
            })
    }

    useEffect(() => {
        loadFiles()
    }, [project_id])

    const reloadFiles = () => {
        loadFiles()
    };

    return { files, loading, error, reloadFiles }
}

export default useFetchFiles
