import React from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Progress,
} from "@heroui/react";
import {
  FileText,
  BarChart3,
  Users,
  Clock,
  Activity,
  TrendingUp,
  Zap,
} from "lucide-react";

const TracerExecutionCard = ({
  execution,
  onViewReport,
  onViewGraph,
  onViewProfiles,
  getStatusIcon,
  getStatusColor,
}) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "N/A";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const isCompleted = execution.status === "COMPLETED";
  const isRunning = execution.status === "RUNNING";
  const hasAnalysis = execution.has_analysis && execution.analysis;

  return (
    <Card className="border-default-200 hover:border-primary-200 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {execution.execution_name}
              </h3>
              <p className="text-sm text-default-500">
                Project: {execution.project_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip
              color={getStatusColor(execution.status)}
              variant="flat"
              startContent={getStatusIcon(execution.status)}
              size="sm"
            >
              {execution.status}
            </Chip>
          </div>
        </div>
      </CardHeader>

      <CardBody className="pt-0">
        <div className="space-y-4">
          {/* Execution Details */}
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
          </div>

          {/* Analysis Summary */}
          {hasAnalysis && (
            <div className="bg-default-50 dark:bg-default-900/20 rounded-lg p-3">
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analysis Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

          {/* Running Progress */}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm text-primary font-medium">
                  Execution in progress...
                </span>
              </div>
              <Progress
                size="sm"
                color="primary"
                isIndeterminate
                className="w-full"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
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

            {!isCompleted && !isRunning && (
              <div className="text-sm text-default-500 italic">
                {execution.status === "ERROR"
                  ? "Execution failed - no actions available"
                  : "Execution pending - no actions available yet"}
              </div>
            )}
          </div>

          {/* Execution Info */}
          <div className="text-xs text-default-500 border-t border-default-200 pt-2">
            Created: {formatDate(execution.created_at)}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default TracerExecutionCard;
