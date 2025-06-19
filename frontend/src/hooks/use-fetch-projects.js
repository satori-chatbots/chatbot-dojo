import { useState, useEffect, useCallback } from "react";
import { fetchProjects } from "../api/project-api";

function useFetchProjects(showType = "all") {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProjects(showType);
      setProjects(data);
      setError(undefined);
    } catch (error_) {
      setError(error_.message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [showType]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const reloadProjects = () => {
    loadProjects();
  };

  return { projects, loading, error, reloadProjects };
}

export default useFetchProjects;
