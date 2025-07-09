import React, { useState } from "react";
import { Link, Button, Chip } from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  Users,
  Settings,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const ExecutionFolder = ({
  execution,
  profiles,
  selectedFiles,
  onProfileSelect,
  showAll = false,
  onToggleShowAll,
  onDeleteExecution,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const displayProfiles = showAll ? profiles : profiles.slice(0, 4);
  const hasMoreProfiles = profiles.length > 4;

  const getExecutionLabel = () => {
    const date = new Date(execution.created_at);
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    if (execution.execution_type === "manual") {
      return "Manual Profiles";
    }
    return `TRACER • ${dateStr} ${timeStr}`;
  };

  const getExecutionIcon = () => {
    if (execution.execution_type === "manual") {
      return <Users className="w-4 h-4 text-blue-500" />;
    }
    return <Settings className="w-4 h-4 text-purple-500" />;
  };

  const getStatusChip = () => {
    if (execution.execution_type !== "tracer" || !execution.status) return null;

    const statusConfig = {
      COMPLETED: { color: "success", label: "Done" },
      RUNNING: { color: "warning", label: "Running" },
      ERROR: { color: "danger", label: "Failed" },
      PENDING: { color: "default", label: "Pending" },
    };

    const config = statusConfig[execution.status] || statusConfig["PENDING"];

    return (
      <Chip size="sm" color={config.color} variant="flat">
        {config.label}
      </Chip>
    );
  };

  const getDetailsText = () => {
    if (execution.execution_type === "tracer") {
      return `${execution.sessions}s • ${execution.turns_per_session}t`;
    }
    return `${profiles.length} profiles`;
  };

  const handleDelete = async (e) => {
    // HeroUI onPress doesn't always pass a proper event object
    if (e && e.stopPropagation) {
      e.stopPropagation(); // Prevent folder toggle if event exists
    }

    // Simple confirmation
    const confirmMessage =
      execution.execution_type === "manual"
        ? `Delete manual execution "${execution.execution_name}"?\n\nThis will only work if no profiles are in this execution.`
        : `Delete TRACER execution "${execution.execution_name}"?\n\nThis will permanently delete all ${profiles.length} profiles.`;

    if (!globalThis.confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteExecution(execution.id);
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = execution.execution_type === "tracer";
  // Manual executions are permanent and should not be deleted

  return (
    <div className="group">
      {/* Header */}
      <div
        className="flex items-center justify-between py-2 px-1 cursor-pointer hover:bg-default-50 rounded-md transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-default-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-default-400 flex-shrink-0" />
          )}

          {getExecutionIcon()}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground text-sm">
                {getExecutionLabel()}
              </span>
              {getStatusChip()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-default-500 flex-shrink-0">
          <span>{getDetailsText()}</span>
          <span>{profiles.length} files</span>

          {/* Delete Button - Only show if deletable */}
          {canDelete && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 min-w-6"
              onPress={handleDelete}
              isLoading={isDeleting}
              title={
                execution.execution_type === "manual"
                  ? "Delete manual execution (only if empty)"
                  : "Delete TRACER execution"
              }
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Profiles List */}
      {isExpanded && (
        <div className="ml-6 mt-1 mb-3">
          {profiles.length === 0 ? (
            <p className="text-default-400 text-sm italic py-2">No profiles</p>
          ) : (
            <div className="space-y-1">
              {displayProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-2 py-1 group/item"
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(profile.id)}
                    onChange={() => onProfileSelect(profile.id)}
                    className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary focus:ring-1"
                  />

                  <Link
                    onPress={() => navigate(`/yaml-editor/${profile.id}`)}
                    className="text-sm text-default-700 hover:text-primary transition-colors flex-1 truncate"
                  >
                    {profile.name}
                  </Link>

                  {profile.is_valid === false && (
                    <AlertTriangle
                      className="w-4 h-4 text-danger flex-shrink-0"
                      title="Invalid YAML"
                    />
                  )}
                </div>
              ))}

              {hasMoreProfiles && (
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={() => onToggleShowAll(execution.id)}
                  className="mt-2 h-6 text-xs font-normal"
                >
                  {showAll ? "Show less" : `+${profiles.length - 4} more`}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExecutionFolder;
