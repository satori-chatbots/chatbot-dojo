import React, { useState, useEffect } from "react";
import {
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  Card,
  CardBody,
} from "@heroui/react";
import { BarChart3, ArrowLeft, AlertCircle, ZoomIn, ZoomOut } from "lucide-react";
import { fetchTracerWorkflowGraph } from "../api/file-api";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

const InlineGraphViewer = ({ execution, onClose }) => {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const { showToast } = useMyCustomToast();

  useEffect(() => {
    loadGraph();
  }, [execution.id]);

  const loadGraph = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTracerWorkflowGraph(execution.id);
      setGraphData(data);
    } catch (error) {
      console.error("Error loading TRACER graph:", error);
      setError("Failed to load the workflow graph");
      showToast("Failed to load workflow graph", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  // Process SVG content to ensure it's properly sized and styled
  const processSvgContent = (svgContent) => {
    // Add styling to make SVG responsive and properly colored
    let processedSvg = svgContent
      .replace(/<svg/, '<svg class="max-w-full h-auto"')
      .replace(/fill="black"/g, 'fill="currentColor"')
      .replace(/stroke="black"/g, 'stroke="currentColor"');

    // If the SVG doesn't have proper viewBox, try to extract dimensions and add it
    if (!processedSvg.includes('viewBox')) {
      const widthMatch = processedSvg.match(/width="(\d+)"/);
      const heightMatch = processedSvg.match(/height="(\d+)"/);
      if (widthMatch && heightMatch) {
        const width = widthMatch[1];
        const height = heightMatch[1];
        processedSvg = processedSvg.replace(
          /<svg/,
          `<svg viewBox="0 0 ${width} ${height}"`
        );
      }
    }

    return processedSvg;
  };

  return (
    <>
      <ModalHeader className="flex flex-col gap-1">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary-50 dark:bg-secondary-900/20">
              <BarChart3 className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">TRACER Workflow Graph</h2>
              <p className="text-sm text-default-500">
                {execution.execution_name} - {graphData?.project_name || execution.project_name}
              </p>
            </div>
          </div>

          {/* Zoom Controls */}
          {graphData && !loading && !error && (
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleZoomOut}
                isDisabled={zoom <= 0.25}
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-default-500 min-w-[4rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleZoomIn}
                isDisabled={zoom >= 3}
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="light"
                onPress={handleResetZoom}
                className="text-xs"
              >
                Reset
              </Button>
            </div>
          )}
        </div>
      </ModalHeader>

      <ModalBody>
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner size="lg" />
            <p className="text-default-500">Loading workflow graph...</p>
          </div>
        )}

        {error && (
          <Card className="border-danger-200 bg-danger-50 dark:bg-danger-900/20">
            <CardBody className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-danger mb-2">
                Failed to Load Graph
              </h3>
              <p className="text-danger-600 dark:text-danger-400 mb-4">
                {error}
              </p>
              <Button
                color="danger"
                variant="light"
                onPress={loadGraph}
                size="sm"
              >
                Try Again
              </Button>
            </CardBody>
          </Card>
        )}

        {graphData && !loading && !error && (
          <div className="space-y-4">
            <Card className="border-default-200">
              <CardBody className="p-6">
                <div
                  className="flex justify-center items-center min-h-[400px] overflow-auto"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                >
                  <div
                    className="text-foreground"
                    dangerouslySetInnerHTML={{
                      __html: processSvgContent(graphData.graph_content)
                    }}
                  />
                </div>

                {/* Graph Info */}
                <div className="mt-4 pt-4 border-t border-default-200">
                  <p className="text-sm text-default-500">
                    This workflow graph shows the conversation paths and decision points
                    discovered during the TRACER exploration of your chatbot.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          color="secondary"
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

export default InlineGraphViewer;
