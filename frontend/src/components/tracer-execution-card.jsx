import React, { useState } from "react";
import {
  Card,
  CardBody,
  Button,
  Chip,
  Progress,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
} from "@heroui/react";
import {
  FileText,
  BarChart3,
  Users,
  Clock,
  Activity,
  TrendingUp,
  Zap,
  MoreVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const TracerExecutionCard = ({
  execution,
  onViewReport,
  onViewGraph,
  onViewProfiles,
  onDelete,
  getStatusIcon,
  getStatusColor,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

    const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "N/A";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const isCompleted = execution.status === "COMPLETED";
  const isRunning = execution.status === "RUNNING";
  const hasAnalysis = execution.has_analysis && execution.analysis;
  const hasActions = (isCompleted && hasAnalysis) || (isCompleted && execution.generated_profiles_count > 0);

  return (
    <Card className="border-default-200 hover:border-primary-200 transition-all duration-200 hover:shadow-md">
      <CardBody className="p-4">
        {/* Main Row */}
        <div className="flex items-center justify-between">
          {/* Left Side - Project Info & Status */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex-shrink-0">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {execution.project_name}
                </h3>
                <Chip
                  color={getStatusColor(execution.status)}
                  variant="flat"
                  startContent={getStatusIcon(execution.status)}
                  size="sm"
                  className="flex-shrink-0"
                >
                  {execution.status}
                </Chip>
              </div>

              <div className="flex items-center gap-4 text-xs text-default-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(execution.created_at)}
                </span>
                {execution.execution_time_minutes && (
                  <span>• {formatDuration(execution.execution_time_minutes)} runtime</span>
                )}
              </div>
            </div>
          </div>

          {/* Center - Key Metrics */}
          {isCompleted && hasAnalysis && (
            <div className="hidden sm:flex items-center gap-6 mx-4 text-xs">
              <div className="text-center">
                <p className="text-default-500">Sessions</p>
                <p className="font-medium">{execution.sessions || "0"}</p>
              </div>
              <div className="text-center">
                <p className="text-default-500">Turns/Session</p>
                <p className="font-medium">{execution.turns_per_session || "0"}</p>
              </div>
              <div className="text-center">
                <p className="text-default-500">Profiles</p>
                <p className="font-medium">{execution.generated_profiles_count || "0"}</p>
              </div>
            </div>
          )}

          {/* Right Side - Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Running Progress */}
            {isRunning && (
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary animate-pulse" />
                <div className="w-16">
                  <Progress size="sm" color="primary" isIndeterminate />
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {hasActions && (
              <div className="flex gap-1">
                {isCompleted && hasAnalysis && execution.analysis.has_report && (
                  <Tooltip content="View Report">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => onViewReport(execution)}
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                )}

                {isCompleted && hasAnalysis && execution.analysis.has_graph && (
                  <Tooltip content="View Graph">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => onViewGraph(execution)}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                )}

                {isCompleted && execution.generated_profiles_count > 0 && (
                  <Tooltip content="View Profiles">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => onViewProfiles(execution)}
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                )}
              </div>
            )}

            {/* Expand/More Menu */}
            <div className="flex gap-1">
              {(hasAnalysis || execution.execution_name) && (
                <Tooltip content={isExpanded ? "Show less" : "Show more"}>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </Tooltip>
              )}

              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button isIconOnly size="sm" variant="light">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Execution actions">
                  {onDelete && (
                    <DropdownItem
                      key="delete"
                      className="text-danger"
                      color="danger"
                      startContent={<Trash2 className="w-4 h-4" />}
                      onPress={() => onDelete(execution)}
                    >
                      Delete Execution
                    </DropdownItem>
                  )}
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-default-200 space-y-3">
            {/* Execution Name */}
            {execution.execution_name && (
              <div>
                <p className="text-xs text-default-500 mb-1">Execution Name</p>
                <p className="text-sm text-foreground">{execution.execution_name}</p>
              </div>
            )}

            {/* Detailed Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-default-500">Sessions</p>
                  <p className="font-medium">{execution.sessions || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <div>
                  <p className="text-xs text-default-500">Turns/Session</p>
                  <p className="font-medium">{execution.turns_per_session || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-secondary" />
                <div>
                  <p className="text-xs text-default-500">Profiles</p>
                  <p className="font-medium">{execution.generated_profiles_count}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                <div>
                  <p className="text-xs text-default-500">Duration</p>
                  <p className="font-medium">{formatDuration(execution.execution_time_minutes)}</p>
                </div>
              </div>
            </div>

            {/* Analysis Details */}
            {hasAnalysis && (
              <div className="bg-default-50 dark:bg-default-900/20 rounded-lg p-3">
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Analysis Details
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-default-500">Total LLM Calls</p>
                    <p className="font-medium">{execution.analysis.total_interactions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-default-500">Unique Functionalities</p>
                    <p className="font-medium">{execution.analysis.unique_paths_discovered}</p>
                  </div>
                  <div>
                    <p className="text-xs text-default-500">Categories</p>
                    <p className="font-medium">{execution.analysis.categories_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-default-500">Estimated Cost</p>
                    <p className="font-medium">${execution.analysis.estimated_cost_usd.toFixed(4)}</p>
                  </div>
                  {execution.analysis.coverage_percentage !== null && (
                    <div>
                      <p className="text-xs text-default-500">Coverage</p>
                      <p className="font-medium">{execution.analysis.coverage_percentage.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Full Action Buttons (when expanded) */}
            {hasActions && (
              <div className="flex flex-wrap gap-2">
                {isCompleted && hasAnalysis && execution.analysis.has_report && (
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    startContent={<FileText className="w-4 h-4" />}
                    onPress={() => onViewReport(execution)}
                  >
                    View Report
                  </Button>
                )}

                {isCompleted && hasAnalysis && execution.analysis.has_graph && (
                  <Button
                    size="sm"
                    color="secondary"
                    variant="flat"
                    startContent={<BarChart3 className="w-4 h-4" />}
                    onPress={() => onViewGraph(execution)}
                  >
                    View Graph
                  </Button>
                )}

                {isCompleted && execution.generated_profiles_count > 0 && (
                  <Button
                    size="sm"
                    color="success"
                    variant="flat"
                    startContent={<Users className="w-4 h-4" />}
                    onPress={() => onViewProfiles(execution)}
                  >
                    View Original Profiles
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status Messages for Non-completed */}
        {!isCompleted && !isRunning && (
          <div className="mt-2 text-xs text-default-500 italic">
            {execution.status === "ERROR"
              ? "Execution failed"
              : "Execution pending"}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default TracerExecutionCard;
