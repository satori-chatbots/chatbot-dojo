import React from "react";
import { Button } from "@heroui/react";
import { BookOpen, ChevronRight } from "lucide-react";
import { ScrollableTabs } from "./scrollable-tabs";

/**
 * Documentation sidebar component with collapsible functionality
 */
export const DocumentationSidebar = ({
  collapsed,
  onToggle,
  title = "Documentation",
  helpTitle = "User Profile Help",
  sections,
  filterOutTabs = [],
  children,
}) => {
  if (collapsed) {
    return;
  }

  return (
    <div className="w-96 transition-all duration-300">
      <div className="h-full flex flex-col border border-border bg-background rounded-lg">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">{title}</h2>
            </div>
            <Button
              variant="flat"
              size="sm"
              isIconOnly
              onPress={() => onToggle(true)}
              className="lg:hidden"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Documentation Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-foreground">
                {helpTitle}
              </h3>

              {sections && (
                <ScrollableTabs
                  sections={sections}
                  filterOutTabs={filterOutTabs}
                />
              )}

              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
