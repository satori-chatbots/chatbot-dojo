import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { CodeBlock } from "./code-block";

// Constants
const SCROLL_SENSITIVITY_THRESHOLD = 5;

/**
 * Scrollable tabs component for displaying documentation sections
 * Supports optional filtering of sections
 */
export const ScrollableTabs = ({ sections, filterOutTabs = [] }) => {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeTab, setActiveTab] = useState(Object.keys(sections)[0]);
  const tabsContainerRef = useRef(null);

  const updateScrollButtons = useCallback(() => {
    if (tabsContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
      setCanScrollLeft(scrollLeft > SCROLL_SENSITIVITY_THRESHOLD);
      setCanScrollRight(
        scrollLeft < scrollWidth - clientWidth - SCROLL_SENSITIVITY_THRESHOLD,
      );
    }
  }, []);

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (container) {
      updateScrollButtons();
      container.addEventListener("scroll", updateScrollButtons);
      window.addEventListener("resize", updateScrollButtons);

      return () => {
        container.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", updateScrollButtons);
      };
    }
  }, [updateScrollButtons]);

  // Update scroll buttons when sections change
  useEffect(() => {
    setTimeout(updateScrollButtons, 100);
  }, [sections, updateScrollButtons]);

  const scrollTabs = useCallback((direction) => {
    if (tabsContainerRef.current) {
      const scrollAmount = 250; // Increased scroll amount for better UX
      const newScrollLeft =
        direction === "left"
          ? Math.max(0, tabsContainerRef.current.scrollLeft - scrollAmount)
          : Math.min(
              tabsContainerRef.current.scrollWidth -
                tabsContainerRef.current.clientWidth,
              tabsContainerRef.current.scrollLeft + scrollAmount,
            );

      tabsContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });
    }
  }, []);

  // Filter sections based on filterOutTabs prop
  const filteredSections = Object.fromEntries(
    Object.entries(sections).filter(([key]) => !filterOutTabs.includes(key)),
  );

  // Update activeTab if current one is filtered out
  useEffect(() => {
    if (
      !filteredSections[activeTab] &&
      Object.keys(filteredSections).length > 0
    ) {
      setActiveTab(Object.keys(filteredSections)[0]);
    }
  }, [filteredSections, activeTab]);

  return (
    <div className="w-full">
      {/* Tab navigation with scroll arrows */}
      <div className="relative mb-4">
        {/* Left gradient fade when scrollable */}
        {canScrollLeft && (
          <div className="absolute left-8 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-20 pointer-events-none" />
        )}

        {/* Right gradient fade when scrollable */}
        {canScrollRight && (
          <div className="absolute right-8 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-20 pointer-events-none" />
        )}

        {canScrollLeft && (
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-background/90 backdrop-blur-sm shadow-md border border-default-200 hover:bg-default-100"
            onPress={() => scrollTabs("left")}
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}

        {canScrollRight && (
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-background/90 backdrop-blur-sm shadow-md border border-default-200 hover:bg-default-100"
            onPress={() => scrollTabs("right")}
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        <div
          ref={tabsContainerRef}
          className="overflow-x-auto"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <div className="flex gap-1 border-b border-divider min-w-max">
            {Object.keys(filteredSections).map((sectionName) => (
              <button
                key={sectionName}
                className={`flex items-center space-x-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                  activeTab === sectionName
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-foreground-600 hover:text-foreground hover:border-default-300"
                }`}
                onClick={() => setActiveTab(sectionName)}
              >
                <BookOpen className="w-4 h-4" />
                <span>{sectionName}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {activeTab && filteredSections[activeTab] && (
          <div className="space-y-3">
            {filteredSections[activeTab].items.map((item, index) => (
              <CodeBlock
                key={index}
                code={item.code}
                description={item.description}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
