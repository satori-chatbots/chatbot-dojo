import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { fetchFile } from '../api/fileApi';



function YamlEditor() {
    const { fileId } = useParams();
    const [content, setContent] = useState('');
    const [value, setValue] = useState("test_name: \"pizza_order_test_custom\"");


    useEffect(() => {
        if (fileId) {
            fetchFile(fileId)
                .then(response => setValue(response.yamlContent))
                .catch(err => console.error('Error fetching file:', err));
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
        <div className="flex flex-col
        items-center justify-center
        p-6
        w-full
        ">
            <h1>{fileId ? 'Edit YAML File' : 'Create New YAML'}</h1>
            <CodeMirror height="80vh" width="80vw" value={value} onChange={setValue} extensions={[yaml()]} />
            <button onClick={handleSave}>
                {fileId ? 'Update' : 'Create'} YAML
            </button>
        </div>
    );
}

export default YamlEditor;
