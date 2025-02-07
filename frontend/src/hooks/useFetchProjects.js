import { useState, useEffect } from 'react';
import { fetchProjects } from '../api/projectApi';

function useFetchProjects() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const data = await fetchProjects();
            setProjects(data);
            setError(null);
        } catch (err) {
            setError(err.message);
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProjects();
    }, []);

    const reloadProjects = () => {
        loadProjects();
    };

    return { projects, loading, error, reloadProjects };
}

export default useFetchProjects;
