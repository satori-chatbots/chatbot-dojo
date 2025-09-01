import React, { useState, useEffect, useCallback } from "react";
import {
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  Card,
  CardBody,
  Accordion,
  AccordionItem,
} from "@heroui/react";
import { Users, ArrowLeft, AlertCircle, FileText, Copy } from "lucide-react";
import { fetchTracerOriginalProfiles } from "../api/file-api";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

// Simple YAML syntax highlighter
const highlightYaml = (yaml) => {
  let highlighted = yaml
    // Comments
    .replaceAll(
      /(#.*$)/gm,
      '<span class="text-success-600 dark:text-success-400">$1</span>',
    )
    // Keys (before colon)
    .replaceAll(
      /^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gm,
      '$1<span class="text-primary-600 dark:text-primary-400 font-semibold">$2</span>:',
    )
    // String values (quoted)
    .replaceAll(
      /:\s*["']([^"']*?)["']/g,
      ': <span class="text-warning-600 dark:text-warning-400">"$1"</span>',
    )
    // Numbers
    .replaceAll(
      /:\s*(\d+\.?\d*)\s*$/gm,
      ': <span class="text-secondary-600 dark:text-secondary-400">$1</span>',
    )
    // Booleans
    .replaceAll(
      /:\s*(true|false)\s*$/gm,
      ': <span class="text-danger-600 dark:text-danger-400">$1</span>',
    )
    // Array items
    .replaceAll(
      /^(\s*)-\s+/gm,
      '$1<span class="text-default-600 dark:text-default-400">-</span> ',
    );

  return highlighted;
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};

const YamlHighlighter = ({ content }) => {
  return (
    <div className="bg-default-50 dark:bg-default-900/10 rounded-lg border border-default-200 dark:border-default-700 overflow-hidden">
      <div className="overflow-x-auto">
        <pre className="p-3 sm:p-4 text-xs sm:text-sm md:text-sm whitespace-pre-wrap break-words min-w-0">
          <code
            className="text-foreground block"
            dangerouslySetInnerHTML={{ __html: highlightYaml(content) }}
          />
        </pre>
      </div>
    </div>
  );
};

const OriginalProfilesViewer = ({ execution, onClose }) => {
  const [profilesData, setProfilesData] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  const { showToast } = useMyCustomToast();

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const data = await fetchTracerOriginalProfiles(execution.id);
      setProfilesData(data);
    } catch (error) {
      console.error("Error loading TRACER original profiles:", error);
      setError("Failed to load the original profiles");
      showToast("Failed to load original profiles", "error");
    } finally {
      setLoading(false);
    }
  }, [execution.id, showToast]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleCopyAll = async () => {
    if (!profilesData?.profiles) return;

    try {
      const allContent = profilesData.profiles
        .map((profile) => `# ${profile.filename}\n\n${profile.content}`)
        .join("\n\n---\n\n");

      await navigator.clipboard.writeText(allContent);
      showToast("All profiles copied to clipboard", "success");
    } catch (error_) {
      console.error("Failed to copy all profiles:", error_);
      showToast("Failed to copy profiles", "error");
    }
  };

  return (
    <>
      <ModalHeader className="flex flex-col gap-3 sm:gap-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3 sm:gap-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-success-50 dark:bg-success-900/20 flex-shrink-0">
              <Users className="w-5 h-5 text-success" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold truncate">
                Original TRACER Profiles
              </h2>
              <p className="text-xs sm:text-sm text-default-500 truncate">
                {execution.execution_name} -{" "}
                {profilesData?.project_name || execution.project_name}
              </p>
            </div>
          </div>

          {profilesData?.profiles && profilesData.profiles.length > 0 && (
            <Button
              size="sm"
              color="success"
              variant="flat"
              startContent={<Copy className="w-4 h-4" />}
              onPress={handleCopyAll}
              className="w-full sm:w-auto"
            >
              Copy All
            </Button>
          )}
        </div>
      </ModalHeader>

      <ModalBody>
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner size="lg" />
            <p className="text-default-500">Loading original profiles...</p>
          </div>
        )}

        {error && (
          <Card className="border-danger-200 bg-danger-50 dark:bg-danger-900/20">
            <CardBody className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-danger mb-2">
                Failed to Load Profiles
              </h3>
              <p className="text-danger-600 dark:text-danger-400 mb-4">
                {error}
              </p>
              <Button
                color="danger"
                variant="light"
                onPress={loadProfiles}
                size="sm"
              >
                Try Again
              </Button>
            </CardBody>
          </Card>
        )}

        {profilesData && !loading && !error && (
          <div className="space-y-4">
            {profilesData.profiles.length === 0 ? (
              <Card className="border-default-200 dark:border-default-700">
                <CardBody className="text-center py-8">
                  <FileText className="w-12 h-12 text-default-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-default-600 dark:text-default-400 mb-2">
                    No Original Profiles Found
                  </h3>
                  <p className="text-default-500">
                    No original profiles were stored for this execution.
                  </p>
                </CardBody>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                <Card className="border-success-200 bg-success-50 dark:bg-success-900/20">
                  <CardBody className="text-center py-4">
                    <p className="text-success-700 dark:text-success-400">
                      <strong>{profilesData.profiles.length}</strong> original
                      profiles found. These are read-only copies of the profiles
                      as originally generated by TRACER.
                    </p>
                  </CardBody>
                </Card>

                {/* Profiles using Accordion for better space management */}
                <Accordion
                  variant="splitted"
                  selectionMode="multiple"
                  className="px-0"
                >
                  {profilesData.profiles.map((profile, index) => (
                    <AccordionItem
                      key={profile.id}
                      aria-label={profile.filename}
                      title={
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-success-100 dark:bg-success-900/20 flex-shrink-0">
                            <span className="text-xs font-semibold text-success-700 dark:text-success-400">
                              {index + 1}
                            </span>
                          </div>
                          <span className="font-medium text-sm sm:text-base truncate flex-1 min-w-0">
                            {profile.filename}
                          </span>
                          <span className="text-xs text-default-500 ml-auto flex-shrink-0 hidden sm:block">
                            {formatDate(profile.created_at)}
                          </span>
                        </div>
                      }
                      subtitle={
                        <span className="text-xs text-default-500 block sm:hidden mt-1">
                          {formatDate(profile.created_at)}
                        </span>
                      }
                      className="border-default-200 dark:border-default-700"
                    >
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 mb-3">
                          <p className="text-xs sm:text-sm text-default-600 dark:text-default-400 flex-1">
                            Original TRACER-generated profile content
                            (read-only)
                          </p>
                          <Button
                            size="sm"
                            variant="light"
                            startContent={<Copy className="w-4 h-4" />}
                            onPress={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  profile.content,
                                );
                                showToast(
                                  `${profile.filename} copied to clipboard`,
                                  "success",
                                );
                              } catch {
                                showToast("Failed to copy profile", "error");
                              }
                            }}
                            className="w-full sm:w-auto"
                          >
                            Copy
                          </Button>
                        </div>
                        <YamlHighlighter content={profile.content} />
                      </div>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          color="success"
          variant="light"
          startContent={<ArrowLeft className="w-4 h-4" />}
          onPress={onClose}
        >
          Back to Dashboard
        </Button>
      </ModalFooter>
    </>
  );
};

export default OriginalProfilesViewer;
