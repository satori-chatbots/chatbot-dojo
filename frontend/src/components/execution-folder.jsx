import React, { useState } from "react";
import { Link, Button } from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  AlertTriangle,
  Clock,
  Users
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const ExecutionFolder = ({
  execution,
  profiles,
  selectedFiles,
  onProfileSelect,
  showAll = false,
  onToggleShowAll
}) => {
  const [isExpanded, setIsExpanded] = useState(true); // Start expanded by default
  const navigate = useNavigate();

  const displayProfiles = showAll ? profiles : profiles.slice(0, 3);
  const hasMoreProfiles = profiles.length > 3;

  const getFolderIcon = () => {
    if (execution.execution_type === "manual") {
      return <Users className="w-4 h-4" />;
    }
    return <Clock className="w-4 h-4" />;
  };

  const getFolderHeader = () => {
    const timestamp = new Date(execution.created_at).toLocaleString();
    if (execution.execution_type === "manual") {
      return `Manual_${timestamp}`;
    }
    return `TRACER_${timestamp}`;
  };

  const getDisplayInfo = () => {
    if (execution.execution_type === "tracer") {
      return `(${execution.sessions} sessions, ${execution.turns_per_session} turns)`;
    }
    return `(${execution.generated_profiles_count} profiles)`;
  };

  return (
    <div className="mb-4 border border-default-200 rounded-lg bg-content1">
      {/* Folder Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-content2 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-default-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-default-500" />
          )}
          {getFolderIcon()}
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-foreground">
                {getFolderHeader()}
              </span>
              <span className="text-sm text-default-500">
                {getDisplayInfo()}
              </span>
            </div>
            {execution.execution_type === "tracer" && execution.status && (
              <span className={`text-xs ${
                execution.status === "COMPLETED" ? "text-success" :
                execution.status === "RUNNING" ? "text-warning" :
                execution.status === "ERROR" ? "text-danger" : "text-default-500"
              }`}>
                Status: {execution.status}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 text-sm text-default-500">
          <Folder className="w-4 h-4" />
          <span>{profiles.length} profiles</span>
        </div>
      </div>

      {/* Profiles List */}
      {isExpanded && (
        <div className="border-t border-default-200 p-3 bg-content2/50">
          {profiles.length === 0 ? (
            <p className="text-default-500 text-sm italic">No profiles in this execution</p>
          ) : (
            <>
              <ul className="space-y-2">
                {displayProfiles.map((profile) => (
                  <li key={profile.id} className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(profile.id)}
                      onChange={() => onProfileSelect(profile.id)}
                      className="form-checkbox h-4 w-4 mt-1"
                    />
                    <div className="flex items-center space-x-2 flex-1">
                      <Link
                        variant="light"
                        onPress={() => navigate(`/yaml-editor/${profile.id}`)}
                        className="flex-1 break-words max-w-sm md:max-w-lg lg:max-w-2xl text-primary hover:underline text-left"
                      >
                        {profile.name}
                      </Link>
                      {profile.is_valid === false && (
                        <div
                          className="tooltip-container"
                          title="Invalid profile: This YAML has validation errors"
                        >
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Show All/Collapse Button */}
              {hasMoreProfiles && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="light"
                    color="primary"
                    onPress={() => onToggleShowAll(execution.id)}
                    className="text-xs"
                  >
                    {showAll ?
                      `[−] Show less...` :
                      `[+] Show all ${profiles.length} profiles...`
                    }
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ExecutionFolder;
