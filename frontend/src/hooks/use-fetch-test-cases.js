import { useState, useEffect } from "react";
import { fetchTestCases } from "../api/testCasesApi";

export const useFetchTestCases = () => {
  const [testCases, setTestCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();

  const loadTestCases = () => {
    setLoading(true);
    fetchTestCases()
      .then((data) => {
        setTestCases(data);
        setLoading(false);
      })
      .catch((error_) => {
        setError(error_);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTestCases();
  }, []);

  return { testCases, loading, error, reload: loadTestCases };
};
