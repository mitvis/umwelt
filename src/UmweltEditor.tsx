import React, { useEffect, useState } from 'react';
import { AudioEncoding, AudioEncodingFieldDef, AudioPropName, AudioTraversalFieldDef, AudioUnitSpec, EncodingPropName, EncodingRef, FieldDef, UmweltSpec, ViewComposition, VisualEncoding, VisualPropName, VisualUnitSpec } from './grammar';
import { OlliDataset } from 'olli';
import { getData, typeCoerceData } from './utils/data';
import { elaborateFields } from './utils/inference';
import { UrlData } from 'vega-lite/src/data';

import './UmweltEditor.css'

interface EditorProps {
  initialSpec: UmweltSpec;
  onSpec: (spec: UmweltSpec, data: OlliDataset) => void;
}

const UmweltEditor = React.memo(({ initialSpec, onSpec }: EditorProps) => {

  const [tab, setTab] = useState<'data' | 'fields' | 'visual' | 'audio'>('data');
  const [dataUrl, setDataUrl] = useState<string>((initialSpec?.data as UrlData)?.url);
  const [data, setData] = useState<OlliDataset>([]);
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
  const [audioUnitSpecs, setAudioUnitSpecs] = useState<AudioUnitSpec[]>([]);
  const [visualComposition, setVisualComposition] = useState<ViewComposition>('layer');
  const [audioComposition, setAudioComposition] = useState<ViewComposition>('concat');
  const [fieldEncodingSelectValues, setFieldEncodingSelectValues] = useState<{[fieldName: string]: EncodingPropName}>({});
  const [fieldUnitSelectValues, setFieldUnitSelectValues] = useState<{[fieldName: string]: string}>({});
  const [unitTraversalSelectValues, setUnitTraversalSelectValues] = useState<{[unitName: string]: string}>({});


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
  const timeUnits = ['year', 'month', 'day', 'date', 'hours', 'minutes', 'seconds'];

  useEffect(() => {
    if (data && data.length > 0) {
      onSpec({
        data: {
          url: dataUrl,
        },
        fields,
        visual: {
          units: visualUnitSpecs,
          composition: visualComposition
        },
        audio: {
          units: audioUnitSpecs,
          composition: audioComposition
        },
        text: true,
      }, data);
    }
  }, [data, fields, visualUnitSpecs, audioUnitSpecs, onSpec, dataUrl, visualComposition, audioComposition]);

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
      if (!(fields.length === Object.keys(data[0]).length && fields.every(field => Object.keys(data[0]).includes(field.name)))) {
        const allFields = Object.keys(data[0]).map(name => {
          return {
            name
          }
        })
        const elaboratedFields = elaborateFields(allFields, data);
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
    const niceData = typeCoerceData(data, fields);
    setData(niceData);
  }, [fields]);

  useEffect(() => {
    const nextEncodingSelect = structuredClone(fieldEncodingSelectValues);
    const validPropNames = propertyNames.filter(propName => {
      if (visualPropNames.includes(propName as VisualPropName)) {
        return visualUnitSpecs.some(spec => !spec.encoding[propName]);
      }
      else if (audioPropNames.includes(propName as AudioPropName)) {
        return audioUnitSpecs.some(spec => !spec.encoding[propName]);
      }
    });
    fields.forEach(field => {
      if (validPropNames.length) {
        if (field.type === 'quantitative' || field.type === 'temporal') {
          nextEncodingSelect[field.name] = validPropNames.find(propName => ['x', 'y', 'opacity', 'size', 'pitch', 'duration', 'volume'].includes(propName)) || validPropNames[0];
        }
        else if (field.type === 'nominal' || field.type === 'ordinal') {
          nextEncodingSelect[field.name] = validPropNames.find(propName => ['color', 'shape'].includes(propName)) || validPropNames[0];
        }
      }
    });
    setFieldEncodingSelectValues(nextEncodingSelect);

    const nextTraversalSelect = structuredClone(unitTraversalSelectValues);
    audioUnitSpecs.forEach(spec => {
      const validFields = fields.filter(field => {
        return !spec.traversal.find(traversal => traversal.field === field.name) && !Object.values(spec.encoding).find((def: AudioEncodingFieldDef) => def.field === field.name);
      });
      if (validFields.length) {
        nextTraversalSelect[spec.name] = validFields[0].name;
      }
    });
    setUnitTraversalSelectValues(nextTraversalSelect);
  }, [fields, visualUnitSpecs, audioUnitSpecs]);

  useEffect(() => {
    const nextUnitSelect = structuredClone(fieldUnitSelectValues);
    const getUnit = (unitName: string) => {
      return visualUnitSpecs.find(spec => spec.name === unitName) || audioUnitSpecs.find(spec => spec.name === unitName);
    }
    fields.forEach(field => {
      if (!nextUnitSelect[field.name] ||
          (visualPropNames.includes(fieldEncodingSelectValues[field.name] as any) !== visualUnitSpecs.map(unit => unit.name).includes(nextUnitSelect[field.name])) ||
          getUnit(nextUnitSelect[field.name])?.encoding[fieldEncodingSelectValues[field.name]]?.field === field.name) {
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

  const onSelectType = (fieldDef, type) => {
    const newFields = fields.map(f => {
      if (f.name === fieldDef.name) {
        f.type = type;
      }
      return f;
    });
    setFields(newFields);
  }

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

  const onSelectTraversal = (unitName, fieldName) => {
    setUnitTraversalSelectValues({
      ...unitTraversalSelectValues,
      [unitName]: fieldName
    });
  }

  const onSelectComposition = (which: 'visual' | 'audio', composition: string) => {
    if (which === 'visual') {
      setVisualComposition(composition as ViewComposition);
    }
    else if (which === 'audio') {
      setAudioComposition(composition as ViewComposition);
    }
  }

  const onSelectEncodingProperty = (unit: VisualUnitSpec | AudioUnitSpec, encPropName: string, propName: string, value: any) => {
    const newEncoding = structuredClone(unit.encoding);
    if (!value) {
      delete newEncoding[encPropName][propName];
    }
    else {
      newEncoding[encPropName][propName] = value;
    }
    if ('mark' in unit) {
      setVisualUnitSpecs(visualUnitSpecs.map(spec => {
        if (spec.name === unit.name) {
          spec.encoding = newEncoding as VisualEncoding;
        }
        return spec;
      }));
    }
    else if ('traversal' in unit) {
      setAudioUnitSpecs(audioUnitSpecs.map(spec => {
        if (spec.name === unit.name) {
          spec.encoding = newEncoding as AudioEncoding;
        }
        return spec;
      }));
    }
  }

  const onSelectFieldProperty = (field: FieldDef, property: string, value: any) => {
    const newFields = fields.map(f => {
      if (f.name === field.name) {
        if (!value) {
          delete f[property];
        }
        else {
          f[property] = value;
        }
      }
      return f;
    });
    setFields(newFields);
  }

  const onSelectTraversalProperty = (traversal: AudioTraversalFieldDef, unitName: string, propName: string, value: any) => {
    setAudioUnitSpecs(audioUnitSpecs.map(spec => {
      if (spec.name === unitName) {
        spec.traversal = spec.traversal.map(t => {
          if (t.field === traversal.field) {
            t[propName] = value;
          }
          return t;
        });
      }
      return spec;
    }));
  }

  const onMark = (visualUnitSpec, mark) => {
    setVisualUnitSpecs(visualUnitSpecs.map(spec => {
      if (spec.name === visualUnitSpec.name) {
        spec.mark = mark;
      }
      return spec;
    }));
  }

  const addTraversal = (unitName: string) => {
    const fieldName = unitTraversalSelectValues[unitName];
    const unit = audioUnitSpecs.find(spec => spec.name === unitName);
    const newTraversal = structuredClone(unit.traversal).filter(traversal => traversal.field !== fieldName);
    newTraversal.push({
      field: fieldName,
    });
    setAudioUnitSpecs(audioUnitSpecs.map(spec => {
      if (spec.name === unitName) {
        spec.traversal = newTraversal;
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
        if (!Object.values(newEncoding).find((def: any) => def.field === fieldDef.name) && !newTraversal.find(traversal => traversal.field === fieldDef.name)) {
          newTraversal.push({
            field: fieldDef.name,
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
            })
          }
        }
        return spec;
      }));
    }
  }

  const removeTraversal = (unitSpec: AudioUnitSpec, field) => {
    const newTraversal = unitSpec.traversal.filter(traversal => traversal.field !== field);
    setAudioUnitSpecs(audioUnitSpecs.map(spec => {
      if (spec.name === unitSpec.name) {
        spec.traversal = newTraversal;
      }
      return spec;
    }));
  }

  const addUnit = (specs: VisualUnitSpec[] | AudioUnitSpec[]) => {
    if ('mark' in specs[0]) {
      const nextId = visualUnitSpecs.map(spec => parseInt(spec.name.split('_')[2])).reduce((a, b) => Math.max(a, b), 0) + 1;
      const nextSpecs = [...visualUnitSpecs, {
        name: `vis_unit_${nextId}`,
        mark: visualUnitSpecs[visualUnitSpecs.length - 1].mark,
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

  return (
    <div className='uw-structured-editor'>
      <div role='tablist'>
        <button role='tab' id='tab-data' aria-controls='tabpanel-data' aria-selected={tab === 'data'} onClick={() => setTab('data')}>Data</button>
        <button role='tab' id='tab-fields' aria-controls='tabpanel-fields' aria-selected={tab === 'fields'} onClick={() => setTab('fields')} disabled={!(data && fields.length)}>Fields</button>
        <button role='tab' id='tab-visual' aria-controls='tabpanel-visual' aria-selected={tab === 'visual'} onClick={() => setTab('visual')} disabled={!(data && fields.length)}>Visual</button>
        <button role='tab' id='tab-audio' aria-controls='tabpanel-audio' aria-selected={tab === 'audio'} onClick={() => setTab('audio')} disabled={!(data && fields.length)}>Audio</button>
      </div>

      <div role='tabpanel' id='tabpanel-data' aria-labelledby='tab-data' hidden={tab !== 'data'}>
        <h3 id="uw-data">Data</h3>
        <input aria-labelledby='uw-data' type="url" className="input-data" value={dataUrl} onChange={onData} required></input>
      </div>

      <div role='tabpanel' id='tabpanel-fields' aria-labelledby='tab-fields' hidden={tab !== 'fields'}>
        <h3>Fields</h3>
        {
          fields.map(field => {
            return (
              <div className='field-def' key={field.name}>
                <h5 className='def-name'>{field.name}</h5>
                <div className='def-property'>
                  <label>
                    Type
                    <select value={field.type} onChange={(e) => onSelectType(field, e.target.value)}>
                        {
                          mtypes.map(mtype => {
                            return (
                              <option key={mtype} value={mtype}>{mtype}</option>
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
                          <div className='field-def-encoding-ref' key={`${encodingRef.property}-${encodingRef.unit}`}>
                            <span>{encodingRef.property}{
                              visualPropNames.includes(encodingRef.property as any) ? (
                                visualUnitSpecs.length > 1 ? ` (${encodingRef.unit})` : null
                              ) : audioPropNames.includes(encodingRef.property as any) ? (
                                audioUnitSpecs.length > 1 ? ` (${encodingRef.unit})` : null
                              ) : null
                            }</span>
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
                                return false;
                              }).map(propName => {
                                return (
                                  <option key={propName} value={propName}>{propName}</option>
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
                                      <option key={visualUnitSpec.name} value={visualUnitSpec.name}>{visualUnitSpec.name}</option>
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
                                      <option key={audioUnitSpec.name} value={audioUnitSpec.name}>{audioUnitSpec.name}</option>
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
                        <select value={field.aggregate} onChange={(e) => onSelectFieldProperty(field, 'aggregate', e.target.value)}>
                          <option value=''>None</option>
                          {
                            aggregateOps.map(aggregateOp => {
                              return (
                                <option key={aggregateOp} value={aggregateOp}>{aggregateOp}</option>
                              )
                            })
                          }
                        </select>
                      </label>
                    </div>
                    {
                      field.type === 'quantitative' || field.type === 'temporal' ? (
                        <div className='def-property'>
                          <label>
                            Bin
                            <input type='checkbox' checked={field.bin} onChange={(e) => onSelectFieldProperty(field, 'bin', e.target.checked)}/>
                          </label>
                        </div>
                      ) : null
                    }
                    {
                      field.type === 'temporal' ? (
                        <div className='def-property'>
                          <label>
                            Time unit
                            <select value={field.timeUnit} onChange={(e) => onSelectFieldProperty(field, 'timeUnit', e.target.value)}>
                              <option value=''>None</option>
                              {
                                timeUnits.map(timeUnit => {
                                  return (
                                    <option key={timeUnit} value={timeUnit}>{timeUnit}</option>
                                  )
                                })
                              }
                            </select>
                          </label>
                        </div>
                      ) : null
                    }
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
      </div>

      <div role='tabpanel' id='tabpanel-visual' aria-labelledby='tab-visual' hidden={tab !== 'visual'}>
        <h3>Visual</h3>
        {
          visualUnitSpecs.map((visualUnitSpec) => {
            return (
              <div className='unit-spec' key={visualUnitSpec.name}>
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
                            <option key={mark} value={mark}>{mark}</option>
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
                        const fieldDef = fields.find(field => field.name === propValue.field);
                        return (
                          <div className='enc-def' key={`${propName}-${visualUnitSpec.name}`}>
                            <h6 className='encoding-name'>{propName}</h6>
                            <div className='unit-encoding-def'>
                              <span>{propValue.bin ? `binned ` : null}{propValue.aggregate ? `${propValue.aggregate} ` : null}{propValue.field}{propValue.timeUnit ? ` (${propValue.timeUnit})` : null}</span>
                              <button id={`encoding-${visualUnitSpec.name}-${propName}`} onClick={() => jumpToField(propValue.field, propName)}>Go to field</button>
                              <button onClick={() => removeEncoding(visualUnitSpec, propName)}>Remove encoding</button>
                            </div>
                            <details>
                              <summary>Additional options</summary>
                              <div className='def-property'>
                                <label>
                                  Aggregate
                                  <select value={propValue.aggregate ?? fieldDef.aggregate} onChange={(e) => onSelectEncodingProperty(visualUnitSpec, propName, 'aggregate', e.target.value)}>
                                    <option value=''>None</option>
                                    {
                                      aggregateOps.map(aggregateOp => {
                                        return (
                                          <option key={aggregateOp} value={aggregateOp}>{aggregateOp}</option>
                                        )
                                      })
                                    }
                                  </select>
                                </label>
                              </div>
                              {
                                fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' ? (
                                  <div className='def-property'>
                                    <label>
                                      Bin
                                      <input type='checkbox' checked={propValue.bin ?? fieldDef.bin} onChange={(e) => onSelectEncodingProperty(visualUnitSpec, propName, 'bin', e.target.checked)}/>
                                    </label>
                                  </div>
                                ) : null
                              }
                              {
                                fieldDef.type === 'temporal' ? (
                                  <div className='def-property'>
                                    <label>
                                      Time unit
                                      <select value={propValue.timeUnit ?? fieldDef.timeUnit} onChange={(e) => onSelectEncodingProperty(visualUnitSpec, propName, 'timeUnit', e.target.value)}>
                                        <option value=''>None</option>
                                        {
                                          timeUnits.map(timeUnit => {
                                            return (
                                              <option key={timeUnit} value={timeUnit}>{timeUnit}</option>
                                            )
                                          })
                                        }
                                      </select>
                                    </label>
                                  </div>
                                ) : null
                              }
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
        {
          visualUnitSpecs.length > 1 ? (
            <div className='def-property'>
              <label>
                Composition
                <select value={visualComposition} onChange={(e) => onSelectComposition('visual', e.target.value)}>
                  <option value='layer'>layer</option>
                  <option value='concat'>concat</option>
                </select>
                </label>
            </div>
          ) : null
        }
      </div>

      <div role='tabpanel' id='tabpanel-audio' aria-labelledby='tab-audio' hidden={tab !== 'audio'}>
        <h3>Audio</h3>
        {
          audioUnitSpecs.map((audioUnitSpec) => {
            return (
              <div className='unit-spec' key={audioUnitSpec.name}>
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
                        const fieldDef = fields.find(field => field.name === propValue.field);
                        return (
                          <div key={`${propName}-${audioUnitSpec.name}`}>
                            <h6 className='encoding-name'>{propName}</h6>
                            <div className='unit-encoding-def'>
                              <span>{propValue.aggregate ? `${propValue.aggregate} ` : null}{propValue.field}{propValue.timeUnit ? ` (${propValue.timeUnit})` : null}</span>
                              <button id={`encoding-${audioUnitSpec.name}-${propName}`} onClick={() => jumpToField(propValue.field, propName)}>Go to field</button>
                              <button onClick={() => removeEncoding(audioUnitSpec, propName)}>Remove encoding</button>
                            </div>
                            <details>
                              <summary>Additional options</summary>
                              <div className='def-property'>
                                <label>
                                  Aggregate
                                  <select value={propValue.aggregate ?? fieldDef.aggregate} onChange={(e) => onSelectEncodingProperty(audioUnitSpec, propName, 'aggregate', e.target.value)}>
                                    <option value=''>None</option>
                                    {
                                      aggregateOps.map(aggregateOp => {
                                        return (
                                          <option key={aggregateOp} value={aggregateOp}>{aggregateOp}</option>
                                        )
                                      })
                                    }
                                  </select>
                                </label>
                              </div>
                              {
                                fieldDef.type === 'temporal' ? (
                                  <div className='def-property'>
                                    <label>
                                      Time unit
                                      <select value={propValue.timeUnit ?? fieldDef.timeUnit} onChange={(e) => onSelectEncodingProperty(audioUnitSpec, propName, 'timeUnit', e.target.value)}>
                                        <option value=''>None</option>
                                        {
                                          timeUnits.map(timeUnit => {
                                            return (
                                              <option key={timeUnit} value={timeUnit}>{timeUnit}</option>
                                            )
                                          })
                                        }
                                      </select>
                                    </label>
                                  </div>
                                ) : null
                              }

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
                        const fieldDef = fields.find(field => field.name === traversal.field);
                        return (
                          <div className='enc-def' key={`${traversal.field}-${audioUnitSpec.name}`}>
                            <div className='unit-encoding-def'>
                              <span><span>{traversal.bin ? `binned ` : null}{traversal.field}{traversal.timeUnit ? ` (${traversal.timeUnit})` : null}</span></span>
                              <button>Go to field</button>
                              <button onClick={() => removeTraversal(audioUnitSpec, traversal.field)}>Remove traversal</button>
                            </div>
                            {/* <div className='def-property'>
                              <div className='def-property-label'>Mode:</div>
                              <div className='def-property-col'>
                                <select value={traversal.mode} onChange={(e) => onSelectTraversalProperty(traversal, audioUnitSpec.name, 'mode', e.target.value)}>
                                  {
                                    traversalModes.map(traversalMode => {
                                      return (
                                        <option value={traversalMode}>{traversalMode}</option>
                                      )
                                    })
                                  }
                                </select>
                              </div>
                            </div> */}
                            <details>
                              <summary>Additional options</summary>
                              {
                                fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' ? (
                                  <div className='def-property'>
                                    <label>
                                      Bin
                                      <input type='checkbox' checked={traversal.bin ?? fieldDef.bin} onChange={(e) => onSelectTraversalProperty(traversal, audioUnitSpec.name, 'bin', e.target.checked)}/>
                                    </label>
                                  </div>
                                ) : null
                              }
                              {
                                fieldDef.type === 'temporal' ? (
                                  <div className='def-property'>
                                    <label>
                                      Time unit
                                      <select value={traversal.timeUnit ?? fieldDef.timeUnit} onChange={(e) => onSelectTraversalProperty(traversal, audioUnitSpec.name, 'timeUnit', e.target.value)}>
                                        <option value=''>None</option>
                                        {
                                          timeUnits.map(timeUnit => {
                                            return (
                                              <option key={timeUnit} value={timeUnit}>{timeUnit}</option>
                                            )
                                          })
                                        }
                                      </select>
                                    </label>
                                  </div>
                                ) : null
                              }
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
                    {
                      Object.keys(audioUnitSpec.encoding).length && audioUnitSpec.traversal.length + new Set(Object.values(audioUnitSpec.encoding).map(e => e.field)).size < fields.length ?
                      (
                        <div>
                          <div className='def-property-add'>Add traversal:</div>
                          <select value={unitTraversalSelectValues[audioUnitSpec.name]} onChange={(e) => onSelectTraversal(audioUnitSpec.name, e.target.value)}>
                            {
                              fields.filter(field => {
                                return !audioUnitSpec.traversal.find(traversal => traversal.field === field.name) && !Object.values(audioUnitSpec.encoding).find((def: AudioEncodingFieldDef) => def.field === field.name);
                              }).map(field => {
                                return (
                                  <option key={field.name} value={field.name}>{field.name}</option>
                                )
                              })
                            }
                          </select>
                          <button onClick={() => addTraversal(audioUnitSpec.name)}>Add</button>
                        </div>
                      ) : null
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
        {
          audioUnitSpecs.length > 1 ? (
            <div className='def-property'>
              <label>
                Composition
                <select value={audioComposition} onChange={(e) => onSelectComposition('audio', e.target.value)}>
                  <option value='concat'>concat</option>
                  <option value='layer'>layer</option>
                </select>
                </label>
            </div>
          ) : null
        }
      </div>
    </div>
  );

}, (prevProps, nextProps) => {
  return prevProps.initialSpec === nextProps.initialSpec
});

export default UmweltEditor;
