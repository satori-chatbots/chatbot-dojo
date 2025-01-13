import { useState, useEffect } from 'react'
import { fetchProjects } from '../api/projectApi'

function useFetchProjects() {
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const loadProjects = () => {
        setLoading(true)
        fetchProjects()
            .then(data => {
                setProjects(data)
                setLoading(false)
            })
            .catch(err => {
                setError(err)
                setLoading(false)
            })
    }

    useEffect(() => {
        loadProjects()
    }, [])

    return { projects, loading, error, reload: loadProjects }
}

export default useFetchProjects
