import React from "react";
import { Terminal } from "lucide-react";

const TerminalOutput = ({ title, content, variant = "output" }) => {
  const lines = React.useMemo(
    () => (content ? content.split("\n") : []),
    [content],
  );

  if (!content || content.trim() === "") {
    return (
      <div className="text-center py-8 text-default-500">
        <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No {variant} available</p>
      </div>
    );
  }

  const isError = variant === "error";
  const consoleStyle = isError
    ? "bg-gray-900 border-red-500/30"
    : "bg-gray-900 border-green-500/30";
  const textStyle = isError ? "text-red-400" : "text-green-400";

  return (
    <div className={`${consoleStyle} rounded-lg border-2 overflow-hidden`}>
      {/* Console header */}
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-gray-400" />
        <span className="text-gray-300 text-sm font-medium">{title}</span>
        <div className="flex gap-1 ml-auto">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
      </div>

      {/* Console content */}
      <div className="p-4 overflow-auto max-h-96">
        <div className={`${textStyle} text-sm font-mono leading-relaxed`}>
          {lines.map((line, index) => (
            <div key={index} className="flex">
              <span className="text-gray-500 select-none mr-4 text-xs w-10 text-right">
                {String(index + 1).padStart(3, " ")}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-words">
                {line}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TerminalOutput;
