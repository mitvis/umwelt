import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import React, { useEffect, useRef, useState } from 'react';
import { isBoolean } from 'vega';
import { ElaboratedUmweltSpec } from './grammar';
import './text/TreeStyle.css'
import * as JSONEditor from '@json-editor/json-editor';
import { enhancedSchema } from './grammar/schema/enhancedSchema';

interface EditorProps {
  spec: ElaboratedUmweltSpec
  onSpec: (spec: ElaboratedUmweltSpec) => void
}

const UmveltEditor = React.memo(({ spec, onSpec }: EditorProps) => {

  const editor = useRef<any>();
  const setEditor = data => {
    editor.current = data;
  };

  useEffect(() => {
    if (editor.current) {
      editor.current.destroy();
    }
    console.log(enhancedSchema)
    const container = document.querySelector('.uw-editor');
    container.replaceChildren();
    const e = new JSONEditor.JSONEditor(container, {
      schema: enhancedSchema,
      // display_required_only: true,
      show_opt_in: true,
      use_default_values: false,
      startval: spec
    });
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