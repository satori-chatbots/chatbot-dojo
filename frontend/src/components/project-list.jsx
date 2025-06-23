import React, { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Spinner,
} from "@heroui/react";
import { Edit, Trash, Check } from "lucide-react";

// Helper function to get LLM model display info
const getLLMModelDisplay = (project) => {
  if (!project.api_key || !project.llm_model) {
    return {
      modelName: "⚠️ No model configured",
      providerName: "",
      isEmpty: true,
    };
  }

  // You could fetch this from API if needed, but for now we'll infer from model name
  const provider = project.llm_provider || "Unknown";
  const providerDisplay =
    provider === "openai"
      ? "OpenAI"
      : provider === "gemini"
        ? "Google Gemini"
        : provider;

  // Get a user-friendly model name (we could also fetch this from the models API)
  const modelName = project.llm_model;

  return { modelName, providerName: providerDisplay, isEmpty: false };
};

const ProjectsList = ({
  projects,
  technologies,
  loading,
  selectedProject,
  onSelectProject,
  onEditProject,
  onDeleteProject,
}) => {
  const isLoading = loading;

  const columns = [
    { name: "Name", key: "name", sortable: true },
    { name: "Technology", key: "technology", sortable: true },
    { name: "LLM Model", key: "llm_model", sortable: true },
    { name: "Actions", key: "actions" },
  ];

  const [sortDescriptor, setSortDescriptor] = useState({
    column: "name",
    direction: "ascending",
  });

  const sortedProjects = useMemo(() => {
    const { column, direction } = sortDescriptor;
    return [...projects].sort((a, b) => {
      let first, second;

      if (column === "technology") {
        first =
          technologies.find((t) => t.id === a.chatbot_technology)?.name ?? "";
        second =
          technologies.find((t) => t.id === b.chatbot_technology)?.name ?? "";
      } else if (column === "llm_model") {
        first = getLLMModelDisplay(a).modelName;
        second = getLLMModelDisplay(b).modelName;
      } else {
        first = a[column] ?? "";
        second = b[column] ?? "";
      }

      const cmp = first < second ? -1 : first > second ? 1 : 0;
      return direction === "descending" ? -cmp : cmp;
    });
  }, [projects, technologies, sortDescriptor]);

  return (
    <Table
      key={selectedProject?.id}
      aria-label="Projects Table"
      className="max-h-[60vh] sm:max-h-[50vh] overflow-y-auto"
      sortDescriptor={sortDescriptor}
      onSortChange={setSortDescriptor}
    >
      <TableHeader columns={columns}>
        {(column) => (
          <TableColumn key={column.key} allowsSorting={column.sortable}>
            {column.name}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody
        emptyContent="Create a new project to get started."
        isLoading={isLoading}
        loadingContent={<Spinner label="Loading Projects..." />}
        items={sortedProjects}
      >
        {sortedProjects.map((project) => {
          const modelInfo = getLLMModelDisplay(project);
          return (
            <TableRow key={project.id}>
              <TableCell>{project.name}</TableCell>
              <TableCell>
                {
                  technologies.find((t) => t.id === project.chatbot_technology)
                    ?.name
                }
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span
                    className={
                      modelInfo.isEmpty ? "text-gray-500 italic" : "font-medium"
                    }
                  >
                    {modelInfo.modelName}
                  </span>
                  {modelInfo.providerName && (
                    <span className="text-xs text-gray-400">
                      {modelInfo.providerName}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="flex space-x-1 sm:space-x-2 px-2 sm:px-4">
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  onPress={() => onSelectProject(project)}
                  isDisabled={selectedProject?.id === project.id}
                  className="w-[100px]"
                  endContent={
                    selectedProject?.id === project.id ? (
                      <Check className="w-3 h-3" />
                    ) : undefined
                  }
                >
                  {selectedProject?.id === project.id ? "Selected" : "Select"}
                </Button>
                <Button
                  size="sm"
                  color="secondary"
                  variant="flat"
                  onPress={() => onEditProject(project)}
                  endContent={<Edit className="w-3 h-3" />}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  onPress={() => onDeleteProject(project.id)}
                  endContent={<Trash className="w-3 h-3" />}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default ProjectsList;
