import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UmweltSpec } from './grammar';
import './text/TreeStyle.css'
import * as JSONEditor from '@json-editor/json-editor';
import { uiSchema } from './grammar/schema/uiSchema';

interface EditorProps {
  spec: UmweltSpec
  onSpec: (spec: UmweltSpec) => void
}

const UmveltEditor = React.memo(({ spec, onSpec }: EditorProps) => {

  const editor = useRef<any>();
  const setEditor = data => {
    editor.current = data;
  };

  const onChange = useCallback(() => {
    // onSpec(editor.current.getValue());
  }, [])

  useEffect(() => {
    if (editor.current) {
      editor.current.off('change', onChange);
      editor.current.destroy();
    }
    console.log(uiSchema)
    const container = document.querySelector('.uw-editor');
    container.replaceChildren();
    const e = new JSONEditor.JSONEditor(container, {
      schema: uiSchema,
      // display_required_only: true,
      show_opt_in: true,
      use_default_values: false,
      array_controls_top: true,
      startval: spec
    });
    e.on('change', onChange);

    setEditor(e);
  }, [spec]);

  return (
    <div>
      <div className='uw-editor'>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.spec === nextProps.spec
});

export default UmveltEditor;



/*
<script>
      // Initialize the editor with a JSON schema
      var editor = new JSONEditor(document.getElementById('editor_holder'),{
        schema: {
          type: "object",
          title: "Car",
          properties: {
            make: {
              type: "string",
              enum: [
                "Toyota",
                "BMW",
                "Honda",
                "Ford",
                "Chevy",
                "VW"
              ]
            },
            model: {
              type: "string"
            },
            year: {
              type: "integer",
              enum: [
                1995,1996,1997,1998,1999,
                2000,2001,2002,2003,2004,
                2005,2006,2007,2008,2009,
                2010,2011,2012,2013,2014
              ],
              default: 2008
            },
            safety: {
              type: "integer",
              format: "rating",
              maximum: "5",
              exclusiveMaximum: false,
              readonly: false
            }
          }
        }
      });

      // Hook up the submit button to log to the console
      document.getElementById('submit').addEventListener('click',function() {
        // Get the value from the editor
        console.log(editor.getValue());
      });
    </script>
*/