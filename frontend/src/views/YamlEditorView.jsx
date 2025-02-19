import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';



function YamlEditor() {
    const { fileId } = useParams();
    const [content, setContent] = useState('');
    const [value, setValue] = React.useState("test_name: \"pizza_order_test_custom\"");


    useEffect(() => {
        if (fileId) {
            // If fileId exists, fetch the file and load its content
            // e.g. fetchFile(fileId).then(response => setContent(response.yamlContent));
        }
    }, [fileId]);

    const handleSave = async () => {
        if (fileId) {
            // Update existing file
            // e.g. updateFile(fileId, { content });
        } else {
            // Create a new file
            // e.g. createFile({ content });
        }
    };

    return (
        <div>
            <h1>{fileId ? 'Edit YAML File' : 'Create New YAML'}</h1>
            <CodeMirror height="80vh" value={value} onChange={setValue} extensions={[yaml()]} />
            <button onClick={handleSave}>
                {fileId ? 'Update' : 'Create'} YAML
            </button>
        </div>
    );
}

export default YamlEditor;
