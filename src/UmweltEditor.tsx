import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AudioPropName, AudioUnitSpec, ElaboratedUmweltDataSource, EncodingPropName, FieldDef, UmweltSpec, ViewComposition, VisualPropName, VisualUnitSpec } from './grammar';
import './text/TreeStyle.css'
import { OlliDataset } from 'olli';
import { getData } from './utils/data';
import { elaborateFields } from './grammar/elaborate';
import { debounce } from 'vega';

interface EditorProps {
  initialSpec: any
  onSpec?: (spec: UmweltSpec) => void
}

const UmveltEditor = React.memo(({ initialSpec, onSpec }: EditorProps) => {

  const [dataUrl, setDataUrl] = useState<string>(initialSpec?.data?.url);
  const [data, setData] = useState<OlliDataset>();
  const [fields, _setFields] = useState<FieldDef[]>([]);
  const setFields = (fields) => {
    _setFields(fields.map(field => {
      if (!field.encodings) {
        field.encodings = [];
      }
      return field;
    }));
  }
  const [visualUnitSpecs, setVisualUnitSpecs] = useState<VisualUnitSpec[]>([]);
  // const [viewComposition, setViewComposition] = useState<ViewComposition>();
  const [audioUnitSpecs, setAudioUnitSpecs] = useState<AudioUnitSpec[]>([]);

  const onData = debounce(500, () => {
    const value = (document.querySelector('.input-data') as HTMLInputElement).value;
    if (value) {
      setDataUrl(value);
    }
  })

  useEffect(() => {
    getData({url: dataUrl}).then(data => {
      if (data && data.length) {
        setData(data);
      }
    });
  }, [dataUrl]);

  useEffect(() => {
    if (data && data.length > 0) {
      if (fields.length === 0) {
        const allFields = Object.keys(data[0]).map(name => {
          return {
            name
          }
        })
        const elaboratedFields = elaborateFields(allFields, data);
        setFields(elaboratedFields);
      }

      if (fields.some(field => !field.type)) {
        const elaboratedFields = elaborateFields(fields, data);
        setFields(elaboratedFields);
      }

      if (visualUnitSpecs.length === 0) {
        setVisualUnitSpecs([{
          name: 'unit_0',
          mark: 'point',
          encoding: {
          }
        }]);
      }
    }
  }, [data]);

  const addEncoding = (field: FieldDef) => {
    const domId = `${field.name}-encoding-select`;
    const value = (document.getElementById(domId) as HTMLInputElement).value;
    const newFields = fields.map(f => {
      if (f.name === field.name) {
        f.encodings.push({
          property: (value as EncodingPropName)
        });
      }
      return f;
    });
    setFields(newFields);

    const unit = visualUnitSpecs[0];
    const newEncoding = structuredClone(unit.encoding);
    if (newEncoding[value] && newEncoding[value].field !== field.name) {
      const newFields = fields.map(f => {
        if (f.name === newEncoding[value].field) {
          f.encodings = f.encodings.filter(e => e.property !== value);
        }
        return f;
      });
      setFields(newFields);
    }
    newEncoding[value] = {
      field: field.name,
    };
    const newVisualUnitSpecs = visualUnitSpecs.map(spec => {
      if (spec.name === unit.name) {
        spec.encoding = newEncoding;
      }
      return spec;
    });
    setVisualUnitSpecs(newVisualUnitSpecs);
  }

  const mtypes = ['quantitative', 'nominal', 'ordinal', 'temporal'];
  const visualPropNames: VisualPropName[] = ['x', 'y', 'color', 'shape', 'opacity'];
  const audioPropNames: AudioPropName[] = ['pitch', 'duration', 'volume'];
  const propertyNames: EncodingPropName[] = (visualPropNames as EncodingPropName[]).concat(audioPropNames);
  const markTypes = ['point', 'line', 'bar'];

  return (
    <div>
      <h3>Data</h3>
      <input type="url" className="input-data" value={dataUrl} onChange={onData} required></input>
      <h3>Fields</h3>
      {
        fields.map(field => {
          return (
            <div className='field-def' key={field.name}>
              <h5 className='def-name'>{field.name}</h5>
              <div className='def-property'>
                <div className='def-property-label'>Type:</div>
                <div className='def-property-col'>
                  <select value={field.type}>
                    {
                      mtypes.map(mtype => {
                        return (
                          <option value={mtype}>{mtype}</option>
                        )
                      })
                    }
                  </select>
                </div>
              </div>
              <div className='def-property'>
                <div className='def-property-label'>Encodings:</div>
                <div className='def-property-col'>
                  {
                    field.encodings?.map(encodingRef => {
                      return (
                        <div className='field-def-encoding-ref'>
                          <span>{encodingRef.property}</span>
                          <button>Go to full definition</button>
                        </div>
                      )
                    })
                  }
                  <div>
                    <div className='def-property-add'>Add encoding:</div>
                    <select id={`${field.name}-encoding-select`}>
                      {
                        propertyNames.filter(x => !((field.encodings?.map(e => e.property) || []).includes(x))).map(propName => {
                          return (
                            <option value={propName}>{propName}</option>
                          )
                        })
                      }
                    </select>
                    {/* <select>
                      {
                        visualUnitSpecs.map(visualUnitSpec => {
                          return (
                            <option value={visualUnitSpec.name}>{visualUnitSpec.name}</option>
                          )
                        })
                      }
                    </select>
                    <select>
                      {
                        audioUnitSpecs.map(audioUnitSpec => {
                          return (
                            <option value={audioUnitSpec.name}>{audioUnitSpec.name}</option>
                          )
                        })
                      }
                    </select> */}
                    <button onClick={() => addEncoding(field)}>Add</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      }
    <h3>Visual</h3>
    {
      visualUnitSpecs.map((visualUnitSpec) => {
        return (
          <div className='visual-unit-spec'>
            <h5 className='def-name'>{visualUnitSpec.name}</h5>
            <div className='def-property'>
              <div className='def-property-label'>Mark:</div>
              <div className='def-property-col'>
                <select value={visualUnitSpec.mark}>
                  {
                    markTypes.map(mark => {
                      return (
                        <option value={mark}>{mark}</option>
                      )
                    })
                  }
                </select>
              </div>
            </div>
            <div className='def-property'>
              <div className='def-property-label'>Encodings:</div>
              <div className='def-property-col'>
                {
                  Object.entries(visualUnitSpec.encoding).map(([propName, propValue]) => {
                    return (
                      <div>
                        <h6 className='encoding-name'>{propName}</h6>
                        <div className='unit-encoding-def'>
                          <span>{JSON.stringify(propValue)}</span>
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            </div>
          </div>
        );
      })
    }

    <h3>Audio</h3>

    </div>
  );

}, (prevProps, nextProps) => {
  return prevProps.initialSpec === nextProps.initialSpec
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