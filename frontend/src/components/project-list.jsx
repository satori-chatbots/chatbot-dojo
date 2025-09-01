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
  Card,
} from "@heroui/react";
import { Edit, Trash, Check } from "lucide-react";
import { getProviderDisplayName } from "../constants/providers";

// Helper function to get LLM model display info
const getLLMModelDisplay = (project) => {
  if (!project.api_key || !project.llm_model) {
    return {
      modelName: "⚠️ No model configured",
      providerName: "",
      isEmpty: true,
    };
  }

  // Get a user-friendly model name (we could also fetch this from the models API)
  const modelName = project.llm_model;
  const providerDisplay = getProviderDisplayName(project.llm_provider);

  return { modelName, providerName: providerDisplay, isEmpty: false };
};

const ProjectsList = ({
  projects,
  connectors,
  loading,
  selectedProject,
  onSelectProject,
  onEditProject,
  onDeleteProject,
}) => {
  const isLoading = loading;

  const [sortDescriptor, setSortDescriptor] = useState({
    column: "name",
    direction: "ascending",
  });

  const sortedProjects = useMemo(() => {
    const { column, direction } = sortDescriptor;
    return [...projects].sort((a, b) => {
      let first, second;

      switch (column) {
        case "name": {
          first = a.name;
          second = b.name;
          break;
        }
        case "connector": {
          first =
            connectors.find((t) => t.id === a.chatbot_connector)?.name ?? "";
          second =
            connectors.find((t) => t.id === b.chatbot_connector)?.name ?? "";
          break;
        }
        case "llm_model": {
          first = getLLMModelDisplay(a).modelName;
          second = getLLMModelDisplay(b).modelName;
          break;
        }
        default: {
          first = a[column] ?? "";
          second = b[column] ?? "";
        }
      }

      const cmp = first < second ? -1 : first > second ? 1 : 0;
      return direction === "descending" ? -cmp : cmp;
    });
  }, [projects, connectors, sortDescriptor]);

  // Mobile card view for small screens
  const MobileProjectCard = ({ project }) => {
    const modelInfo = getLLMModelDisplay(project);
    const connector = connectors.find(
      (t) => t.id === project.chatbot_connector,
    );

    return (
      <Card className="p-4 mb-3 bg-content1 dark:bg-darkbg-card border border-border dark:border-border-dark">
        <div className="flex flex-col space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground dark:text-foreground-dark truncate">
                {project.name}
              </h3>
              <p className="text-sm text-foreground/70 dark:text-foreground-dark/70 mt-1">
                {connector?.name || "No connector"}
              </p>
            </div>
            {selectedProject?.id === project.id && (
              <div className="flex items-center text-primary text-sm font-medium">
                <Check className="w-4 h-4 mr-1" />
                Selected
              </div>
            )}
          </div>

          <div className="border-t border-border dark:border-border-dark pt-3">
            <div className="flex flex-col space-y-2">
              <div>
                <p className="text-xs text-foreground/60 dark:text-foreground-dark/60">
                  LLM Model:
                </p>
                <p
                  className={
                    modelInfo.isEmpty
                      ? "text-sm text-foreground/60 dark:text-foreground-dark/60 italic"
                      : "text-sm font-medium text-foreground dark:text-foreground-dark"
                  }
                >
                  {modelInfo.modelName}
                </p>
                {modelInfo.providerName && (
                  <p className="text-xs text-foreground/50 dark:text-foreground-dark/50">
                    {modelInfo.providerName}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <Button
              size="sm"
              color="primary"
              variant="flat"
              onPress={() => onSelectProject(project)}
              isDisabled={selectedProject?.id === project.id}
              className="flex-1"
            >
              {selectedProject?.id === project.id ? "Selected" : "Select"}
            </Button>
            <Button
              size="sm"
              color="secondary"
              variant="flat"
              onPress={() => onEditProject(project)}
              isIconOnly
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              color="danger"
              variant="flat"
              onPress={() => onDeleteProject(project.id)}
              isIconOnly
            >
              <Trash className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  const columns = [
    { name: "Name", key: "name", sortable: true },
    { name: "Connector", key: "connector", sortable: true },
    { name: "LLM Model", key: "llm_model", sortable: true },
    { name: "Actions", key: "actions", sortable: false },
  ];

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden md:block">
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
                  <TableCell>
                    <span className="text-foreground dark:text-foreground-dark font-medium">
                      {project.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground dark:text-foreground-dark">
                      {
                        connectors.find(
                          (t) => t.id === project.chatbot_connector,
                        )?.name
                      }
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span
                        className={
                          modelInfo.isEmpty
                            ? "text-foreground/60 dark:text-foreground-dark/60 italic"
                            : "font-medium text-foreground dark:text-foreground-dark"
                        }
                      >
                        {modelInfo.modelName}
                      </span>
                      {modelInfo.providerName && (
                        <span className="text-xs text-foreground/50 dark:text-foreground-dark/50">
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
                      {selectedProject?.id === project.id
                        ? "Selected"
                        : "Select"}
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
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Spinner label="Loading Projects..." />
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-foreground/60 dark:text-foreground-dark/60">
              Create a new project to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {sortedProjects.map((project) => (
              <MobileProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsList;
