import { useState, useEffect } from 'react'
import { fetchFiles } from '../api/fileApi'

function useFetchFiles() {
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const loadFiles = () => {
        setLoading(true)
        fetchFiles()
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
    }, [])

    return { files, loading, error, reload: loadFiles }
}

export default useFetchFiles
