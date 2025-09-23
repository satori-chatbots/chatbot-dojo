import React from "react";
import SenseiCheckResultsDashboard from "../components/sensei-check-results-dashboard";
import useSelectedProject from "../hooks/use-selected-projects";

const SenseiCheckResultsView = () => {
  const [selectedProject] = useSelectedProject();

  return (
    <div className="container mx-auto px-4 py-8">
      <SenseiCheckResultsDashboard project={selectedProject} />
    </div>
  );
};

export default SenseiCheckResultsView;
