import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import React, { useEffect, useState } from 'react';
import { isBoolean } from 'vega';
import { ElaboratedUmweltSpec } from './grammar';
import './text/TreeStyle.css'
import * as JSONEditor from '@json-editor/json-editor';

interface EditorProps {
  spec: ElaboratedUmweltSpec
  onSpec: (spec: ElaboratedUmweltSpec) => void
}

const schema: JSONSchema7 = require('./grammar/schema/umwelt.schema.json');

const UmveltEditor = React.memo(({ spec, onSpec }: EditorProps) => {

  const [uwSpec, setUwSpec] = useState<ElaboratedUmweltSpec>();

  useEffect(() => {
    setUwSpec(spec);
  }, [spec])

  useEffect(() => {
    console.log(schema);
    var editor = new JSONEditor.JSONEditor(document.querySelector('.uw-editor'), {schema});
  })

  function renderSchemaDefinition(def: JSONSchema7Definition) {
    if (isBoolean(def)) {
      console.log('base case', def);
    }
    else {
      return (
        <ul>
          {
            def.required?.map(prop => {
              return (
                <li key={prop}>
                  {prop}
                  {renderSchemaDefinition(def.properties?.[prop])}
                </li>
              )
            })
          }
        </ul>
      )
    }

  }

  function renderEditor() {
    return renderSchemaDefinition(schema);
  }

  // function renderData(predNode) {
  //   return (
  //     <ul role="group">
  //       {
  //         selectionTest(data, {predicate: predNode.predicate}, fields).map(datum => {
  //           return <li role="treeitem" aria-expanded="false">{JSON.stringify(datum)}</li>
  //         })
  //       }
  //     </ul>
  //   )
  // }

  return (
    <div>
      <div className='uw-editor'>
        {/* {renderEditor()} */}
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