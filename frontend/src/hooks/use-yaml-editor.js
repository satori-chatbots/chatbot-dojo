import { useState, useEffect, useCallback, useMemo } from "react";
import { EditorView } from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { keymap } from "@codemirror/view";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { lintGutter } from "@codemirror/lint";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { load as yamlLoad } from "js-yaml";

/**
 * Shared hook for YAML editor functionality
 * Handles common state management, validation, and editor configuration
 */
export const useYamlEditor = ({
  initialContent = "",
  onValidate,
  onSave,
  onLoad,
  enableAutosave = false,
  autosaveDelay = 10_000,
  storageKey,
  validateYamlFunction,
}) => {
  // Editor state
  const [editorContent, setEditorContent] = useState(initialContent);
  const [fontSize, setFontSize] = useState(() => {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      // Use a global font size key that's shared across all YAML editors
      const saved = globalThis.localStorage.getItem(`yamlEditorGlobalFontSize`);
      return saved ? JSON.parse(saved) : 14;
    }
    return 14;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState(initialContent);
  const [editorRef, setEditorRef] = useState();

  // Validation state
  const [isValid, setIsValid] = useState(true);
  const [errorInfo, setErrorInfo] = useState();
  const [serverValidationErrors, setServerValidationErrors] = useState();
  const [isValidatingYaml, setIsValidatingYaml] = useState(false);
  const [isValidatingSchema, setIsValidatingSchema] = useState(false);
  const [hasTypedAfterError, setHasTypedAfterError] = useState(false);

  // UI state
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (
      typeof globalThis !== "undefined" &&
      globalThis.localStorage &&
      storageKey
    ) {
      const saved = globalThis.localStorage.getItem(
        `${storageKey}SidebarCollapsed`,
      );
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  // Autosave state
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    if (
      typeof globalThis !== "undefined" &&
      globalThis.localStorage &&
      enableAutosave
    ) {
      const saved = globalThis.localStorage.getItem(
        `${storageKey}AutosaveEnabled`,
      );
      return saved ? JSON.parse(saved) : enableAutosave;
    }
    return enableAutosave;
  });
  const [lastSaved, setLastSaved] = useState();

  // Persist sidebar state
  useEffect(() => {
    if (
      typeof globalThis !== "undefined" &&
      globalThis.localStorage &&
      storageKey
    ) {
      localStorage.setItem(
        `${storageKey}SidebarCollapsed`,
        JSON.stringify(sidebarCollapsed),
      );
    }
  }, [sidebarCollapsed, storageKey]);

  // Persist autosave setting
  useEffect(() => {
    if (
      typeof globalThis !== "undefined" &&
      globalThis.localStorage &&
      storageKey
    ) {
      localStorage.setItem(
        `${storageKey}AutosaveEnabled`,
        JSON.stringify(autosaveEnabled),
      );
    }
  }, [autosaveEnabled, storageKey]);

  // Persist font size
  useEffect(() => {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      // Use a global font size key that's shared across all YAML editors
      localStorage.setItem(
        `yamlEditorGlobalFontSize`,
        JSON.stringify(fontSize),
      );
    }
  }, [fontSize]); // Remove storageKey dependency since we're using a global key

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Zoom functions
  const zoomIn = useCallback(
    () => setFontSize((previous) => Math.min(previous + 2, 24)),
    [],
  );
  const zoomOut = useCallback(
    () => setFontSize((previous) => Math.max(previous - 2, 8)),
    [],
  );

  // Track cursor position
  const cursorPositionExtension = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (update.selectionSet) {
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          setCursorPosition({
            line: line.number,
            column: pos - line.from + 1,
          });
        }
      }),
    [],
  );

  // Jump to error location functionality
  const jumpToError = useCallback(
    (line) => {
      if (editorRef && editorRef.view) {
        try {
          const lineNumber = Math.max(
            1,
            Math.min(line, editorRef.view.state.doc.lines),
          );
          const pos = editorRef.view.state.doc.line(lineNumber).from;
          editorRef.view.dispatch({
            selection: { anchor: pos },
            scrollIntoView: true,
          });
          editorRef.view.focus();
        } catch (error) {
          console.error("Error jumping to line:", error);
        }
      }
    },
    [editorRef],
  );

  // Basic YAML validation
  const validateYaml = useCallback(
    async (value) => {
      if (validateYamlFunction) {
        setIsValidatingYaml(true);
        try {
          const result = await validateYamlFunction(value);

          // Update state based on validation result
          setIsValid(result.isValid);
          setErrorInfo(result.errorInfo);
          setServerValidationErrors(result.serverValidationErrors);
          setHasTypedAfterError(false);

          return result;
        } catch (error) {
          console.error("Validation function error:", error);
          setIsValid(false);
          setErrorInfo({
            message: "Validation failed",
            isSchemaError: false,
          });
          setServerValidationErrors(undefined);
          setHasTypedAfterError(false);
          return { isValid: false };
        } finally {
          setIsValidatingYaml(false);
        }
      }

      setIsValidatingYaml(true);
      try {
        yamlLoad(value);
        setIsValid(true);
        setErrorInfo(undefined);
        setHasTypedAfterError(false);
        setServerValidationErrors(undefined);

        if (onValidate) {
          await onValidate(value);
        }

        return { isValid: true };
      } catch (error) {
        setIsValid(false);
        setServerValidationErrors(undefined);
        const errorLines = error.message.split("\n");
        const errorMessage = errorLines[0];
        const codeContext = errorLines.slice(1).join("\n");
        setErrorInfo({
          message: errorMessage,
          line: error.mark ? error.mark.line + 1 : undefined,
          column: error.mark ? error.mark.column + 1 : undefined,
          codeContext: codeContext,
          isSchemaError: false,
        });
        setHasTypedAfterError(false);
        console.error("Invalid YAML:", error);
        return { isValid: false };
      } finally {
        setIsValidatingYaml(false);
      }
    },
    [validateYamlFunction, onValidate],
  );

  // Custom keymap
  const customKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Enter",
          run: insertNewlineAndIndent,
        },
        ...searchKeymap,
      ]),
    [],
  );

  // Editor extensions
  const extensions = useMemo(
    () => [
      yaml(),
      EditorView.lineWrapping,
      customKeymap,
      highlightSelectionMatches(),
      cursorPositionExtension,
      lintGutter(),
    ],
    [customKeymap, cursorPositionExtension],
  );

  // Handle content change
  const handleEditorChange = useCallback(
    (value) => {
      setEditorContent(value);

      // If there were previous errors, mark that user is typing
      if (!isValid || serverValidationErrors) {
        setHasTypedAfterError(true);
      }

      // Clear server validation errors when user starts typing
      if (serverValidationErrors) {
        setServerValidationErrors(undefined);
      }

      setHasUnsavedChanges(value !== originalContent);
    },
    [isValid, serverValidationErrors, originalContent],
  );

  // Debounced validation effect
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      await validateYaml(editorContent);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [editorContent, validateYaml]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave) return;

    setIsSaving(true);
    setHasTypedAfterError(false);
    try {
      const result = await onSave(editorContent);
      setOriginalContent(editorContent);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      return result;
    } finally {
      setIsSaving(false);
    }
  }, [editorContent, onSave]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(editorContent !== originalContent);
  }, [editorContent, originalContent]);

  // Autosave functionality
  useEffect(() => {
    if (!autosaveEnabled || !hasUnsavedChanges || isSaving) return;

    const timeoutId = setTimeout(() => {
      handleSave();
    }, autosaveDelay);

    return () => clearTimeout(timeoutId);
  }, [hasUnsavedChanges, autosaveEnabled, isSaving, handleSave, autosaveDelay]);

  // Prevent data loss on page leave
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keyboard shortcut for save (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Load content effect
  useEffect(() => {
    if (onLoad) {
      const loadContent = async () => {
        setIsLoading(true);
        try {
          const content = await onLoad();
          if (content) {
            setEditorContent(content);
            setOriginalContent(content);
            await validateYaml(content);
          }
        } finally {
          setIsLoading(false);
        }
      };
      loadContent();
    }
  }, [onLoad, validateYaml]);

  // Computed values
  const wordCount = useMemo(
    () =>
      editorContent
        ? editorContent.split(/\s+/).filter((word) => word.length > 0).length
        : 0,
    [editorContent],
  );

  const lineCount = useMemo(
    () => editorContent.split("\n").length,
    [editorContent],
  );

  return {
    // Editor state
    editorContent,
    setEditorContent,
    handleEditorChange,
    fontSize,
    isLoading,
    setIsLoading,
    isSaving,
    hasUnsavedChanges,
    originalContent,
    setOriginalContent,
    editorRef,
    setEditorRef,

    // Validation state
    isValid,
    setIsValid,
    errorInfo,
    setErrorInfo,
    serverValidationErrors,
    setServerValidationErrors,
    isValidatingYaml,
    setIsValidatingYaml,
    isValidatingSchema,
    setIsValidatingSchema,
    hasTypedAfterError,
    setHasTypedAfterError,
    validateYaml,
    jumpToError,

    // UI state
    cursorPosition,
    sidebarCollapsed,
    setSidebarCollapsed,

    // Autosave state
    autosaveEnabled,
    setAutosaveEnabled,
    lastSaved,

    // Actions
    handleSave,
    zoomIn,
    zoomOut,

    // Extensions and computed values
    extensions,
    customKeymap,
    cursorPositionExtension,
    wordCount,
    lineCount,
  };
};
