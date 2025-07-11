import React, { useState } from "react";
import { Card, CardBody, Button, Chip, Progress, Tooltip } from "@heroui/react";
import {
  FileText,
  BarChart3,
  Users,
  Clock,
  Activity,
  TrendingUp,
  Zap,
  ChevronDown,
  ChevronUp,
  Trash2,
  Terminal,
} from "lucide-react";

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return `TRACER • ${dateStr} ${timeStr}`;
};

const formatDuration = (minutes) => {
  if (!minutes) return "N/A";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const TracerExecutionCard = ({
  execution,
  onViewReport,
  onViewGraph,
  onViewProfiles,
  onViewLogs,
  onDelete,
  getStatusIcon,
  getStatusColor,
  progressStage,
  progressPercentage,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isCompleted = execution.status === "COMPLETED";
  const isRunning = execution.status === "RUNNING";
  const hasAnalysis = execution.has_analysis && execution.analysis;
  const hasActions =
    (isCompleted && hasAnalysis) ||
    (isCompleted && execution.generated_profiles_count > 0);

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
                  {formatDate(execution.created_at)}
                </h3>
                <Chip
                  color={getStatusColor(execution.status)}
                  variant="flat"
                  startContent={getStatusIcon(execution.status)}
                  size="sm"
                  className="flex-shrink-0"
                >
                  {execution.status === "ERROR" && execution.error_type
                    ? execution.error_type
                    : execution.status}
                </Chip>
              </div>

              <div className="flex items-center gap-4 text-xs text-default-500">
                <span>{execution.project_name}</span>
                {execution.execution_time_minutes && (
                  <span>
                    • {formatDuration(execution.execution_time_minutes)} runtime
                  </span>
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
                <p className="font-medium">
                  {execution.turns_per_session || "0"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-default-500">Profiles</p>
                <p className="font-medium">
                  {execution.generated_profiles_count || "0"}
                </p>
              </div>
            </div>
          )}

          {/* Right Side - Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Running Progress */}
            {isRunning && (
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-primary animate-pulse" />
                <div className="flex flex-col gap-1 min-w-0">
                  {progressStage && (
                    <span className="text-xs text-primary font-medium truncate max-w-32">
                      {progressStage}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-16">
                      <Progress
                        size="sm"
                        color="primary"
                        value={progressPercentage || 0}
                        className="transition-all duration-500 ease-out"
                      />
                    </div>
                    <span className="text-xs text-default-500 font-mono">
                      {progressPercentage || 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-1">
              <Tooltip
                content={
                  isCompleted && hasAnalysis && execution.analysis.has_report
                    ? "View Report"
                    : "Report not available"
                }
              >
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  isDisabled={
                    !(
                      isCompleted &&
                      hasAnalysis &&
                      execution.analysis.has_report
                    )
                  }
                  onPress={() => onViewReport(execution)}
                >
                  <FileText className="w-4 h-4" />
                </Button>
              </Tooltip>

              <Tooltip
                content={
                  isCompleted && hasAnalysis && execution.analysis.has_graph
                    ? "View Graph"
                    : "Graph not available"
                }
              >
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  isDisabled={
                    !(
                      isCompleted &&
                      hasAnalysis &&
                      execution.analysis.has_graph
                    )
                  }
                  onPress={() => onViewGraph(execution)}
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
              </Tooltip>

              <Tooltip
                content={
                  isCompleted && execution.generated_profiles_count > 0
                    ? "View Profiles"
                    : "Profiles not available"
                }
              >
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  isDisabled={
                    !(isCompleted && execution.generated_profiles_count > 0)
                  }
                  onPress={() => onViewProfiles(execution)}
                >
                  <Users className="w-4 h-4" />
                </Button>
              </Tooltip>

              {execution.has_logs && onViewLogs && (
                <Tooltip content="View Execution Logs">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color={execution.has_error ? "danger" : "default"}
                    onPress={() => onViewLogs(execution)}
                  >
                    <Terminal className="w-4 h-4" />
                  </Button>
                </Tooltip>
              )}
            </div>

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
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </Tooltip>
              )}

              {onDelete && (
                <Tooltip content="Delete Execution">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => onDelete(execution)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Tooltip>
              )}
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
                <p className="text-sm text-foreground">
                  {execution.execution_name}
                </p>
              </div>
            )}

            {/* Detailed Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
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
                  <p className="font-medium">
                    {execution.turns_per_session || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-secondary" />
                <div>
                  <p className="text-xs text-default-500">Profiles</p>
                  <p className="font-medium">
                    {execution.generated_profiles_count}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                <div>
                  <p className="text-xs text-default-500">Duration</p>
                  <p className="font-medium">
                    {formatDuration(execution.execution_time_minutes)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-default-500">Verbosity</p>
                  <div className="flex items-center gap-1">
                    <p className="font-medium capitalize text-xs">
                      {execution.verbosity || "normal"}
                    </p>
                    {execution.verbosity === "verbose" && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">
                        -v
                      </span>
                    )}
                    {execution.verbosity === "debug" && (
                      <span className="text-xs bg-warning-100 text-warning-700 px-1.5 py-0.5 rounded">
                        -vv
                      </span>
                    )}
                  </div>
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
                    <p className="font-medium">
                      {execution.analysis.total_interactions}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-default-500">
                      Unique Functionalities
                    </p>
                    <p className="font-medium">
                      {execution.analysis.unique_paths_discovered}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-default-500">Categories</p>
                    <p className="font-medium">
                      {execution.analysis.categories_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-default-500">Estimated Cost</p>
                    <p className="font-medium">
                      ${execution.analysis.estimated_cost_usd.toFixed(4)}
                    </p>
                  </div>
                  {execution.analysis.coverage_percentage !== null && (
                    <div>
                      <p className="text-xs text-default-500">Coverage</p>
                      <p className="font-medium">
                        {execution.analysis.coverage_percentage.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Full Action Buttons (when expanded) */}
            {hasActions && (
              <div className="flex flex-wrap gap-2">
                {isCompleted &&
                  hasAnalysis &&
                  execution.analysis.has_report && (
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

                {execution.has_logs && onViewLogs && (
                  <Button
                    size="sm"
                    color={execution.has_error ? "danger" : "default"}
                    variant="flat"
                    startContent={<Terminal className="w-4 h-4" />}
                    onPress={() => onViewLogs(execution)}
                  >
                    View Logs
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

export default React.memo(TracerExecutionCard);
