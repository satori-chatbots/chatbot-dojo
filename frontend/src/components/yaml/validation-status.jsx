import React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

/**
 * Validation status component showing YAML and schema validation state
 */
export const ValidationStatus = ({
  isValidatingYaml,
  isValidatingSchema,
  hasTypedAfterError,
  isValid,
  errorInfo,
  serverValidationErrors,
  onJumpToError,
}) => {
  if (isValidatingYaml) {
    return (
      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md text-sm">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="font-medium">Validating YAML...</span>
      </div>
    );
  }

  if (isValidatingSchema) {
    return (
      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md text-sm">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="font-medium">Validating Profile...</span>
      </div>
    );
  }

  if (hasTypedAfterError) {
    return (
      <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-md text-sm">
        <AlertCircle className="w-3.5 h-3.5" />
        <span className="font-medium">Checking...</span>
      </div>
    );
  }

  if (isValid === false) {
    return (
      <div className="flex items-start gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-md text-sm">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium">Invalid YAML</div>
          {errorInfo && !errorInfo.isSchemaError && (
            <div
              role="button"
              tabIndex={0}
              className="text-xs opacity-75 mt-0.5 cursor-pointer hover:opacity-100 underline decoration-dotted"
              onClick={() =>
                errorInfo.line && onJumpToError && onJumpToError(errorInfo.line)
              }
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === " ") &&
                  errorInfo.line &&
                  onJumpToError
                ) {
                  onJumpToError(errorInfo.line);
                }
              }}
              title={
                errorInfo.line
                  ? `Click to jump to line ${errorInfo.line}`
                  : undefined
              }
            >
              {errorInfo.message}
              {errorInfo.line && ` at line ${errorInfo.line}`}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (serverValidationErrors && serverValidationErrors.length > 0) {
    return (
      <div className="flex items-start gap-2 text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-md text-sm">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium">Invalid Profile</div>
          <div className="text-xs opacity-75 mt-0.5">
            {serverValidationErrors.length} validation{" "}
            {serverValidationErrors.length === 1 ? "error" : "errors"}
            {serverValidationErrors.some((error) => error.line) &&
              " (click to jump)"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-md text-sm">
      <CheckCircle2 className="w-3.5 h-3.5" />
      <span className="font-medium">Valid Profile</span>
    </div>
  );
};
