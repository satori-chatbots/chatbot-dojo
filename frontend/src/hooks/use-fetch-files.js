import { useState, useEffect, useCallback } from "react";
import { fetchFiles } from "../api/file-api";

function useFetchFiles(project_id) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();

  const loadFiles = useCallback(() => {
    setLoading(true);
    fetchFiles(project_id)
      .then((data) => {
        setFiles(data);
        setLoading(false);
      })
      .catch((error_) => {
        setError(error_);
        setLoading(false);
      });
  }, [project_id]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const reloadFiles = useCallback(() => {
    loadFiles();
  }, [loadFiles]);

  return { files, loading, error, reloadFiles };
}

export default useFetchFiles;
