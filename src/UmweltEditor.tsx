import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEncoding, AudioPropName, AudioUnitSpec, ElaboratedUmweltDataSource, EncodingPropName, EncodingRef, FieldDef, UmweltSpec, ViewComposition, VisualEncoding, VisualEncodingFieldDef, VisualPropName, VisualUnitSpec } from './grammar';
import './text/TreeStyle.css'
import { OlliDataset } from 'olli';
import { getData } from './utils/data';
import { elaborateFields } from './grammar/elaborate';
import { debounce } from 'vega';
import { isEqual } from 'vega-lite';
import { set } from 'vega-lite/src/log';

interface EditorProps {
  initialSpec: any
}

const UmveltEditor = React.memo(({ initialSpec }: EditorProps) => {

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

  const onData = () => {
    const value = (document.querySelector('.input-data') as HTMLInputElement).value;
    setDataUrl(value);
  };

  useEffect(() => {
    const filePathRegex = /^(\/[\w-.]+|(?:(?:https?|http):\/\/)[^\s/$.?#].[^\s]*\.(?:json|csv))$/;
    if (dataUrl && filePathRegex.test(dataUrl)) {
      getData({url: dataUrl}).then(data => {
        if (data && data.length) {
          setData(data);
        }
      });
    }
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
      const validPropNames = propertyNames.filter(propName => {
        if (visualPropNames.includes(propName as VisualPropName)) {
          return visualUnitSpecs.some(spec => !spec.encoding[propName]);
        }
        else if (audioPropNames.includes(propName as AudioPropName)) {
          return audioUnitSpecs.some(spec => !spec.encoding[propName]);
        }
      });
      if (validPropNames.length && (!nextEncodingSelect[field.name] || !validPropNames.includes(nextEncodingSelect[field.name]))) {
        if (field.type === 'quantitative' || field.type === 'temporal') {
          nextEncodingSelect[field.name] = validPropNames.find(propName => ['x', 'y', 'opacity', 'size', 'pitch', 'duration', 'volume'].includes(propName)) || validPropNames[0];
        }
        else if (field.type === 'nominal' || field.type === 'ordinal') {
          nextEncodingSelect[field.name] = validPropNames.find(propName => ['color', 'shape'].includes(propName)) || validPropNames[0];
        }
      }
    });
    setFieldEncodingSelectValues(nextEncodingSelect);
  }, [fields]);

  useEffect(() => {
    const nextUnitSelect = structuredClone(fieldUnitSelectValues);
    const getUnit = (unitName: string) => {
      return visualUnitSpecs.find(spec => spec.name === unitName) || audioUnitSpecs.find(spec => spec.name === unitName);
    }
    fields.forEach(field => {
      if (!nextUnitSelect[field.name] ||
          (visualPropNames.includes(fieldEncodingSelectValues[field.name] as any) !== visualUnitSpecs.map(unit => unit.name).includes(nextUnitSelect[field.name])) ||
          getUnit(nextUnitSelect[field.name]).encoding[fieldEncodingSelectValues[field.name]]?.field === field.name) {
        if (visualPropNames.includes(fieldEncodingSelectValues[field.name] as any)) {
          nextUnitSelect[field.name] = visualUnitSpecs.find(spec => spec.encoding[fieldEncodingSelectValues[field.name]]?.field !== field.name).name
        }
        else if (audioPropNames.includes(fieldEncodingSelectValues[field.name] as any)) {
          nextUnitSelect[field.name] = audioUnitSpecs.find(spec => spec.encoding[fieldEncodingSelectValues[field.name]]?.field !== field.name).name
        }
      }
    });
    setFieldUnitSelectValues(nextUnitSelect);
  }, [fieldEncodingSelectValues]);

  const onSelectEncoding = (fieldName, propName) => {
    setFieldEncodingSelectValues({
      ...fieldEncodingSelectValues,
      [fieldName]: propName
    });
  }

  const onSelectUnit = (fieldName, unitName) => {
    setFieldUnitSelectValues({
      ...fieldUnitSelectValues,
      [fieldName]: unitName
    });
  }

  const onMark = (visualUnitSpec, mark) => {
    setVisualUnitSpecs(visualUnitSpecs.map(spec => {
      if (spec.name === visualUnitSpec.name) {
        spec.mark = mark;
      }
      return spec;
    }));
  }

  const addEncoding = (field: FieldDef) => {
    const propName = fieldEncodingSelectValues[field.name];
    const unitName = fieldUnitSelectValues[field.name];
    const newFields = fields.map(f => {
      if (f.name === field.name) {
        f.encodings.push({
          property: (propName as EncodingPropName),
          unit: unitName,
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
      const newTraversal = structuredClone(unit.traversal).filter(traversal => traversal.field !== field.name);

      if (newEncoding[propName] && newEncoding[propName].field !== field.name) {
        removeEncodingReference(propName, newEncoding[propName].field);
      }
      newEncoding[propName] = {
        field: field.name,
      };

      fields.forEach(fieldDef => {
        if (!Object.values(newEncoding).find(def => def.field === fieldDef.name) && !newTraversal.find(traversal => traversal.field === fieldDef.name)) {
          newTraversal.push({
            field: fieldDef.name,
            mode: 'interactive',
          });
        }
      });

      const newAudioUnitSpecs = audioUnitSpecs.map(spec => {
        if (spec.name === unit.name) {
          spec.encoding = newEncoding;
          spec.traversal = newTraversal;
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
          if (Object.keys(newEncoding).length === 0) {
            spec.traversal = [];
          }
          else {
            spec.traversal.push({
              field: encodingFieldDef.field,
              mode: 'interactive',
            })
          }
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

  const jumpToEncodingRef = (encodingRef: EncodingRef) => {
    const domId = `encoding-${encodingRef.unit}-${encodingRef.property}`;
    const element = document.getElementById(domId);
    if (element) {
      element.scrollIntoView({behavior: 'smooth'});
      element.focus();
    }
  }

  const jumpToField = (fieldName: string, propName: string) => {
    const domId = `field-${fieldName}-${propName}`;
    const element = document.getElementById(domId);
    if (element) {
      element.scrollIntoView({behavior: 'smooth'});
      element.focus();
    }
  }

  const mtypes = ['quantitative', 'nominal', 'ordinal', 'temporal'];
  const visualPropNames: VisualPropName[] = ['x', 'y', 'color', 'shape', 'opacity'];
  const audioPropNames: AudioPropName[] = ['pitch', 'duration', 'volume'];
  const commonPropNames = ['x', 'y', 'color', 'pitch'].reverse();
  const propertyNames: EncodingPropName[] = (visualPropNames as EncodingPropName[]).concat(audioPropNames).sort((a, b) => {
    const aIndex = commonPropNames.indexOf(a);
    const bIndex = commonPropNames.indexOf(b);
    return bIndex - aIndex;
  });
  const markTypes = ['point', 'line', 'bar'];
  const aggregateOps = ['mean', 'median', 'min', 'max', 'sum', 'count'];
  const timeUnits = ['year', 'month', 'day', 'date', 'hours', 'minutes', 'seconds', 'milliseconds'];
  const traversalModes = ['sequential', 'interactive'];

  return (
    <div className='uw-structured-editor'>
      <h3 id="uw-data">Data</h3>
      <input aria-labelledby='uw-data' type="url" className="input-data" value={dataUrl} onChange={onData} required></input>
      <h3>Fields</h3>
      {
        fields.map(field => {
          return (
            <div className='field-def' key={field.name}>
              <h5 className='def-name'>{field.name}</h5>
              <div className='def-property'>
                <label>
                  Type
                  <select value={field.type}>
                      {
                        mtypes.map(mtype => {
                          return (
                            <option value={mtype}>{mtype}</option>
                          )
                        })
                      }
                    </select>
                </label>
                {/* <div className='def-property-col'>

                </div> */}
              </div>
              <div className='def-property'>
                <div className='def-property-label'>Encodings:</div>
                <div className='def-property-col'>
                  {
                    field.encodings?.map(encodingRef => {
                      return (
                        <div className='field-def-encoding-ref'>
                          <span>{encodingRef.property}</span>
                          <button id={`field-${field.name}-${encodingRef.property}`} onClick={() => jumpToEncodingRef(encodingRef)}>Go to full definition</button>
                        </div>
                      )
                    })
                  }
                  {
                    field.encodings.length < propertyNames.length ?
                    (
                      <div>
                        <div className='def-property-add'>Add encoding:</div>
                        <select value={fieldEncodingSelectValues[field.name]} onChange={(e) => onSelectEncoding(field.name, e.target.value)}>
                          {
                            propertyNames.filter(propName => {
                              if (visualPropNames.includes(propName as VisualPropName)) {
                                return visualUnitSpecs.some(spec => !spec.encoding[propName]);
                              }
                              else if (audioPropNames.includes(propName as AudioPropName)) {
                                return audioUnitSpecs.some(spec => !spec.encoding[propName]);
                              }
                            }).map(propName => {
                              return (
                                <option value={propName}>{propName}</option>
                              )
                            })
                          }
                        </select>
                        {
                          visualUnitSpecs.length > 1 && visualPropNames.includes(fieldEncodingSelectValues[field.name] as VisualPropName) ? (
                            <select value={fieldUnitSelectValues[field.name]} onChange={(e) => onSelectUnit(field.name, e.target.value)}>
                              {
                                visualUnitSpecs.filter(spec => spec.encoding[fieldEncodingSelectValues[field.name]]?.field !== field.name).map(visualUnitSpec => {
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
                            <select value={fieldUnitSelectValues[field.name]} onChange={(e) => onSelectUnit(field.name, e.target.value)}>
                              {
                                audioUnitSpecs.filter(spec => spec.encoding[fieldEncodingSelectValues[field.name]]?.field !== field.name).map(audioUnitSpec => {
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
                    ) : null
                  }
                </div>
              </div>
              <div>
                <details>
                  <summary>Additional options</summary>
                  <div className='def-property'>
                    <label>
                      Aggregate
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
                    </label>
                  </div>
                  <div className='def-property'>
                    <label>
                      Bin
                      <input type='checkbox' checked={field.bin} />
                    </label>
                  </div>
                  <div className='def-property'>
                    <label>
                      Time unit
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
                    </label>
                  </div>
                  <div className='def-property'>
                    <label>
                      Scale
                      (todo: domain, zero, nice)
                      </label>
                  </div>
                  <div className='def-property'>
                    <label>
                      Sort
                      (todo: ascending, descending, by encoding, by field, etc)
                    </label>
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
                  <select value={visualUnitSpec.mark} onChange={(e) => onMark(visualUnitSpec, e.target.value)}>
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
                    Object.keys(visualUnitSpec.encoding).length ?
                    Object.entries(visualUnitSpec.encoding).map(([propName, propValue]) => {
                      return (
                        <div className='enc-def'>
                          <h6 className='encoding-name'>{propName}</h6>
                          <div className='unit-encoding-def'>
                            <span>{propValue.field}</span>
                            <button id={`encoding-${visualUnitSpec.name}-${propName}`} onClick={() => jumpToField(propValue.field, propName)}>Go to field</button>
                            <button onClick={() => removeEncoding(visualUnitSpec, propName)}>Remove encoding</button>
                          </div>
                          <details>
                            <summary>Additional options</summary>
                            <div className='def-property'>
                              <label>
                                Aggregate
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
                              </label>
                            </div>
                            <div className='def-property'>
                              <label>
                                Bin
                                <input type='checkbox' checked={propValue.bin} />
                              </label>
                            </div>
                            <div className='def-property'>
                              <label>
                                Time unit
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
                              </label>
                            </div>
                            <div className='def-property'>
                              <label>
                                Scale
                                (todo: domain, zero, nice)
                                </label>
                            </div>
                            <div className='def-property'>
                              <label>
                                Sort
                                (todo: ascending, descending, by encoding, by field, etc)
                              </label>
                            </div>
                          </details>
                        </div>
                      )
                    })
                    : "None"
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
                    Object.keys(audioUnitSpec.encoding).length ?
                    Object.entries(audioUnitSpec.encoding).map(([propName, propValue]) => {
                      return (
                        <div>
                          <h6 className='encoding-name'>{propName}</h6>
                          <div className='unit-encoding-def'>
                            <span>{propValue.field}</span>
                            <button id={`encoding-${audioUnitSpec.name}-${propName}`} onClick={() => jumpToField(propValue.field, propName)}>Go to field</button>
                            <button onClick={() => removeEncoding(audioUnitSpec, propName)}>Remove encoding</button>
                          </div>
                          <details>
                            <summary>Additional options</summary>
                            <div className='def-property'>
                              <label>
                                Aggregate
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
                              </label>
                            </div>
                            <div className='def-property'>
                              <label>
                                Time unit
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
                              </label>
                            </div>
                            <div className='def-property'>
                              <label>
                                Scale
                                (todo: domain, zero, nice)
                                </label>
                            </div>
                            <div className='def-property'>
                              <label>
                                Sort
                                (todo: ascending, descending, by encoding, by field, etc)
                              </label>
                            </div>
                          </details>
                        </div>
                      )
                    }) : "None"
                  }
                </div>
              </div>
              <div className='def-property'>
                <div className='def-property-label'>Traversals:</div>
                <div className='def-property-col'>
                  {
                    audioUnitSpec.traversal.length ?
                    audioUnitSpec.traversal.map((traversal) => {
                      return (
                        <div className='enc-def'>
                          <div className='unit-encoding-def'>
                            <span>{traversal.field}</span>
                            <button>Go to field</button>
                            {/* <button onClick={() => removeEncoding(audioUnitSpec, propName)}>Remove encoding</button> */}
                          </div>
                          <div className='def-property'>
                            <div className='def-property-label'>Mode:</div>
                            <div className='def-property-col'>
                              <select value={traversal.mode}>
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
                              <label>
                                Bin
                                <input type='checkbox' checked={traversal.bin} />
                              </label>
                            </div>
                            <div className='def-property'>
                              <label>
                                Time unit
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
                              </label>
                            </div>
                            <div className='def-property'>
                              <label>
                                Scale
                                (todo: domain, zero, nice)
                                </label>
                            </div>
                            <div className='def-property'>
                              <label>
                                Sort
                                (todo: ascending, descending, by encoding, by field, etc)
                              </label>
                            </div>
                          </details>
                        </div>
                      )
                    }) : "None"
                  }
                </div>
              </div>
              {
                audioUnitSpecs.length > 1 ? (
                  <div>
                    <button onClick={() => removeUnit(audioUnitSpec)}>Remove unit</button>
                  </div>
                ) : null
              }
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