import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEncoding, AudioPropName, AudioUnitSpec, ElaboratedUmweltDataSource, EncodingPropName, FieldDef, UmweltSpec, ViewComposition, VisualEncoding, VisualEncodingFieldDef, VisualPropName, VisualUnitSpec } from './grammar';
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
  const [fieldEncodingSelectValues, setFieldEncodingSelectValues] = useState<{[fieldName: string]: EncodingPropName}>({});
  const [fieldUnitSelectValues, setFieldUnitSelectValues] = useState<{[fieldName: string]: string}>({});

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
          name: 'vis_unit_0',
          mark: 'point',
          encoding: {
          }
        }]);
      }

      if (audioUnitSpecs.length === 0) {
        setAudioUnitSpecs([{
          name: 'audio_unit_0',
          encoding: {
          },
          traversal: []
        }]);
      }
    }
  }, [data]);

  useEffect(() => {
    const nextEncodingSelect = structuredClone(fieldEncodingSelectValues);
    fields.forEach(field => {
      const validPropNames = propertyNames.filter(x => !((field.encodings?.map(e => e.property) || []).includes(x)));
      if (!nextEncodingSelect[field.name]) {
        if (field.type === 'quantitative' || field.type === 'temporal') {
          nextEncodingSelect[field.name] = 'x';
        }
        else if (field.type === 'nominal' || field.type === 'ordinal') {
          nextEncodingSelect[field.name] = 'color';
        }
      }
      else if (!validPropNames.includes(nextEncodingSelect[field.name])) {
        nextEncodingSelect[field.name] = validPropNames[0];
      }
    });
    setFieldEncodingSelectValues(nextEncodingSelect);
  }, [fields]);

  useEffect(() => {
    const nextUnitSelect = structuredClone(fieldUnitSelectValues);
    fields.forEach(field => {
      if (!nextUnitSelect[field.name] || (visualPropNames.includes(fieldEncodingSelectValues[field.name] as any) !== visualUnitSpecs.map(unit => unit.name).includes(nextUnitSelect[field.name]))) {
        if (visualPropNames.includes(fieldEncodingSelectValues[field.name] as any)) {
          nextUnitSelect[field.name] = visualUnitSpecs[0].name;
        }
        else if (audioPropNames.includes(fieldEncodingSelectValues[field.name] as any)) {
          nextUnitSelect[field.name] = audioUnitSpecs[0].name;
        }
      }
    });
    setFieldUnitSelectValues(nextUnitSelect);
  }, [fieldEncodingSelectValues]);

  const onSelectEncoding = (fieldName) => {
    const domId = `${fieldName}-encoding-select`;
    const value = (document.getElementById(domId) as HTMLInputElement).value;
    setFieldEncodingSelectValues({
      ...fieldEncodingSelectValues,
      [fieldName]: value as EncodingPropName
    });
  }

  const onSelectUnit = (fieldName) => {
    const domId = `${fieldName}-unit-select`;
    const value = (document.getElementById(domId) as HTMLInputElement).value;
    setFieldUnitSelectValues({
      ...fieldUnitSelectValues,
      [fieldName]: value
    });
  }

  const addEncoding = (field: FieldDef) => {
    const propName = fieldEncodingSelectValues[field.name];
    const unitName = fieldUnitSelectValues[field.name];
    const newFields = fields.map(f => {
      if (f.name === field.name) {
        f.encodings.push({
          property: (propName as EncodingPropName)
        });
      }
      return f;
    });
    setFields(newFields);

    if (visualPropNames.includes(propName as VisualPropName)) {
      const unit = visualUnitSpecs.length === 1 ? visualUnitSpecs[0] : visualUnitSpecs.find(spec => spec.name === unitName);
      const newEncoding = structuredClone(unit.encoding);
      if (newEncoding[propName] && newEncoding[propName].field !== field.name) {
        const newFields = fields.map(f => {
          if (f.name === newEncoding[propName].field) {
            f.encodings = f.encodings.filter(e => e.property !== propName);
          }
          return f;
        });
        setFields(newFields);
      }
      newEncoding[propName] = {
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
    else if (audioPropNames.includes(propName as AudioPropName)) {
      const unit = audioUnitSpecs.length === 1 ? audioUnitSpecs[0] : audioUnitSpecs.find(spec => spec.name === unitName);
      const newEncoding = structuredClone(unit.encoding);
      if (newEncoding[propName] && newEncoding[propName].field !== field.name) {
        removeEncodingReference(propName, newEncoding[propName].field);
      }
      newEncoding[propName] = {
        field: field.name,
      };
      const newAudioUnitSpecs = audioUnitSpecs.map(spec => {
        if (spec.name === unit.name) {
          spec.encoding = newEncoding;
        }
        return spec;
      });
      setAudioUnitSpecs(newAudioUnitSpecs);
    }
  }

  const removeEncodingReference = (propName, fieldName) => {
    const newFields = fields.map(f => {
      if (f.name === fieldName) {
        f.encodings = f.encodings.filter(e => e.property !== propName);
      }
      return f;
    });
    setFields(newFields);
  }

  const removeEncoding = (unitSpec: VisualUnitSpec | AudioUnitSpec, propName) => {
    const encodingFieldDef = unitSpec.encoding[propName];
    removeEncodingReference(propName, encodingFieldDef.field);
    const newEncoding = structuredClone(unitSpec.encoding);
    delete newEncoding[propName];
    if ('mark' in unitSpec) {
      setVisualUnitSpecs(visualUnitSpecs.map(spec => {
        if (spec.name === unitSpec.name) {
          spec.encoding = newEncoding as VisualEncoding;
        }
        return spec;
      }));
    }
    else if ('traversal' in unitSpec) {
      setAudioUnitSpecs(audioUnitSpecs.map(spec => {
        if (spec.name === unitSpec.name) {
          spec.encoding = newEncoding as AudioEncoding;
        }
        return spec;
      }));
    }
  }

  const addUnit = (specs: VisualUnitSpec[] | AudioUnitSpec[]) => {
    if ('mark' in specs[0]) {
      const nextId = visualUnitSpecs.map(spec => parseInt(spec.name.split('_')[2])).reduce((a, b) => Math.max(a, b), 0) + 1;
      const nextSpecs = [...visualUnitSpecs, {
        name: `vis_unit_${nextId}`,
        mark: 'point',
        encoding: {
        }
      } as VisualUnitSpec];
      setVisualUnitSpecs(nextSpecs);
    }
    else if ('traversal' in specs[0]) {
      const nextId = audioUnitSpecs.map(spec => parseInt(spec.name.split('_')[2])).reduce((a, b) => Math.max(a, b), 0) + 1;
      const nextSpecs = [...audioUnitSpecs, {
        name: `audio_unit_${nextId}`,
        encoding: {
        },
        traversal: []
      } as AudioUnitSpec];
      setAudioUnitSpecs(nextSpecs);
    }
  }

  const removeUnit = (unitSpec: VisualUnitSpec | AudioUnitSpec) => {
    Object.keys(unitSpec.encoding).forEach(propName => {
      removeEncodingReference(propName, unitSpec.encoding[propName].field);
    });
    if ('mark' in unitSpec) {
      setVisualUnitSpecs(visualUnitSpecs.filter(spec => spec.name !== unitSpec.name));
    }
    else if ('traversal' in unitSpec) {
      setAudioUnitSpecs(audioUnitSpecs.filter(spec => spec.name !== unitSpec.name));
    }
  }

  const mtypes = ['quantitative', 'nominal', 'ordinal', 'temporal'];
  const visualPropNames: VisualPropName[] = ['x', 'y', 'color', 'shape', 'opacity'];
  const audioPropNames: AudioPropName[] = ['pitch', 'duration', 'volume'];
  const propertyNames: EncodingPropName[] = (visualPropNames as EncodingPropName[]).concat(audioPropNames);
  const markTypes = ['point', 'line', 'bar'];
  const aggregateOps = ['mean', 'median', 'min', 'max', 'sum', 'count'];
  const timeUnits = ['year', 'month', 'day', 'date', 'hours', 'minutes', 'seconds', 'milliseconds'];
  const traversalModes = ['sequential', 'interactive'];

  return (
    <div className='uw-structured-editor'>
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
                    <select id={`${field.name}-encoding-select`} value={fieldEncodingSelectValues[field.name]} onChange={() => onSelectEncoding(field.name)}>
                      {
                        propertyNames.filter(x => !((field.encodings?.map(e => e.property) || []).includes(x))).map(propName => {
                          return (
                            <option value={propName}>{propName}</option>
                          )
                        })
                      }
                    </select>
                    {
                      visualUnitSpecs.length > 1 && visualPropNames.includes(fieldEncodingSelectValues[field.name] as VisualPropName) ? (
                        <select id={`${field.name}-unit-select`} value={fieldUnitSelectValues[field.name]} onChange={() => onSelectUnit(field.name)}>
                          {
                            visualUnitSpecs.map(visualUnitSpec => {
                              return (
                                <option value={visualUnitSpec.name}>{visualUnitSpec.name}</option>
                              )
                            })
                          }
                        </select>
                      ) : null
                    }
                    {
                      audioUnitSpecs.length > 1 && audioPropNames.includes(fieldEncodingSelectValues[field.name] as AudioPropName) ? (
                        <select id={`${field.name}-unit-select`} value={fieldUnitSelectValues[field.name]} onChange={() => onSelectUnit(field.name)}>
                          {
                            audioUnitSpecs.map(audioUnitSpec => {
                              return (
                                <option value={audioUnitSpec.name}>{audioUnitSpec.name}</option>
                              )
                            })
                          }
                        </select>
                      ) : null
                    }
                    <button onClick={() => addEncoding(field)}>Add</button>
                  </div>
                </div>
              </div>
              <div>
                <details>
                  <summary>Additional options</summary>
                  <div className='def-property'>
                    <div className='def-property-label'>Aggregate:</div>
                    <div className='def-property-col'>
                      <select value={field.aggregate}>
                        <option value=''>None</option>
                        {
                          aggregateOps.map(aggregateOp => {
                            return (
                              <option value={aggregateOp}>{aggregateOp}</option>
                            )
                          })
                        }
                      </select>
                    </div>
                  </div>
                  <div className='def-property'>
                    <div className='def-property-label'>Bin:</div>
                    <div className='def-property-col'>
                      <input type='checkbox' checked={field.bin} />
                    </div>
                  </div>
                  <div className='def-property'>
                    <div className='def-property-label'>Time unit:</div>
                    <div className='def-property-col'>
                      <select value={field.timeUnit}>
                        <option value=''>None</option>
                        {
                          timeUnits.map(timeUnit => {
                            return (
                              <option value={timeUnit}>{timeUnit}</option>
                            )
                          })
                        }
                      </select>
                    </div>
                  </div>
                  <div className='def-property'>
                    <div className='def-property-label'>Scale:</div>
                    <div className='def-property-col'>
                      (todo: domain, zero, nice)
                    </div>
                  </div>
                  <div className='def-property'>
                    <div className='def-property-label'>Sort:</div>
                    <div className='def-property-col'>
                      (todo: ascending, descending, by encoding, by field, etc)
                    </div>
                  </div>
                </details>
              </div>
            </div>
          );
        })
      }
      <h3>Visual</h3>
      {
        visualUnitSpecs.map((visualUnitSpec) => {
          return (
            <div className='unit-spec'>
              {
                visualUnitSpecs.length > 1 ? (
                  <h5 className='def-name'>{visualUnitSpec.name}</h5>
                ) : null
              }
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
                        <div className='enc-def'>
                          <h6 className='encoding-name'>{propName}</h6>
                          <div className='unit-encoding-def'>
                            <span>{propValue.field}</span>
                            <button>Go to field</button>
                            <button onClick={() => removeEncoding(visualUnitSpec, propName)}>Remove encoding</button>
                          </div>
                          <details>
                            <summary>Additional options</summary>
                            <div className='def-property'>
                              <div className='def-property-label'>Aggregate:</div>
                              <div className='def-property-col'>
                                <select value={propValue.aggregate}>
                                  <option value=''>None</option>
                                  {
                                    aggregateOps.map(aggregateOp => {
                                      return (
                                        <option value={aggregateOp}>{aggregateOp}</option>
                                      )
                                    })
                                  }
                                </select>
                              </div>
                            </div>
                            <div className='def-property'>
                              <div className='def-property-label'>Bin:</div>
                              <div className='def-property-col'>
                                <input type='checkbox' checked={propValue.bin} />
                              </div>
                            </div>
                            <div className='def-property'>
                              <div className='def-property-label'>Time unit:</div>
                              <div className='def-property-col'>
                                <select value={propValue.timeUnit}>
                                  <option value=''>None</option>
                                  {
                                    timeUnits.map(timeUnit => {
                                      return (
                                        <option value={timeUnit}>{timeUnit}</option>
                                      )
                                    })
                                  }
                                </select>
                              </div>
                            </div>
                            <div className='def-property'>
                              <div className='def-property-label'>Scale:</div>
                              <div className='def-property-col'>
                                (todo: domain, zero, nice)
                              </div>
                            </div>
                            <div className='def-property'>
                              <div className='def-property-label'>Sort:</div>
                              <div className='def-property-col'>
                                (todo: ascending, descending, by encoding, by field, etc)
                              </div>
                            </div>
                          </details>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
              {
                visualUnitSpecs.length > 1 ? (
                  <div>
                    <button onClick={() => removeUnit(visualUnitSpec)}>Remove unit</button>
                  </div>
                ) : null
              }
            </div>
          );
        })
      }
      <div>
        <button onClick={() => addUnit(visualUnitSpecs)}>Add visual unit</button>
      </div>

      <h3>Audio</h3>
      {
        audioUnitSpecs.map((audioUnitSpec) => {
          return (
            <div className='unit-spec'>
              {
                audioUnitSpecs.length > 1 ? (
                  <h5 className='def-name'>{audioUnitSpec.name}</h5>
                ) : null
              }
              <div className='def-property'>
                <div className='def-property-label'>Encodings:</div>
                <div className='def-property-col'>
                  {
                    Object.entries(audioUnitSpec.encoding).map(([propName, propValue]) => {
                      return (
                        <div>
                          <h6 className='encoding-name'>{propName}</h6>
                          <div className='unit-encoding-def'>
                            <span>{propValue.field}</span>
                            <button>Go to field</button>
                            <button onClick={() => removeEncoding(audioUnitSpec, propName)}>Remove encoding</button>
                          </div>
                          <details>
                            <summary>Additional options</summary>
                            <div className='def-property'>
                              <div className='def-property-label'>Aggregate:</div>
                              <div className='def-property-col'>
                                <select value={propValue.aggregate}>
                                  <option value=''>None</option>
                                  {
                                    aggregateOps.map(aggregateOp => {
                                      return (
                                        <option value={aggregateOp}>{aggregateOp}</option>
                                      )
                                    })
                                  }
                                </select>
                              </div>
                            </div>
                            <div className='def-property'>
                              <div className='def-property-label'>Time unit:</div>
                              <div className='def-property-col'>
                                <select value={propValue.timeUnit}>
                                  <option value=''>None</option>
                                  {
                                    timeUnits.map(timeUnit => {
                                      return (
                                        <option value={timeUnit}>{timeUnit}</option>
                                      )
                                    })
                                  }
                                </select>
                              </div>
                            </div>
                            <div className='def-property'>
                              <div className='def-property-label'>Scale:</div>
                              <div className='def-property-col'>
                                (todo: domain, zero, nice)
                              </div>
                            </div>
                            <div className='def-property'>
                              <div className='def-property-label'>Sort:</div>
                              <div className='def-property-col'>
                                (todo: ascending, descending, by encoding, by field, etc)
                              </div>
                            </div>
                          </details>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
              <div className='def-property'>
                <div className='def-property-label'>Traversals:</div>
                <div className='def-property-col'>
                  {
                    audioUnitSpec.traversal.map((traversal) => {
                      return (
                        <div>
                          <div className='unit-encoding-def'>
                            <span>{traversal.field}</span>
                            <button>Go to field</button>
                            {/* <button onClick={() => removeEncoding(audioUnitSpec, propName)}>Remove encoding</button> */}
                          </div>
                          <div className='def-property'>
                            <div className='def-property-label'>Mode:</div>
                            <div className='def-property-col'>
                              <select>
                                {
                                  traversalModes.map(traversalMode => {
                                    return (
                                      <option value={traversalMode}>{traversalMode}</option>
                                    )
                                  })
                                }
                              </select>
                            </div>
                          </div>
                          <details>
                            <summary>Additional options</summary>
                            <div className='def-property'>
                              <div className='def-property-label'>Bin:</div>
                              <div className='def-property-col'>
                                <input type='checkbox' checked={traversal.bin} />
                              </div>
                            </div>
                            <div className='def-property'>
                              <div className='def-property-label'>Time unit:</div>
                              <div className='def-property-col'>
                                <select value={traversal.timeUnit}>
                                  <option value=''>None</option>
                                  {
                                    timeUnits.map(timeUnit => {
                                      return (
                                        <option value={timeUnit}>{timeUnit}</option>
                                      )
                                    })
                                  }
                                </select>
                              </div>
                            </div>
                            <div className='def-property'>
                              <div className='def-property-label'>Scale:</div>
                              <div className='def-property-col'>
                                (todo: domain, zero, nice)
                              </div>
                            </div>
                            <div className='def-property'>
                              <div className='def-property-label'>Sort:</div>
                              <div className='def-property-col'>
                                (todo: ascending, descending, by encoding, by field, etc)
                              </div>
                            </div>
                          </details>
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
      <div>
        <button onClick={() => addUnit(audioUnitSpecs)}>Add audio unit</button>
      </div>
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