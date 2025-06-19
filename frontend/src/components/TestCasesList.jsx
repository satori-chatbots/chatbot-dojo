import React from "react";
import { MEDIA_URL } from "../api/config";

function TestCasesList({ testCases }) {
  const getFileName = (filePath) => {
    return filePath.split("/").pop();
  };

  return (
    <div>
      {/* Project Selector */}

      <h1>Test Cases</h1>
      {testCases.length > 0 ? (
        <ul>
          {testCases.map((testCase) => (
            <li key={testCase.id}>
              <p>
                <strong>Executed At:</strong>{" "}
                {new Date(testCase.executed_at).toLocaleString()}
              </p>
              <p>
                <strong>Execution Time:</strong> {testCase.execution_time}{" "}
                seconds
              </p>
              <p>
                <strong>User Profiles Used:</strong>
              </p>
              <ul>
                {testCase.copied_files && testCase.copied_files.length > 0 ? (
                  testCase.copied_files.map((fileObject, index) => (
                    <li key={`${fileObject.path}-${index}`}>
                      <a
                        href={`${MEDIA_URL}${fileObject.path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex-1 break-words max-w-sm md:max-w-lg lg:max-w-2xl"
                      >
                        {fileObject.name}
                      </a>
                    </li>
                  ))
                ) : (
                  <li>No files available.</li>
                )}
              </ul>
              <p style={{ whiteSpace: "pre-wrap" }}>
                <strong>Conversation:</strong> {testCase.result}
              </p>
              <br />
            </li>
          ))}
        </ul>
      ) : (
        <p>No test cases yet.</p>
      )}
    </div>
  );
}

export default TestCasesList;
