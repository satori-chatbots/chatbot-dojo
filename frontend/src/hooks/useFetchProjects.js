import { useState, useEffect } from "react";
import { fetchProjects } from "../api/projectApi";

function useFetchProjects(showType = "all") {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await fetchProjects(showType);
      setProjects(data);
      setError(null);
    } catch (error_) {
      setError(error_.message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [showType]);

  const reloadProjects = () => {
    loadProjects();
  };

  return { projects, loading, error, reloadProjects };
}

export default useFetchProjects;
