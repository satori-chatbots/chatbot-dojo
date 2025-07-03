import React, { useState, useEffect, useRef } from "react";
import {
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  Card,
  CardBody,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import {
  BarChart3,
  ArrowLeft,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Download,
  ChevronDown,
} from "lucide-react";
import { fetchTracerWorkflowGraph } from "../api/file-api";
import { useMyCustomToast } from "../contexts/my-custom-toast-context";

const InlineGraphViewer = ({ execution, onClose }) => {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const { showToast } = useMyCustomToast();

  const panContainerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Zoom configuration
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 0.25;

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
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleMouseDown = (e) => {
    if (panContainerRef.current) {
      e.preventDefault();
      panContainerRef.current.style.cursor = "grabbing";
      panContainerRef.current.style.userSelect = "none";
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        scrollLeft: panContainerRef.current.scrollLeft,
        scrollTop: panContainerRef.current.scrollTop,
      });
      setIsPanning(true);
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning && panContainerRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      panContainerRef.current.scrollTop = panStart.scrollTop - dy;
      panContainerRef.current.scrollLeft = panStart.scrollLeft - dx;
    }
  };

  const handleMouseUpOrLeave = () => {
    if (isPanning && panContainerRef.current) {
      panContainerRef.current.style.cursor = "grab";
      panContainerRef.current.style.removeProperty("user-select");
      setIsPanning(false);
    }
  };

  // Allow Ctrl + mouse wheel to zoom
  const handleWheelZoom = (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
      if (event.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    }
  };

  const handleDownload = async (format) => {
    try {
      const targetFormat = format || graphData?.file_type;
      if (!targetFormat) {
        showToast("No format available for download", "error");
        return;
      }

      // We always fetch for download to get the blob
      const blob = await fetchTracerWorkflowGraph(execution.id, targetFormat);

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${execution.execution_name}_workflow_graph.${targetFormat}`;
      document.body.appendChild(link);
      link.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      showToast(`Download started (${targetFormat.toUpperCase()})`, "success");
    } catch (error) {
      console.error("Error downloading graph:", error);
      showToast("Failed to download graph", "error");
    }
  };

  // Process SVG content to ensure it's properly sized and styled
  const processSvgContent = (svgContent) => {
    // Add styling to make SVG responsive and properly colored
    let processedSvg = svgContent
      .replace(/<svg/, '<svg class="max-w-full h-auto"')
      .replace(/fill="black"/g, 'fill="currentColor"')
      .replace(/stroke="black"/g, 'stroke="currentColor"');

    // If the SVG doesn't have proper viewBox, try to extract dimensions and add it
    if (!processedSvg.includes("viewBox")) {
      const widthMatch = processedSvg.match(/width="(\d+)"/);
      const heightMatch = processedSvg.match(/height="(\d+)"/);
      if (widthMatch && heightMatch) {
        const width = widthMatch[1];
        const height = heightMatch[1];
        processedSvg = processedSvg.replace(
          /<svg/,
          `<svg viewBox="0 0 ${width} ${height}"`,
        );
      }
    }

    return processedSvg;
  };

  const isPdf = graphData?.file_type === "pdf";
  const isSvg = graphData?.file_type === "svg";
  const isPng = graphData?.file_type === "png";
  const availableFormats = graphData?.available_formats || [];

  return (
    <>
      <ModalHeader className="flex flex-col gap-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary-50 dark:bg-secondary-900/20">
              <BarChart3 className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">TRACER Workflow Graph</h2>
              <p className="text-sm text-default-500">
                {execution.execution_name} -{" "}
                {graphData?.project_name || execution.project_name}
              </p>
              {graphData && (
                <p className="text-xs text-default-400">
                  Format: {graphData.file_type?.toUpperCase()}
                  {availableFormats.length > 1 &&
                    ` (${availableFormats.map((f) => f.toUpperCase()).join(", ")} available)`}
                </p>
              )}
            </div>
          </div>

          {/* Controls */}
          {graphData && !loading && !error && (
            <div className="flex items-center gap-2">
              {/* Download Dropdown - Available for all formats */}
              {availableFormats.length > 1 ? (
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      size="sm"
                      variant="light"
                      endContent={<ChevronDown className="w-4 h-4" />}
                      startContent={<Download className="w-4 h-4" />}
                    >
                      Download
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Download formats">
                    {availableFormats.map((format) => (
                      <DropdownItem
                        key={format}
                        startContent={<Download className="w-4 h-4" />}
                        onPress={() => handleDownload(format)}
                      >
                        Download as {format.toUpperCase()}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              ) : (
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => handleDownload()}
                  startContent={<Download className="w-4 h-4" />}
                >
                  Download
                </Button>
              )}

              {/* Zoom Controls - Only for SVG and PNG */}
              {(isSvg || isPng) && (
                <>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={handleZoomOut}
                    isDisabled={zoom <= MIN_ZOOM}
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-default-500 min-w-[4rem] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  {/* Zoom slider */}
                  <input
                    type="range"
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={ZOOM_STEP}
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-[100px] sm:w-[150px] cursor-pointer accent-secondary"
                    aria-label="Zoom slider"
                  />
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={handleZoomIn}
                    isDisabled={zoom >= MAX_ZOOM}
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </>
              )}
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
                {/* PDF Display */}
                {isPdf && (
                  <div className="space-y-4">
                    <div
                      className="bg-default-100 dark:bg-default-800 rounded-lg"
                      style={{ height: "600px" }}
                    >
                      <iframe
                        src={graphData.file_url}
                        className="w-full h-full rounded-lg"
                        title="TRACER Workflow Graph"
                        style={{ border: "none" }}
                      />
                    </div>
                  </div>
                )}

                {/* SVG Display */}
                {isSvg && (
                  <div
                    ref={panContainerRef}
                    className="overflow-auto min-h-[40vh] md:min-h-[50vh] cursor-grab"
                    onWheel={handleWheelZoom}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseLeave={handleMouseUpOrLeave}
                  >
                    <div
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <div
                        className="text-foreground"
                        dangerouslySetInnerHTML={{
                          __html: processSvgContent(graphData.graph_content),
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* PNG Display */}
                {isPng && (
                  <div
                    ref={panContainerRef}
                    className="overflow-auto min-h-[40vh] md:min-h-[50vh] cursor-grab"
                    onWheel={handleWheelZoom}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseLeave={handleMouseUpOrLeave}
                  >
                    <div
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <img
                        src={graphData.file_url}
                        alt="TRACER Workflow Graph"
                        className="rounded-lg"
                        style={{
                          maxHeight: "800px",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Graph Info */}
                <div className="mt-4 pt-4 border-t border-default-200">
                  <p className="text-sm text-default-500">
                    This workflow graph shows the conversation paths and
                    decision points discovered during the TRACER exploration of
                    your chatbot.
                    {isPdf && " The graph is displayed as a PDF document."}
                    {isSvg && " You can zoom in/out to explore the details."}
                    {isPng && " You can zoom in/out to explore the details."}
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
