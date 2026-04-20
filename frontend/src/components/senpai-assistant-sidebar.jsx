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
import { getUserApiKeys } from "../api/authentication-api";
import {
  assignSenpaiApiKey,
  initializeSenpaiConversation,
  sendSenpaiMessage,
} from "../api/senpai-api";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

const buildThreadStorageKey = (threadId) => `senpai-thread-history:${threadId}`;
const DESKTOP_COLLAPSED_KEY = "senpai-sidebar-collapsed";
const MESSAGE_ROLES = new Set(["assistant", "user"]);

const isValidStoredThreadMessage = (message) => {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return false;
  }

  if (
    typeof message.id !== "string" ||
    !MESSAGE_ROLES.has(message.role) ||
    typeof message.content !== "string" ||
    typeof message.timestamp !== "string"
  ) {
    return false;
  }

  return !Number.isNaN(Date.parse(message.timestamp));
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

const formatTimestamp = (value) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));

const SenpaiAssistantPanel = ({ onClose, isMobile = false, onCollapse }) => {
  const { showToast } = useMyCustomToast();
  const endOfMessagesReference = useRef(undefined);

  const [conversation, setConversation] = useState();
  const [apiKeys, setApiKeys] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshingThread, setIsRefreshingThread] = useState(false);
  const [isUpdatingApiKey, setIsUpdatingApiKey] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedApiKeyKey, setSelectedApiKeyKey] = useState("none");

  const supportedApiKeys = useMemo(
    () =>
      apiKeys.filter((apiKey) =>
        ["openai", "gemini"].includes(apiKey.provider),
      ),
    [apiKeys],
  );

  useEffect(() => {
    setSelectedApiKeyKey(
      conversation?.assistant_api_key?.id
        ? String(conversation.assistant_api_key.id)
        : "none",
    );
  }, [conversation?.assistant_api_key?.id]);

  const loadConversation = useCallback(
    async ({ forceNew = false, showFullSpinner = false } = {}) => {
      const setLoadingState = showFullSpinner
        ? setIsBootstrapping
        : setIsRefreshingThread;

      setLoadingState(true);
      try {
        const data = await initializeSenpaiConversation(forceNew);
        setConversation(data.conversation);
        if (forceNew) {
          setDraft("");
          setMessages([]);
          showToast("success", "New Senpai conversation started");
        }
      } catch (error) {
        showToast(
          "error",
          error.message || "Failed to initialize Senpai Assistant",
        );
      } finally {
        setLoadingState(false);
      }
    },
    [showToast],
  );

  const loadApiKeys = useCallback(async () => {
    try {
      const data = await getUserApiKeys();
      setApiKeys(data);
    } catch {
      showToast("error", "Failed to load available API keys");
    }
  }, [showToast]);

  useEffect(() => {
    void Promise.all([
      loadConversation({ showFullSpinner: true }),
      loadApiKeys(),
    ]);
  }, [loadConversation, loadApiKeys]);

  useEffect(() => {
    setMessages(readStoredThreadMessages(conversation?.thread_id));
  }, [conversation?.thread_id]);

  useEffect(() => {
    if (conversation?.thread_id) {
      writeStoredThreadMessages(conversation.thread_id, messages);
    }
  }, [conversation?.thread_id, messages]);

  useEffect(() => {
    endOfMessagesReference.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleApiKeyChange = async (keys) => {
    const nextValue = [...keys][0] || "none";
    const apiKeyId = nextValue === "none" ? undefined : Number(nextValue);

    setSelectedApiKeyKey(String(nextValue));
    setIsUpdatingApiKey(true);
    try {
      const data = await assignSenpaiApiKey(apiKeyId);
      setConversation(data.conversation);
      showToast("success", "Assistant API key updated");
    } catch (error) {
      setSelectedApiKeyKey(
        conversation?.assistant_api_key?.id
          ? String(conversation.assistant_api_key.id)
          : "none",
      );
      showToast("error", error.message || "Failed to update assistant API key");
    } finally {
      setIsUpdatingApiKey(false);
    }
  };

  const selectedApiKey = supportedApiKeys.find(
    (apiKey) => String(apiKey.id) === selectedApiKeyKey,
  );

  const submitMessage = useCallback(
    async (messageText) => {
      const trimmedMessage = messageText.trim();
      if (!trimmedMessage || isSending) {
        return;
      }

      if (!conversation?.assistant_api_key) {
        setIsSettingsOpen(true);
        showToast(
          "error",
          "Select an OpenAI or Gemini API key before sending messages",
        );
        return;
      }

      const userMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        content: trimmedMessage,
        timestamp: new Date().toISOString(),
      };

      setDraft("");
      setIsSending(true);
      setMessages((currentMessages) => [...currentMessages, userMessage]);

      try {
        const data = await sendSenpaiMessage(trimmedMessage);
        setConversation(data.conversation);
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `${Date.now()}-assistant`,
            role: "assistant",
            content: data.response,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (error) {
        setMessages((currentMessages) =>
          currentMessages.filter((message) => message.id !== userMessage.id),
        );
        showToast("error", error.message || "Senpai Assistant request failed");
      } finally {
        setIsSending(false);
      }
    },
    [conversation?.assistant_api_key, isSending, showToast],
  );

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(draft);
    }
  };

  return (
    <>
      <div className="flex h-full min-h-0 flex-col bg-content2 dark:bg-[#18181b]">
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-divider px-3">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <Bot className="h-4 w-4 flex-shrink-0 text-primary" />
            <div className="min-w-0 truncate text-sm">
              <span className="font-semibold">Senpai</span>
              <span className="mx-2 text-foreground/30">•</span>
              <span
                className={`text-xs ${
                  conversation?.assistant_api_key
                    ? "text-success"
                    : "text-warning"
                }`}
              >
                {conversation?.assistant_api_key ? "Ready" : "No key"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => void loadConversation({ forceNew: true })}
              isDisabled={isRefreshingThread || isSending}
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
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                    <Bot className="mb-3 h-8 w-8 text-primary/70" />
                    <p className="text-sm font-medium">Start a conversation</p>
                    <p className="mt-2 text-xs text-foreground/60 dark:text-foreground-dark/60">
                      This panel stays available across the app for quick
                      checks.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isAssistant = message.role === "assistant";

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[92%] rounded-2xl px-3 py-2.5 ${
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
                            <span>{formatTimestamp(message.timestamp)}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-6">
                            {message.content}
                          </p>
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

              <div className="flex-shrink-0 border-t border-divider bg-content1/60 px-3 py-3 dark:bg-black/10">
                <div className="rounded-2xl border border-default-200 bg-content2 p-2 shadow-none dark:border-white/10 dark:bg-[#202024]">
                  <Textarea
                    placeholder="Ask Senpai..."
                    minRows={3}
                    maxRows={8}
                    variant="flat"
                    value={draft}
                    onValueChange={setDraft}
                    onKeyDown={handleComposerKeyDown}
                    isDisabled={isSending}
                    classNames={{
                      inputWrapper: "border-none bg-transparent shadow-none",
                    }}
                  />
                  <div className="mt-2 flex items-center justify-end">
                    <Button
                      isIconOnly
                      color="primary"
                      radius="full"
                      onPress={() => void submitMessage(draft)}
                      isLoading={isSending}
                      isDisabled={!draft.trim() || isSending}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
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
                    <SelectItem
                      key={String(apiKey.id)}
                      value={String(apiKey.id)}
                    >
                      {apiKey.name} ({apiKey.provider})
                    </SelectItem>
                  ))}
                </Select>
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

  useEffect(() => {
    setIsDesktopCollapsed(
      globalThis.localStorage.getItem(DESKTOP_COLLAPSED_KEY) === "true",
    );
  }, []);

  const toggleDesktopSidebar = () => {
    const nextValue = !isDesktopCollapsed;
    setIsDesktopCollapsed(nextValue);
    globalThis.localStorage.setItem(DESKTOP_COLLAPSED_KEY, String(nextValue));
  };

  return (
    <>
      <aside
        className={`absolute inset-y-0 right-0 z-30 hidden overflow-hidden border-l border-divider bg-content2 shadow-2xl transition-[width,transform,opacity] duration-200 ease-out dark:bg-[#18181b] xl:flex ${
          isDesktopCollapsed ? "xl:w-14" : "xl:w-[420px]"
        }`}
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
          <div className="min-h-0 flex-1 animate-in fade-in-0 slide-in-from-right-1 duration-200">
            <SenpaiAssistantPanel onCollapse={toggleDesktopSidebar} />
          </div>
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
