import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from "@heroui/react";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  PanelRightOpen,
  Plus,
  Send,
  Settings,
  User,
  X,
} from "lucide-react";
import {
  assignSenpaiApiKey,
  fetchSenpaiAssistantModels,
  initializeSenpaiConversation,
  resolveSenpaiApprovals,
  sendSenpaiMessage,
} from "../api/senpai-api";
import MarkdownMessage from "./markdown-message";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";
import { useSetup } from "../contexts/setup-context";

const buildThreadStorageKey = (threadId) => `senpai-thread-history:${threadId}`;
const DESKTOP_COLLAPSED_KEY = "senpai-sidebar-collapsed";
const DESKTOP_WIDTH_KEY = "senpai-sidebar-width";
const MESSAGE_ROLES = new Set(["approval", "assistant", "user"]);
const DEFAULT_DESKTOP_WIDTH = 420;
const MIN_DESKTOP_WIDTH = 320;
const MAX_DESKTOP_WIDTH = 720;
const DESKTOP_SIDEBAR_VIEWPORT_MARGIN = 160;
const DESKTOP_COLLAPSED_WIDTH = 56;
const SCROLL_BOTTOM_THRESHOLD = 24;
const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

const getStoredActiveProjectId = () => {
  try {
    const storedProject = globalThis.localStorage.getItem("selectedProject");
    if (!storedProject) {
      return;
    }

    const project = JSON.parse(storedProject);
    const projectId = Number(project?.id);
    if (Number.isInteger(projectId) && projectId > 0) {
      return projectId;
    }
  } catch {
    return;
  }
};

const isValidStoredThreadMessage = (message) => {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return false;
  }

  if (
    typeof message.id !== "string" ||
    !MESSAGE_ROLES.has(message.role) ||
    typeof message.timestamp !== "string"
  ) {
    return false;
  }

  if (Number.isNaN(Date.parse(message.timestamp))) {
    return false;
  }

  if (message.role === "approval") {
    return Boolean(message.approval && typeof message.approval === "object");
  }

  return typeof message.content === "string";
};

const readStoredThreadMessages = (threadId) => {
  if (!threadId) {
    return [];
  }

  try {
    const stored = globalThis.sessionStorage.getItem(
      buildThreadStorageKey(threadId),
    );
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) &&
      parsed.every((message) => isValidStoredThreadMessage(message))
      ? parsed
      : [];
  } catch {
    return [];
  }
};

const writeStoredThreadMessages = (threadId, messages) => {
  if (!threadId) {
    return;
  }

  try {
    globalThis.sessionStorage.setItem(
      buildThreadStorageKey(threadId),
      JSON.stringify(messages),
    );
  } catch {
    // Ignore storage failures so message updates do not crash the sidebar.
  }
};

const readDesktopSidebarCollapsed = () => {
  try {
    return globalThis.localStorage?.getItem(DESKTOP_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
};

const writeDesktopSidebarCollapsed = (isCollapsed) => {
  try {
    globalThis.localStorage?.setItem(
      DESKTOP_COLLAPSED_KEY,
      String(isCollapsed),
    );
  } catch {
    // Ignore storage failures so the sidebar remains usable.
  }
};

const clampDesktopSidebarWidth = (width) => {
  const viewportWidth = globalThis.innerWidth || MAX_DESKTOP_WIDTH;
  const maxAllowedWidth = Math.max(
    MIN_DESKTOP_WIDTH,
    Math.min(
      MAX_DESKTOP_WIDTH,
      viewportWidth - DESKTOP_SIDEBAR_VIEWPORT_MARGIN,
    ),
  );

  return Math.min(Math.max(width, MIN_DESKTOP_WIDTH), maxAllowedWidth);
};

const readDesktopSidebarWidth = () => {
  try {
    const storedWidthValue =
      globalThis.localStorage?.getItem(DESKTOP_WIDTH_KEY);
    if (storedWidthValue === null || storedWidthValue === "") {
      return DEFAULT_DESKTOP_WIDTH;
    }

    const storedWidth = Number(storedWidthValue);
    return Number.isFinite(storedWidth)
      ? clampDesktopSidebarWidth(storedWidth)
      : DEFAULT_DESKTOP_WIDTH;
  } catch {
    return DEFAULT_DESKTOP_WIDTH;
  }
};

const writeDesktopSidebarWidth = (width) => {
  try {
    globalThis.localStorage?.setItem(
      DESKTOP_WIDTH_KEY,
      String(clampDesktopSidebarWidth(width)),
    );
  } catch {
    // Ignore storage failures so the sidebar remains usable.
  }
};

const formatTimestamp = (value) => TIMESTAMP_FORMATTER.format(new Date(value));

const getApprovalActionRequests = (approval) => {
  const actionRequests = approval?.value?.action_requests;
  return Array.isArray(actionRequests) ? actionRequests : [];
};

const getApprovalTitle = (approval) => {
  const [actionRequest] = getApprovalActionRequests(approval);
  return actionRequest?.name || "Tool approval";
};

const getApprovalDescription = (approval) => {
  const [actionRequest] = getApprovalActionRequests(approval);
  if (typeof actionRequest?.description === "string") {
    return actionRequest.description;
  }

  if (typeof approval?.value?.description === "string") {
    return approval.value.description;
  }

  return "Review this assistant action before continuing.";
};

const isScrolledToBottom = (element) => {
  if (!element) {
    return true;
  }

  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    SCROLL_BOTTOM_THRESHOLD
  );
};

const SenpaiAssistantPanel = ({ onClose, isMobile = false, onCollapse }) => {
  const { showToast } = useMyCustomToast();
  const { setupData, reloadApiKeys } = useSetup();
  const messagesContainerReference = useRef(undefined);
  const endOfMessagesReference = useRef(undefined);
  const composerReference = useRef(undefined);
  const isMountedReference = useRef(false);
  const messageIdSequence = useRef(0);
  const sendMessageLock = useRef(false);
  const shouldFocusComposerReference = useRef(false);
  const isAtBottomReference = useRef(true);
  const previousMessageCountReference = useRef(0);

  const [conversation, setConversation] = useState();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshingThread, setIsRefreshingThread] = useState(false);
  const [isUpdatingApiKey, setIsUpdatingApiKey] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedApiKeyKey, setSelectedApiKeyKey] = useState("none");
  const [selectedModelKey, setSelectedModelKey] = useState("");
  const [assistantModels, setAssistantModels] = useState([]);
  const [modelSource, setModelSource] = useState("");
  const [hasUnreadAssistantMessage, setHasUnreadAssistantMessage] =
    useState(false);

  const supportedApiKeys = useMemo(
    () =>
      (setupData.apiKeys || []).filter((apiKey) =>
        ["openai", "gemini"].includes(apiKey.provider),
      ),
    [setupData.apiKeys],
  );

  useEffect(() => {
    isMountedReference.current = true;

    return () => {
      isMountedReference.current = false;
    };
  }, []);

  useEffect(() => {
    setSelectedApiKeyKey(
      conversation?.assistant_api_key?.id
        ? String(conversation.assistant_api_key.id)
        : "none",
    );
  }, [conversation?.assistant_api_key?.id]);

  useEffect(() => {
    setSelectedModelKey(conversation?.assistant_model || "");
  }, [conversation?.assistant_model]);

  const loadConversation = useCallback(
    async ({ forceNew = false, showFullSpinner = false } = {}) => {
      const setLoadingState = showFullSpinner
        ? setIsBootstrapping
        : setIsRefreshingThread;

      setLoadingState(true);
      try {
        const data = await initializeSenpaiConversation(forceNew);
        if (!isMountedReference.current) {
          return;
        }

        setConversation(data.conversation);
        shouldFocusComposerReference.current = true;
        if (forceNew) {
          setDraft("");
          setMessages([]);
          showToast("success", "New Senpai conversation started");
        }
      } catch (error) {
        if (isMountedReference.current) {
          showToast(
            "error",
            error.message || "Failed to initialize Senpai Assistant",
          );
        }
      } finally {
        if (isMountedReference.current) {
          setLoadingState(false);
        }
      }
    },
    [showToast],
  );

  useEffect(() => {
    void loadConversation({ showFullSpinner: true });
    void reloadApiKeys();
  }, [loadConversation, reloadApiKeys]);

  useEffect(() => {
    if (isSettingsOpen || (conversation && !conversation.assistant_api_key)) {
      void reloadApiKeys();
    }
  }, [
    conversation,
    conversation?.assistant_api_key,
    isSettingsOpen,
    reloadApiKeys,
  ]);

  useEffect(() => {
    setMessages(readStoredThreadMessages(conversation?.thread_id));
    setHasUnreadAssistantMessage(false);
    previousMessageCountReference.current = 0;
    isAtBottomReference.current = true;
  }, [conversation?.thread_id]);

  useEffect(() => {
    if (conversation?.thread_id) {
      writeStoredThreadMessages(conversation.thread_id, messages);
    }
  }, [conversation?.thread_id, messages]);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    endOfMessagesReference.current?.scrollIntoView({ behavior });
    isAtBottomReference.current = true;
    setHasUnreadAssistantMessage(false);
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const isAtBottomNow = isScrolledToBottom(
      messagesContainerReference.current,
    );

    isAtBottomReference.current = isAtBottomNow;
    if (isAtBottomNow) {
      setHasUnreadAssistantMessage(false);
    }
  }, []);

  useEffect(() => {
    const currentMessageCount = messages.length;
    const hadNewMessage =
      currentMessageCount > previousMessageCountReference.current;
    const latestMessage =
      hadNewMessage && currentMessageCount > 0
        ? messages[currentMessageCount - 1]
        : undefined;

    if (
      isSending ||
      isAtBottomReference.current ||
      latestMessage?.role === "user"
    ) {
      scrollToBottom(hadNewMessage ? "smooth" : "auto");
    } else if (latestMessage?.role === "assistant") {
      setHasUnreadAssistantMessage(true);
    }

    previousMessageCountReference.current = currentMessageCount;
  }, [messages, isSending, scrollToBottom]);

  const createMessageId = useCallback((role) => {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (typeof uuid === "string") {
      return `${role}-${uuid}`;
    }

    messageIdSequence.current += 1;
    return `${role}-${Date.now()}-${messageIdSequence.current}`;
  }, []);

  const handleApiKeyChange = async (keys) => {
    const nextValue = [...keys][0] || "none";
    const apiKeyId = nextValue === "none" ? undefined : Number(nextValue);

    setSelectedApiKeyKey(String(nextValue));
    setIsUpdatingApiKey(true);
    try {
      const data = await assignSenpaiApiKey(apiKeyId);
      if (!isMountedReference.current) {
        return;
      }

      setConversation(data.conversation);
      shouldFocusComposerReference.current = true;
      showToast("success", "Assistant API key updated");
    } catch (error) {
      if (isMountedReference.current) {
        setSelectedApiKeyKey(
          conversation?.assistant_api_key?.id
            ? String(conversation.assistant_api_key.id)
            : "none",
        );
        showToast(
          "error",
          error.message || "Failed to update assistant API key",
        );
      }
    } finally {
      if (isMountedReference.current) {
        setIsUpdatingApiKey(false);
      }
    }
  };

  useEffect(() => {
    if (selectedApiKeyKey === "none") {
      setAssistantModels([]);
      setModelSource("");
      setSelectedModelKey("");
      return;
    }

    let ignoreResult = false;
    setIsLoadingModels(true);

    const loadModels = async () => {
      try {
        const data = await fetchSenpaiAssistantModels(selectedApiKeyKey);
        if (ignoreResult || !isMountedReference.current) {
          return;
        }

        const models = Array.isArray(data.models) ? data.models : [];
        setAssistantModels(models);
        setModelSource(data.source || "");

        const currentModel = conversation?.assistant_model || "";
        const hasCurrentModel = models.some(
          (model) => model.id === currentModel,
        );
        if (currentModel && hasCurrentModel) {
          setSelectedModelKey(currentModel);
          return;
        }

        const providerDefaultModel = data.default_model || "";
        const defaultModel = models.some(
          (model) => model.id === providerDefaultModel,
        )
          ? providerDefaultModel
          : models[0]?.id || providerDefaultModel;
        setSelectedModelKey(defaultModel);
        if (defaultModel && defaultModel !== currentModel) {
          const update = await assignSenpaiApiKey(
            Number(selectedApiKeyKey),
            defaultModel,
          );
          if (!ignoreResult && isMountedReference.current) {
            setConversation(update.conversation);
          }
        }
      } catch (error) {
        if (!ignoreResult && isMountedReference.current) {
          setAssistantModels([]);
          setModelSource("");
          showToast(
            "error",
            error.message || "Failed to load assistant models",
          );
        }
      } finally {
        if (!ignoreResult && isMountedReference.current) {
          setIsLoadingModels(false);
        }
      }
    };

    void loadModels();

    return () => {
      ignoreResult = true;
    };
  }, [conversation?.assistant_model, selectedApiKeyKey, showToast]);

  const handleModelChange = async (keys) => {
    const nextModel = [...keys][0] || "";
    if (!selectedApiKey || !nextModel) {
      return;
    }

    setSelectedModelKey(nextModel);
    setIsUpdatingApiKey(true);
    try {
      const data = await assignSenpaiApiKey(selectedApiKey.id, nextModel);
      if (!isMountedReference.current) {
        return;
      }

      setConversation(data.conversation);
      shouldFocusComposerReference.current = true;
      showToast("success", "Assistant model updated");
    } catch (error) {
      if (isMountedReference.current) {
        setSelectedModelKey(conversation?.assistant_model || "");
        showToast(
          "error",
          error.message || "Failed to update assistant model",
        );
      }
    } finally {
      if (isMountedReference.current) {
        setIsUpdatingApiKey(false);
      }
    }
  };

  const selectedApiKey = supportedApiKeys.find(
    (apiKey) => String(apiKey.id) === selectedApiKeyKey,
  );
  const hasPendingApproval = messages.some(
    (message) => message.role === "approval",
  );
  const hasPendingRequest =
    isBootstrapping ||
    isRefreshingThread ||
    isSending ||
    isUpdatingApiKey ||
    isLoadingModels;
  const isComposerDisabled =
    isBootstrapping ||
    isRefreshingThread ||
    isUpdatingApiKey ||
    hasPendingApproval ||
    !conversation;
  const isConversationLoaded = Boolean(conversation);
  const hasAssistantApiKey = Boolean(conversation?.assistant_api_key);
  const showApiKeySetup = isConversationLoaded && !hasAssistantApiKey;
  const canSubmitMessage =
    hasAssistantApiKey &&
    isConversationLoaded &&
    Boolean(draft.trim()) &&
    !hasPendingApproval &&
    !hasPendingRequest;
  let statusLabel = "Unavailable";
  let statusClassName = "text-danger";

  if (isConversationLoaded) {
    statusLabel = hasAssistantApiKey ? "Ready" : "No key";
    statusClassName = hasAssistantApiKey ? "text-success" : "text-warning";
  }

  const focusComposer = useCallback(() => {
    if (
      !hasAssistantApiKey ||
      hasPendingRequest ||
      hasPendingApproval ||
      isSettingsOpen ||
      !composerReference.current
    ) {
      return;
    }

    globalThis.requestAnimationFrame(() => {
      const textarea = composerReference.current?.querySelector("textarea");
      if (!textarea || textarea.disabled) {
        return;
      }

      shouldFocusComposerReference.current = false;
      textarea.focus();
      const caretPosition = textarea.value.length;
      textarea.setSelectionRange(caretPosition, caretPosition);
    });
  }, [
    hasAssistantApiKey,
    hasPendingApproval,
    hasPendingRequest,
    isSettingsOpen,
  ]);

  useEffect(() => {
    if (!shouldFocusComposerReference.current) {
      return;
    }

    focusComposer();
  }, [
    focusComposer,
    conversation?.thread_id,
    hasAssistantApiKey,
    hasPendingApproval,
    hasPendingRequest,
  ]);

  const appendAssistantResponse = useCallback(
    (data) => {
      setConversation(data.conversation);
      const nextMessages = [];

      if (data.response) {
        nextMessages.push({
          id: createMessageId("assistant"),
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
        });
      }

      for (const approval of data.pending_approvals || []) {
        nextMessages.push({
          id: createMessageId("approval"),
          role: "approval",
          approval,
          timestamp: new Date().toISOString(),
        });
      }

      if (nextMessages.length > 0) {
        setMessages((currentMessages) => [
          ...currentMessages.filter((message) => message.role !== "approval"),
          ...nextMessages,
        ]);
      }
    },
    [createMessageId],
  );

  const submitMessage = useCallback(
    async (messageText) => {
      const trimmedMessage = messageText.trim();
      const canStartRequest =
        trimmedMessage &&
        !hasPendingApproval &&
        !hasPendingRequest &&
        !sendMessageLock.current &&
        conversation;
      if (canStartRequest) {
        if (conversation.assistant_api_key) {
          sendMessageLock.current = true;
          const userMessage = {
            id: createMessageId("user"),
            role: "user",
            content: trimmedMessage,
            timestamp: new Date().toISOString(),
          };

          setDraft("");
          setIsSending(true);
          setMessages((currentMessages) => [...currentMessages, userMessage]);
          shouldFocusComposerReference.current = true;

          try {
            const data = await sendSenpaiMessage(
              trimmedMessage,
              getStoredActiveProjectId(),
            );
            if (!isMountedReference.current) {
              return;
            }

            appendAssistantResponse(data);
          } catch (error) {
            if (isMountedReference.current) {
              setMessages((currentMessages) =>
                currentMessages.filter(
                  (message) => message.id !== userMessage.id,
                ),
              );
              showToast(
                "error",
                error.message || "Senpai Assistant request failed",
              );
            }
          } finally {
            sendMessageLock.current = false;
            if (isMountedReference.current) {
              setIsSending(false);
            }
          }
          return;
        }

        setIsSettingsOpen(true);
        showToast(
          "error",
          "Select an OpenAI or Gemini API key before sending messages",
        );
        return;
      }
    },
    [
      appendAssistantResponse,
      conversation,
      createMessageId,
      hasPendingApproval,
      hasPendingRequest,
      showToast,
    ],
  );

  const resolveApproval = useCallback(
    async (decisionType) => {
      if (hasPendingRequest || sendMessageLock.current) {
        return;
      }

      sendMessageLock.current = true;
      setIsSending(true);
      shouldFocusComposerReference.current = true;

      try {
        const data = await resolveSenpaiApprovals([{ type: decisionType }]);
        if (!isMountedReference.current) {
          return;
        }

        setMessages((currentMessages) =>
          currentMessages.filter((message) => message.role !== "approval"),
        );
        appendAssistantResponse(data);
      } catch (error) {
        if (isMountedReference.current) {
          showToast(
            "error",
            error.message || "Failed to resolve Senpai approval",
          );
        }
      } finally {
        sendMessageLock.current = false;
        if (isMountedReference.current) {
          setIsSending(false);
        }
      }
    },
    [appendAssistantResponse, hasPendingRequest, showToast],
  );

  const handleComposerKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (canSubmitMessage) {
      void submitMessage(draft);
    }
  };

  const apiKeySelector = (
    <Select
      label="Assistant API key"
      selectedKeys={new Set([selectedApiKeyKey])}
      selectionMode="single"
      onSelectionChange={handleApiKeyChange}
      isDisabled={isUpdatingApiKey}
      variant="bordered"
      description="Choose the API key Senpai should use."
      renderValue={() =>
        selectedApiKey ? (
          <div className="flex items-center gap-2">
            <span>{selectedApiKey.name}</span>
            <span className="text-xs text-foreground/50 dark:text-foreground-dark/50">
              {selectedApiKey.provider}
            </span>
          </div>
        ) : (
          "No API key selected"
        )
      }
    >
      <SelectItem key="none" value="none">
        No API key selected
      </SelectItem>
      {supportedApiKeys.map((apiKey) => (
        <SelectItem key={String(apiKey.id)} value={String(apiKey.id)}>
          {apiKey.name} ({apiKey.provider})
        </SelectItem>
      ))}
    </Select>
  );

  const modelSelector = selectedApiKey ? (
    <Select
      label="Assistant model"
      selectedKeys={selectedModelKey ? new Set([selectedModelKey]) : new Set()}
      selectionMode="single"
      onSelectionChange={handleModelChange}
      isDisabled={
        isUpdatingApiKey || isLoadingModels || assistantModels.length === 0
      }
      isLoading={isLoadingModels}
      variant="bordered"
      description={
        modelSource === "fallback"
          ? "Using curated defaults because provider model lookup was unavailable."
          : "Choose one of the models available for this key."
      }
      renderValue={() => {
        const selectedModel = assistantModels.find(
          (model) => model.id === selectedModelKey,
        );
        return selectedModel ? selectedModel.name : selectedModelKey;
      }}
    >
      {assistantModels.map((model) => (
        <SelectItem key={model.id} value={model.id}>
          {model.name}
        </SelectItem>
      ))}
    </Select>
  ) : undefined;

  return (
    <>
      <div className="flex h-full min-h-0 flex-col bg-content2 dark:bg-[#18181b]">
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-divider px-3">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <Bot className="h-4 w-4 flex-shrink-0 text-primary" />
            <div className="min-w-0 flex-1 truncate text-sm">
              <span className="font-semibold">Senpai</span>
              <span className="mx-2 text-foreground/30">•</span>
              <span className={`text-xs ${statusClassName}`}>
                {statusLabel}
              </span>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => void loadConversation({ forceNew: true })}
              isDisabled={hasPendingRequest}
              aria-label="New conversation"
            >
              {isRefreshingThread ? (
                <Spinner color="current" size="sm" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => setIsSettingsOpen(true)}
              aria-label="Assistant settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            {!isMobile && onCollapse && (
              <Button
                isIconOnly
                variant="light"
                size="sm"
                onPress={onCollapse}
                isDisabled={hasPendingRequest}
                aria-label="Collapse Senpai Assistant"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {isMobile && onClose && (
              <Button
                isIconOnly
                variant="light"
                size="sm"
                onPress={onClose}
                isDisabled={hasPendingRequest}
                aria-label="Close Senpai Assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {isBootstrapping ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner color="primary" size="lg" />
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {hasAssistantApiKey ? (
                <>
                  <div className="relative min-h-0 flex-1">
                    <div
                      ref={messagesContainerReference}
                      onScroll={handleMessagesScroll}
                      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3"
                    >
                      {messages.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                          <Bot className="mb-3 h-8 w-8 text-primary/70" />
                          <p className="text-sm font-medium">
                            Start a conversation
                          </p>
                          <p className="mt-2 text-xs text-foreground/60 dark:text-foreground-dark/60">
                            This panel stays available across the app for quick
                            checks.
                          </p>
                        </div>
                      ) : (
                        messages.map((message) => {
                          const isAssistant = message.role === "assistant";

                          if (message.role === "approval") {
                            return (
                              <div
                                key={message.id}
                                className="flex min-w-0 justify-start"
                              >
                                <div className="min-w-0 max-w-[92%] overflow-hidden rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-foreground dark:text-foreground-dark">
                                  <div className="mb-1.5 flex items-center gap-2 text-[10px] opacity-80">
                                    <Settings className="h-3 w-3" />
                                    <span>
                                      {getApprovalTitle(message.approval)}
                                    </span>
                                    <span>
                                      {formatTimestamp(message.timestamp)}
                                    </span>
                                  </div>
                                  <p className="whitespace-pre-wrap text-sm leading-6">
                                    {getApprovalDescription(message.approval)}
                                  </p>
                                  <div className="mt-3 flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="flat"
                                      onPress={() =>
                                        void resolveApproval("reject")
                                      }
                                      isDisabled={hasPendingRequest}
                                    >
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      color="primary"
                                      onPress={() =>
                                        void resolveApproval("approve")
                                      }
                                      isDisabled={hasPendingRequest}
                                    >
                                      Approve
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={message.id}
                              className={`flex min-w-0 ${isAssistant ? "justify-start" : "justify-end"}`}
                            >
                              <div
                                className={`min-w-0 max-w-[92%] overflow-hidden rounded-2xl px-3 py-2.5 ${
                                  isAssistant
                                    ? "bg-default-100 text-foreground dark:bg-white/5 dark:text-foreground-dark"
                                    : "bg-primary text-primary-foreground"
                                }`}
                              >
                                <div className="mb-1.5 flex items-center gap-2 text-[10px] opacity-80">
                                  {isAssistant ? (
                                    <Bot className="h-3 w-3" />
                                  ) : (
                                    <User className="h-3 w-3" />
                                  )}
                                  <span>{isAssistant ? "Senpai" : "You"}</span>
                                  <span>
                                    {formatTimestamp(message.timestamp)}
                                  </span>
                                </div>
                                {isAssistant ? (
                                  <MarkdownMessage
                                    content={message.content}
                                    className="space-y-2"
                                  />
                                ) : (
                                  <p className="whitespace-pre-wrap text-sm leading-6">
                                    {message.content}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}

                      {isSending && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl bg-default-100 px-3 py-2.5 text-sm dark:bg-white/5">
                            <div className="flex items-center gap-2">
                              <Spinner size="sm" color="primary" />
                              Senpai is thinking...
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={endOfMessagesReference} />
                    </div>

                    {hasUnreadAssistantMessage && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3">
                        <Button
                          className="pointer-events-auto shadow-lg"
                          color="primary"
                          radius="full"
                          size="sm"
                          onPress={() => scrollToBottom()}
                        >
                          New message
                          <ChevronRight className="h-4 w-4 rotate-90" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 border-t border-divider bg-content1/60 px-3 py-3 dark:bg-black/10">
                    <div
                      ref={composerReference}
                      className="rounded-2xl border border-default-200 bg-content2 p-2 shadow-none dark:border-white/10 dark:bg-[#202024]"
                    >
                      <Textarea
                        placeholder="Ask Senpai..."
                        minRows={3}
                        maxRows={8}
                        variant="flat"
                        value={draft}
                        onValueChange={setDraft}
                        onKeyDown={handleComposerKeyDown}
                        isDisabled={isComposerDisabled}
                        classNames={{
                          inputWrapper:
                            "border-none bg-transparent shadow-none",
                        }}
                      />
                      <div className="mt-2 flex items-center justify-end">
                        <Button
                          isIconOnly
                          color="primary"
                          radius="full"
                          onPress={() => void submitMessage(draft)}
                          isLoading={isSending}
                          isDisabled={!canSubmitMessage}
                          aria-label="Send message"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : showApiKeySetup ? (
                <div className="flex flex-1 items-center justify-center px-4 py-6">
                  <div className="w-full max-w-sm rounded-3xl border border-default-200 bg-content1 p-5 shadow-sm dark:border-white/10 dark:bg-[#202024]">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <Settings className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          Select an API key
                        </p>
                        <p className="text-xs text-foreground/60 dark:text-foreground-dark/60">
                          Senpai needs an OpenAI or Gemini key before starting a
                          conversation.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      {apiKeySelector}
                      {modelSelector}
                    </div>

                    {supportedApiKeys.length === 0 && (
                      <p className="mt-3 text-sm text-warning">
                        No compatible API keys found. Add one in your profile
                        first.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center px-4 py-6">
                  <div className="w-full max-w-sm rounded-3xl border border-danger/20 bg-content1 p-5 shadow-sm dark:border-danger/20 dark:bg-[#202024]">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-danger/10 p-2 text-danger">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          Conversation unavailable
                        </p>
                        <p className="text-xs text-foreground/60 dark:text-foreground-dark/60">
                          Senpai could not load the current conversation. Try
                          reloading it.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button
                        color="primary"
                        onPress={() =>
                          void loadConversation({ showFullSpinner: true })
                        }
                        isDisabled={hasPendingRequest}
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        placement="center"
      >
        <ModalContent>
          {(onModalClose) => (
            <>
              <ModalHeader>Senpai Settings</ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  {apiKeySelector}
                  {modelSelector}
                </div>
                {supportedApiKeys.length === 0 && (
                  <p className="text-sm text-warning">
                    No compatible API keys found. Add one in your profile first.
                  </p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onModalClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

const SenpaiAssistantSidebar = () => {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [desktopWidth, setDesktopWidth] = useState(DEFAULT_DESKTOP_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const asideReference = useRef(undefined);
  const desktopWidthReference = useRef(DEFAULT_DESKTOP_WIDTH);
  const pendingDesktopWidthReference = useRef(DEFAULT_DESKTOP_WIDTH);
  const resizeFrameReference = useRef(0);

  useEffect(() => {
    setIsDesktopCollapsed(readDesktopSidebarCollapsed());
    const storedWidth = readDesktopSidebarWidth();
    setDesktopWidth(storedWidth);
    desktopWidthReference.current = storedWidth;
    pendingDesktopWidthReference.current = storedWidth;
  }, []);

  const toggleDesktopSidebar = () => {
    const nextValue = !isDesktopCollapsed;
    setIsDesktopCollapsed(nextValue);
    writeDesktopSidebarCollapsed(nextValue);
  };

  const updateDesktopWidth = useCallback((nextWidth) => {
    const clampedWidth = clampDesktopSidebarWidth(nextWidth);
    desktopWidthReference.current = clampedWidth;
    setDesktopWidth(clampedWidth);
    return clampedWidth;
  }, []);

  const handleResizeStart = useCallback((event) => {
    event.preventDefault();
    pendingDesktopWidthReference.current = desktopWidthReference.current;
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!asideReference.current || isDesktopCollapsed) {
      return;
    }

    asideReference.current.style.width = `${desktopWidth}px`;
  }, [desktopWidth, isDesktopCollapsed]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handlePointerMove = (event) => {
      pendingDesktopWidthReference.current = clampDesktopSidebarWidth(
        globalThis.innerWidth - event.clientX,
      );

      if (resizeFrameReference.current) {
        return;
      }

      resizeFrameReference.current = globalThis.requestAnimationFrame(() => {
        resizeFrameReference.current = 0;
        if (asideReference.current) {
          asideReference.current.style.width = `${pendingDesktopWidthReference.current}px`;
        }
      });
    };

    const handlePointerUp = () => {
      if (resizeFrameReference.current) {
        globalThis.cancelAnimationFrame(resizeFrameReference.current);
        resizeFrameReference.current = 0;
      }

      const clampedWidth = pendingDesktopWidthReference.current;
      desktopWidthReference.current = clampedWidth;
      setDesktopWidth(clampedWidth);
      writeDesktopSidebarWidth(clampedWidth);
      setIsResizing(false);
    };

    globalThis.addEventListener("pointermove", handlePointerMove);
    globalThis.addEventListener("pointerup", handlePointerUp);
    globalThis.document.body.style.userSelect = "none";
    globalThis.document.body.style.cursor = "col-resize";

    return () => {
      if (resizeFrameReference.current) {
        globalThis.cancelAnimationFrame(resizeFrameReference.current);
        resizeFrameReference.current = 0;
      }

      globalThis.removeEventListener("pointermove", handlePointerMove);
      globalThis.removeEventListener("pointerup", handlePointerUp);
      globalThis.document.body.style.userSelect = "";
      globalThis.document.body.style.cursor = "";
    };
  }, [isResizing, updateDesktopWidth]);

  useEffect(() => {
    const handleWindowResize = () => {
      const clampedWidth = updateDesktopWidth(desktopWidthReference.current);
      writeDesktopSidebarWidth(clampedWidth);
    };

    globalThis.addEventListener("resize", handleWindowResize);

    return () => {
      globalThis.removeEventListener("resize", handleWindowResize);
    };
  }, [updateDesktopWidth]);

  return (
    <>
      <aside
        ref={asideReference}
        className={`absolute inset-y-0 right-0 z-30 hidden overflow-hidden border-l border-divider bg-content2 shadow-2xl transition-[width,transform,opacity] duration-200 ease-out dark:bg-[#18181b] xl:flex ${
          isResizing ? "duration-0" : ""
        }`}
        style={{
          width: isDesktopCollapsed ? DESKTOP_COLLAPSED_WIDTH : desktopWidth,
        }}
      >
        {isDesktopCollapsed ? (
          <div className="flex h-full w-full flex-col">
            <div className="flex h-14 flex-shrink-0 items-center justify-center border-b border-divider">
              <Button
                isIconOnly
                variant="light"
                size="sm"
                onPress={toggleDesktopSidebar}
                aria-label="Expand Senpai Assistant"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 cursor-col-resize bg-transparent transition-colors hover:bg-primary/15"
              onPointerDown={handleResizeStart}
              aria-label="Resize Senpai Assistant"
            />
            <div className="min-h-0 flex-1 animate-in fade-in-0 slide-in-from-right-1 duration-200">
              <SenpaiAssistantPanel onCollapse={toggleDesktopSidebar} />
            </div>
          </>
        )}
      </aside>

      <div className="xl:hidden">
        <Button
          isIconOnly
          color="primary"
          radius="full"
          className="fixed bottom-6 right-6 z-40 h-14 w-14 shadow-lg"
          onPress={() => setIsMobileOpen(true)}
          aria-label="Open Senpai Assistant"
        >
          <PanelRightOpen className="h-5 w-5" />
        </Button>

        {isMobileOpen && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close Senpai Assistant"
            />
            <div className="absolute inset-y-0 right-0 w-full max-w-md border-l border-divider bg-content2 transition-transform duration-200 ease-out dark:bg-[#18181b]">
              <SenpaiAssistantPanel
                isMobile={true}
                onClose={() => setIsMobileOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SenpaiAssistantSidebar;
