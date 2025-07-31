import React, { useState, useCallback } from "react";
import { Button, Card, CardBody, Tooltip } from "@heroui/react";
import { Copy, Check } from "lucide-react";
import { highlightYamlCode } from "../../utils/yaml-highlighter";

/**
 * Code block component with syntax highlighting and copy functionality
 * Used in documentation sections to display YAML examples
 */
export const CodeBlock = ({ code, description }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [code]);

  return (
    <Card className="border border-border">
      <CardBody className="p-3">
        <div className="relative group">
          <pre className="text-xs bg-content2 p-3 rounded overflow-x-auto mb-2 border border-default-200">
            <code
              className="font-modern-mono"
              dangerouslySetInnerHTML={{
                __html: highlightYamlCode(code),
              }}
            />
          </pre>

          <Tooltip content={copied ? "Copied!" : "Copy code"}>
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              onPress={handleCopy}
              aria-label="Copy code"
            >
              {copied ? (
                <Check className="w-3 h-3 text-success" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </Tooltip>
        </div>

        <p className="text-xs text-foreground-600">{description}</p>
      </CardBody>
    </Card>
  );
};
