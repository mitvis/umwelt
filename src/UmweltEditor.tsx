import React, { useEffect, useRef, useState } from 'react';
import { AudioEncoding, AudioEncodingFieldDef, AudioPropName, AudioTraversalFieldDef, AudioUnitSpec, EncodingPropName, EncodingRef, FieldDef, NONE, UmweltSpec, ViewComposition, VisualEncoding, VisualEncodingFieldDef, VisualPropName, VisualUnitSpec } from './grammar';
import { OlliDataset } from 'olli';
import { cleanData, getData, getDomain, typeCoerceData } from './utils/data';
import { elaborateFields, inferKey, inferUnitsFromKeys } from './utils/inference';
import dayjs from 'dayjs';

import './UmweltEditor.css'
import { nodeIsTextInput } from './utils/events';
import { isNumeric } from './utils/values';
import { isString } from 'vega';

interface EditorProps {
  initialSpec: UmweltSpec;
  onSpec: (spec: UmweltSpec, data: OlliDataset) => void;
}

const UmweltEditor = React.memo(({ initialSpec, onSpec }: EditorProps) => {

  const [tab, setTab] = useState<'data' | 'fields' | 'visual' | 'audio'>('data');
  const [dataUrlInput, setDataUrlInput] = useState<string>('stocks.csv');
  const [dataUrl, setDataUrl] = useState<string>();
  const [data, setData] = useState<OlliDataset>([]);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [allFields, _setAllFields] = useState<FieldDef[]>([]);
  const setAllFields = (fields) => {
    const initFields = fields.map(field => {
      if (!field.encodings) {
        field.encodings = [];
      }
      return field;
    });
    _setAllFields(initFields);
    if (!initialSpecIsResolving.current) {
      setFields(initFields);
    }
  }
  const [key, setKey] = useState<string[]>([]);
  const [visualUnitSpecs, setVisualUnitSpecs] = useState<VisualUnitSpec[]>([]);
  const [audioUnitSpecs, setAudioUnitSpecs] = useState<AudioUnitSpec[]>([]);
  const [visualComposition, setVisualComposition] = useState<ViewComposition>('layer');
  const [audioComposition, setAudioComposition] = useState<ViewComposition>('concat');
  const [unitTraversalSelectValues, setUnitTraversalSelectValues] = useState<{[unitName: string]: string}>({});
  const lastFocused = useRef<HTMLElement>();
  const initialSpecIsResolving = useRef<boolean>(false);


  const visualPropNames: VisualPropName[] = ['x', 'y', 'color', 'shape', 'size', 'opacity', 'order', 'facet'];
  const audioPropNames: AudioPropName[] = ['pitch', 'duration', 'volume'];
  const commonPropNames = ['x', 'y', 'color', 'pitch'].reverse();
  const propertyNames: EncodingPropName[] = (visualPropNames as EncodingPropName[]).concat(audioPropNames).sort((a, b) => {
    const aIndex = commonPropNames.indexOf(a);
    const bIndex = commonPropNames.indexOf(b);
    return bIndex - aIndex;
  });
  const markTypes = ['point', 'line', 'bar', 'area'];
  const aggregateOps = ['mean', 'median', 'min', 'max', 'sum', 'count'];
  const timeUnits = ['year', 'month', 'yearmonth', 'day', 'date', 'hours', 'minutes', 'seconds'];
  const vegaDatasets = ['stocks.csv', 'cars.json', 'weather.csv', 'seattle-weather.csv', 'penguins.json', 'driving.json', 'barley.json', 'disasters.csv', 'gapminder.json'];
  const umweltDatasets = ['phoenix_chicago_temp.csv'];

  const assignablePropertyNames = (): string[] => {
    return propertyNames.filter(propName => {
      if (visualPropNames.includes(propName as VisualPropName)) {
        return visualUnitSpecs.some(spec => !spec.encoding[propName]);
      }
      else if (audioPropNames.includes(propName as AudioPropName)) {
        return audioUnitSpecs.some(spec => !spec.encoding[propName]);
      }
      return false;
    })
  }

  const assignableUnitsForProperty = (propName: string): string[] => {
    if (visualPropNames.includes(propName as VisualPropName)) {
      return visualUnitSpecs.filter(spec => !spec.encoding[propName]?.field).map(spec => spec.name);
    }
    else if (audioPropNames.includes(propName as AudioPropName)) {
      return audioUnitSpecs.filter(spec => !spec.encoding[propName]?.field).map(spec => spec.name);
    }
  }

  const assignableMtypes = (field: FieldDef) => {
    const mtypes = ['nominal', 'ordinal'];
    const domain = getDomain({...field, field: field.name}, data);
    if (domain.every(v => dayjs(v).isValid())) {
      mtypes.push('temporal')
    }
    if (domain.every(v => v ? Number(v) === v || (isString(v) && isNumeric(v)) : true)) {
      mtypes.push('quantitative');
    }
    return mtypes;
  }

  useEffect(() => {
    if (initialSpec) {
      initialSpecIsResolving.current = true;
      if ('url' in initialSpec.data) {
        const match = vegaDatasets.find(dataset => 'url' in initialSpec.data && initialSpec.data.url.endsWith('/' + dataset));
        if (match) {
          setDataUrlInput(match);
        }
        setDataUrl(initialSpec.data.url);
      }
      if (initialSpec.fields) {
        setFields(initialSpec.fields);
      }
      if (initialSpec.key) {
        setKey(initialSpec.key);
      }
      if (initialSpec.visual) {
        setVisualUnitSpecs(initialSpec.visual.units);
        setVisualComposition(initialSpec.visual.composition);
      }
      if (initialSpec.audio) {
        setAudioUnitSpecs(initialSpec.audio.units);
        setAudioComposition(initialSpec.audio.composition);
      }

    }
  }, [initialSpec])

  useEffect(() => {
    if (initialSpecIsResolving.current) {
      if (
        initialSpec.fields.every(f => fields.find(field => field.name === f.name)) && fields.every(f => initialSpec.fields.find(field => field.name === f.name)) &&
        (!initialSpec.visual || (initialSpec.visual.units.every(u => visualUnitSpecs.find(unit => unit.name === u.name)))) &&
        (!initialSpec.audio || (initialSpec.audio.units.every(u => audioUnitSpecs.find(unit => unit.name === u.name)))) &&
        initialSpec.key.length === key.length && initialSpec.key.every(k => key.includes(k)) &&
        (!initialSpec.visual || initialSpec.visual.composition === visualComposition) &&
        (!initialSpec.audio || initialSpec.audio.composition === audioComposition)
      ) {
        setTimeout(() => {
          initialSpecIsResolving.current = false;
        }, 5000); // TODO this is bullshit i need to switch to redux
      }
    }
  }, [initialSpec, fields, key, visualUnitSpecs, audioUnitSpecs, visualComposition, audioComposition])

  useEffect(() => {
    if (data && data.length > 0) {
      onSpec({
        data: {
          url: dataUrl,
        },
        key,
        fields,
        visual: {
          units: visualUnitSpecs,
          composition: visualComposition
        },
        audio: {
          units: audioUnitSpecs,
          composition: audioComposition
        }
      }, data);
    }
  }, [data, fields, key, visualUnitSpecs, audioUnitSpecs, onSpec, dataUrl, visualComposition, audioComposition]);

  const onDataUrlInput = () => {
    const value = (document.querySelector('.input-data') as HTMLInputElement).value;
    setDataUrlInput(value);
  };

  useEffect(() => {
    const filePathRegex = /^(?:(?:https?|http):\/\/[^\s/$.?#].[^\s]*\.(?:json|csv)|[\w-.]+(?:\.(?:json|csv))?)$/;
    if (filePathRegex.test(dataUrlInput)) {
      if (vegaDatasets.includes(dataUrlInput)) {
        setDataUrl(`https://raw.githubusercontent.com/vega/vega-datasets/master/data/${dataUrlInput}`);
      }
      else if (umweltDatasets.includes(dataUrlInput)) {
        setDataUrl(`https://mitvis.github.io/umwelt/data/${dataUrlInput}`);
      }
      else {
        setDataUrl(dataUrlInput);
      }
    }
  }, [dataUrlInput]);

  useEffect(() => {
    if (dataUrl) {
      getData({url: dataUrl}).then(data => {
        if (data && data.length) {
          setData(data);
        }
      });
    }
  }, [dataUrl]);

  useEffect(() => {
    if (data && data.length > 0) {
      const nextAllFields = Object.keys(data[0]).map(name => {
        return {
          name
        }
      })
      if (!initialSpecIsResolving.current) {
        if (!(allFields.length === Object.keys(data[0]).length && allFields.every(field => Object.keys(data[0]).includes(field.name)))) {
          // reset spec for new data
          setVisualUnitSpecs([{
            name: 'vis_unit_0',
            mark: 'point',
            encoding: {
            }
          }]);
          setAudioUnitSpecs([{
            name: 'audio_unit_0',
            encoding: {
            },
            traversal: []
          }]);
          //
          const elaboratedFields = elaborateFields(nextAllFields, data);
          setAllFields(elaboratedFields);
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
      else if (!(initialSpec.fields.every(f => allFields.find(field => f.name === field.name))) && initialSpec.fields.every(f => nextAllFields.find(field => f.name === field.name))) {
        const elaboratedFields = elaborateFields(nextAllFields, data);
        setAllFields(elaboratedFields);
      }
    }
  }, [data]);

  useEffect(() => {
    const typedData = typeCoerceData(data, fields);
    const niceData = cleanData(typedData, fields);
    setData(niceData);

    const doInferKey = async () => {
      const nextKey = await inferKey(fields, niceData);
      if (!(key.length === nextKey.length && key.every((k) => nextKey.includes(k)))) {
        setKey(nextKey);
      }
    }

    if (!initialSpecIsResolving.current) {
      doInferKey();
    }
  }, [fields]);

  useEffect(() => {
    let didChange = false;
    const nextVisualUnitSpecs = structuredClone(visualUnitSpecs);
    visualUnitSpecs?.forEach((unit, i) => {
      const xField = fields.find(f => unit.encoding.x?.field === f.name);
      const yField = fields.find(f => unit.encoding.y?.field === f.name);
      const orderField = fields.find(f => unit.encoding.order?.field === f.name);
      if (!orderField && xField && yField && xField.type === 'quantitative' && yField.type === 'quantitative' && unit.mark !== 'point') {
        nextVisualUnitSpecs[i].mark = 'point';
        didChange = true;
      }
    });
    if (didChange) {
      setVisualUnitSpecs(nextVisualUnitSpecs);
    }
  }, [visualUnitSpecs])

  const doInference = (keyFieldDefs, valueFieldDefs) => {
    const inference = inferUnitsFromKeys(keyFieldDefs, valueFieldDefs, data);
    if (inference && (inference.audio || inference.visual)) {
      const nextFields = structuredClone(fields);
      nextFields.forEach(fieldDef => {
        fieldDef.encodings = [];
      })
      if (inference && inference.visual) {
        setVisualUnitSpecs(inference.visual.units);
        setVisualComposition(inference.visual.composition);
        inference.visual.units.forEach(unit => {
          Object.entries(unit.encoding).forEach(([propName, encFieldDef]) => {
            const field = encFieldDef.field;
            const encodingRef: EncodingRef = {property: propName as any, unit: unit.name};
            const fieldDef = nextFields.find(f => f.name === field);
            fieldDef.encodings.push(encodingRef);
          });
        });
      }
      if (inference && inference.audio) {
        setAudioUnitSpecs(inference.audio.units);
        setAudioComposition(inference.audio.composition);
        inference.audio.units.forEach(unit => {
          Object.entries(unit.encoding).forEach(([propName, encFieldDef]) => {
            const field = encFieldDef.field;
            const encodingRef: EncodingRef = {property: propName as any, unit: unit.name};
            const fieldDef = nextFields.find(f => f.name === field);
            fieldDef.encodings.push(encodingRef);
          });
        });
      }
      setFields(nextFields);
    }
  }

  useEffect(() => {
    if (!initialSpecIsResolving.current) {
      const keyFieldDefs = fields.filter(field => key.includes(field.name));
      const valueFieldDefs = fields.filter(field => !key.includes(field.name));
      doInference(keyFieldDefs, valueFieldDefs);
    }
  }, [key, fields.length]);

  const toggleField = (fieldName: string, shouldUse: boolean) => {
    if (shouldUse && !fields.find(field => field.name === fieldName)) {
      setFields([...fields, {...allFields.find(field => field.name === fieldName), encodings: []}]);
    }
    else if (!shouldUse && fields.find(field => field.name === fieldName)) {
      setFields(fields.filter(field => field.name !== fieldName));
      // remove the field from all encodings and traversals
      const nextVisualUnitSpecs = structuredClone(visualUnitSpecs);
      const nextAudioUnitSpecs = structuredClone(audioUnitSpecs);
      nextVisualUnitSpecs.forEach(spec => {
        spec.encoding = Object.fromEntries(Object.entries(spec.encoding).filter(([_, encFieldDef]) => (encFieldDef as VisualEncodingFieldDef).field !== fieldName));
      });
      nextAudioUnitSpecs.forEach(spec => {
        spec.encoding = Object.fromEntries(Object.entries(spec.encoding).filter(([_, encFieldDef]) => (encFieldDef as AudioEncodingFieldDef).field !== fieldName));
        spec.traversal = spec.traversal.filter(traversal => traversal.field !== fieldName);
      });
      setVisualUnitSpecs(nextVisualUnitSpecs);
      setAudioUnitSpecs(nextAudioUnitSpecs);
    }
  }

  const onUploadDataFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList.length) {
      const file = fileList[0];
      const reader = new FileReader();

      reader.onload = function(loadedEvent) {
        // result contains loaded file.
        const contents = loadedEvent.target.result;
        try {
          const data = JSON.parse(contents as string);
          setData(data);
        } catch (e) {
          console.error('uploaded file was not successfully parsed as json')
        }
      }

      reader.readAsText(file);
    }
  }

  const onSelectType = (fieldDef, type) => {
    const newFields = fields.map(f => {
      if (f.name === fieldDef.name) {
        f.type = type;
      }
      return f;
    });
    setFields(newFields);
  }

  const onSelectEncoding = (fieldName, encodingRefIdx, propName) => {
    const fieldDef = structuredClone(fields.find(field => field.name === fieldName));
    const encodingRef = fieldDef.encodings[encodingRefIdx];
    const oldPropName = encodingRef.property;
    fieldDef.encodings[encodingRefIdx].property = propName;
    if (!assignableUnitsForProperty(propName).includes(encodingRef.unit)) {
      fieldDef.encodings[encodingRefIdx].unit = assignableUnitsForProperty(propName)[0];
      onSelectUnit(fieldName, encodingRefIdx, fieldDef.encodings[encodingRefIdx].unit);
    }
    if ((visualPropNames.includes(propName) && !visualUnitSpecs.find(spec => spec.name === encodingRef.unit)) ||
        (audioPropNames.includes(propName) && !audioUnitSpecs.find(spec => spec.name === encodingRef.unit))) {
      fieldDef.encodings[encodingRefIdx].unit = assignableUnitsForProperty(propName)[0];
      onSelectUnit(fieldName, encodingRefIdx, fieldDef.encodings[encodingRefIdx].unit);
    }
    const newFields = fields.map(f => {
      if (f.name === fieldName) {
        return fieldDef;
      }
      return f;
    });
    setFields(newFields);

    if (visualPropNames.includes(propName)) {
      const unit = visualUnitSpecs.find(spec => spec.name === fieldDef.encodings[encodingRefIdx].unit)
      unit.encoding[propName] = structuredClone(unit.encoding[oldPropName]);
      delete unit.encoding[oldPropName];
      setVisualUnitSpecs(visualUnitSpecs.map(spec => {
        if (spec.name === unit.name) {
          return unit;
        }
        return spec;
      }));
    }
    else if (audioPropNames.includes(propName)) {
      const unit = audioUnitSpecs.find(spec => spec.name === fieldDef.encodings[encodingRefIdx].unit)
      unit.encoding[propName] = structuredClone(unit.encoding[oldPropName]);
      delete unit.encoding[oldPropName];

      // const newTraversal = structuredClone(unit.traversal).filter(traversal => traversal.field !== fieldName);
      // fields.slice().forEach(fieldDef => {
      //   if (!Object.values(unit.encoding).find((def: any) => def.field === fieldDef.name) && !newTraversal.find(traversal => traversal.field === fieldDef.name)) {
      //     newTraversal.push({
      //       field: fieldDef.name,
      //     });
      //   }
      // });
      // unit.traversal = newTraversal;

      setAudioUnitSpecs(audioUnitSpecs.map(spec => {
        if (spec.name === unit.name) {
          return unit;
        }
        return spec;
      }));
    }
  }

  const onSelectUnit = (fieldName, encodingRefIdx, unitName) => {
    const fieldDef = structuredClone(fields.find(field => field.name === fieldName));
    const oldUnitName = fieldDef.encodings[encodingRefIdx].unit;
    fieldDef.encodings[encodingRefIdx].unit = unitName;
    const newFields = fields.map(f => {
      if (f.name === fieldName) {
        return fieldDef;
      }
      return f;
    });
    setFields(newFields);

    const oldUnit = visualUnitSpecs.find(spec => spec.name === oldUnitName) || audioUnitSpecs.find(spec => spec.name === oldUnitName);
    const newUnit = visualUnitSpecs.find(spec => spec.name === unitName) || audioUnitSpecs.find(spec => spec.name === unitName);
    const propName = fieldDef.encodings[encodingRefIdx].property;
    newUnit.encoding[propName] = structuredClone(oldUnit.encoding[propName]);
    delete oldUnit.encoding[propName];
    if ('mark' in newUnit) {
      setVisualUnitSpecs(visualUnitSpecs.map(spec => {
        if (spec.name === newUnit.name) {
          return newUnit;
        }
        return spec;
      }));
    }
    else if ('traversal' in newUnit) {
      setAudioUnitSpecs(audioUnitSpecs.map(spec => {
        if (spec.name === newUnit.name) {
          return newUnit;
        }
        return spec;
      }));
    }
  }

  const onSelectTraversal = (unitName, fieldName) => {
    const audioUnitSpec = audioUnitSpecs.find(spec => spec.name === unitName);
    fieldName = fieldName || fields.find(field => {
      return !audioUnitSpec.traversal.find(traversal => traversal.field === field.name) && !Object.values(audioUnitSpec.encoding).find((def: AudioEncodingFieldDef) => def.field === field.name);
    })?.name
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
    newEncoding[encPropName][propName] = value;
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
    const validPropNames = assignablePropertyNames();
    let propName: string;
    if (field.type === 'quantitative') {
      propName = ['y', 'x', 'pitch', 'volume', 'opacity', 'size', 'duration'].find(propName => validPropNames.includes(propName)) || validPropNames[0];
    }
    else if (field.type === 'temporal') {
      propName = ['x', 'y', 'pitch', 'volume', 'opacity', 'size', 'duration'].find(propName => validPropNames.includes(propName)) || validPropNames[0];
    }
    else if (field.type === 'nominal' || field.type === 'ordinal') {
      propName = ['color', 'shape'].find(propName => validPropNames.includes(propName)) || validPropNames[0];
    }
    const unitName: string = assignableUnitsForProperty(propName)[0];
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
      const unit = visualUnitSpecs.find(spec => spec.name === unitName);
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
      const unit = audioUnitSpecs.find(spec => spec.name === unitName);
      const newEncoding = structuredClone(unit.encoding);

      if (newEncoding[propName] && newEncoding[propName].field !== field.name) {
        removeEncodingReference(propName, unitName, newEncoding[propName].field);
      }
      newEncoding[propName] = {
        field: field.name,
      };

      const newTraversal = structuredClone(unit.traversal).filter(traversal => traversal.field !== field.name);
      if (key.length) {
        key.forEach(field => {
          if (!newTraversal.find(traversal => traversal.field === field)) {
            newTraversal.push({
              field
            });
          }
        });
      }
      else if (visualUnitSpecs.length) {
        const visSpec = visualUnitSpecs.find(spec => 'x' in spec.encoding && spec.encoding.x);
        if (visSpec) {
          if (!newTraversal.find(traversal => traversal.field === visSpec.encoding.x.field)) {
            newTraversal.push({
              field: visSpec.encoding.x.field
            });
          }
        }
      }

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

  const removeEncodingReference = (propName: string, unitName: string, fieldName: string) => {
    const newFields = fields.map(f => {
      if (f.name === fieldName) {
        f.encodings = f.encodings.filter(e => !(e.property === propName && e.unit === unitName));
      }
      return f;
    });
    setFields(newFields);
  }

  const removeEncodingFromField = (field: string, encodingRef: EncodingRef) => {
    const unit = audioUnitSpecs.find(spec => spec.name === encodingRef.unit) || visualUnitSpecs.find(spec => spec.name === encodingRef.unit);
    removeEncodingReference(encodingRef.property, unit.name, field);
    const newEncoding = structuredClone(unit.encoding);
    delete newEncoding[encodingRef.property];
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

  const removeEncoding = (unitSpec: VisualUnitSpec | AudioUnitSpec, propName) => {
    const encodingFieldDef = unitSpec.encoding[propName];
    removeEncodingReference(propName, unitSpec.name, encodingFieldDef.field);
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
    const nextFields = structuredClone(fields);
    let didEditFields = false;
    if ('mark' in specs[0]) {
      const nextId = visualUnitSpecs.map(spec => parseInt(spec.name.split('_')[2])).reduce((a, b) => Math.max(a, b), 0) + 1;
      const nextSpecs = [...visualUnitSpecs, {
        name: `vis_unit_${nextId}`,
        mark: visualUnitSpecs[visualUnitSpecs.length - 1].mark,
        encoding: {
        }
      } as VisualUnitSpec];
      key.forEach(fieldName => {
        const lastSpec = visualUnitSpecs[visualUnitSpecs.length - 1];
        const keyEnc = Object.entries(lastSpec.encoding).find(([propName, encFieldDef]) => encFieldDef.field === fieldName);
        if (keyEnc) {
          const [propName, encFieldDef] = keyEnc;
          const lastNextSpec = nextSpecs[nextSpecs.length - 1];
          if (encFieldDef) {
            lastNextSpec.encoding[propName] = structuredClone(encFieldDef);
          }
          const encodingRef: EncodingRef = {property: propName as any, unit: lastNextSpec.name};
          const fieldDef = nextFields.find(f => f.name === fieldName);
          if (fieldDef) {
            if (!fieldDef.encodings) {
              fieldDef.encodings = [];
            }
            if (!fieldDef.encodings.find(enc => enc.property === propName && enc.unit === lastNextSpec.name)) {
              fieldDef.encodings.push(encodingRef);
              didEditFields = true;
            }
          }
        }
      });
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
      key.forEach(fieldName => {
        const lastSpec = audioUnitSpecs[visualUnitSpecs.length - 1];
        const keyTraversal = lastSpec.traversal.find(traversal => traversal.field === fieldName);
        if (keyTraversal) {
          nextSpecs[nextSpecs.length - 1].traversal.push(keyTraversal);
        }
      });
      setAudioUnitSpecs(nextSpecs);
    }
    if (didEditFields) {
      setFields(nextFields);
    }
  }

  const removeUnit = (unitSpec: VisualUnitSpec | AudioUnitSpec) => {
    Object.keys(unitSpec.encoding).forEach(propName => {
      removeEncodingReference(propName, unitSpec.name, unitSpec.encoding[propName].field);
    });
    if ('mark' in unitSpec) {
      setVisualUnitSpecs(visualUnitSpecs.filter(spec => spec.name !== unitSpec.name));
    }
    else if ('traversal' in unitSpec) {
      setAudioUnitSpecs(audioUnitSpecs.filter(spec => spec.name !== unitSpec.name));
    }
  }

  const jumpToEncodingRef = (encodingRef: EncodingRef) => {
    if (visualUnitSpecs.find(spec => spec.name === encodingRef.unit)) {
      setTab('visual');
    }
    else if (audioUnitSpecs.find(spec => spec.name === encodingRef.unit)) {
      setTab('audio');
    }
    setTimeout(() => {
      const domId = `encoding-${encodingRef.unit}-${encodingRef.property}`;
      const element = document.getElementById(domId);
      if (element) {
        element.scrollIntoView({behavior: 'smooth'});
        element.focus();
      }
    }, 100);

  }

  const jumpToField = (fieldName: string, propName: string) => {
    setTab('fields');
    setTimeout(() => {
      const domId = `field-${fieldName}-${propName}`;
      const element = document.getElementById(domId);
      if (element) {
        element.scrollIntoView({behavior: 'smooth'});
        element.focus();
      }
    }, 100);
  }

  const onFocus = (e) => {
    lastFocused.current = e.target;
  }

  useEffect(() => {
    window.addEventListener('keydown', (e) => {
      if (!nodeIsTextInput((e as any).target)) {
        if (e.key === 'e') {
          if (lastFocused.current) {
            lastFocused.current.focus();
          }
          else {
            const elem = document.getElementById('tab-fields');
            if (elem) {
              elem.focus();
            }
          }
        }
      }
    });
  }, []);

  return (
    <div className='uw-structured-editor' onFocus={(e) => onFocus(e)} role="region" aria-labelledby='header-editor'>
      <div role='tablist'>
        <button role='tab' id='tab-data' aria-controls='tabpanel-data' aria-selected={tab === 'data'} onClick={() => setTab('data')}>Data</button>
        <button role='tab' id='tab-fields' aria-controls='tabpanel-fields' aria-selected={tab === 'fields'} onClick={() => setTab('fields')} disabled={!(data && fields.length)}>Fields</button>
        <button role='tab' id='tab-visual' aria-controls='tabpanel-visual' aria-selected={tab === 'visual'} onClick={() => setTab('visual')} disabled={!(data && fields.length)}>Visual</button>
        <button role='tab' id='tab-audio' aria-controls='tabpanel-audio' aria-selected={tab === 'audio'} onClick={() => setTab('audio')} disabled={!(data && fields.length)}>Audio</button>
      </div>

      <div role='tabpanel' id='tabpanel-data' aria-labelledby='tab-data' hidden={tab !== 'data'}>
        <h3>Data</h3>
        {/* <input aria-labelledby='uw-data' list='vega-datasets-list' type="text" className="input-data" value={dataUrlInput} onChange={onDataUrlInput} required></input>
        <datalist id="vega-datasets-list">
          {
            vegaDatasets.map(url => {
              return (
                <option key={url} value={url}>{url}</option>
              )
            })
          }
          {
            umweltDatasets.map(url => {
              return (
                <option key={url} value={url}>{url}</option>
              )
            })
          }
        </datalist> */}
        <div>
          <label>
            Choose example dataset<br/>
            <select value={dataUrlInput} className="input-data" onChange={onDataUrlInput} required>
              {
                vegaDatasets.map(url => {
                  return (
                    <option key={url} value={url}>{url}</option>
                  )
                })
              }
              {
                umweltDatasets.map(url => {
                  return (
                    <option key={url} value={url}>{url}</option>
                  )
                })
              }
            </select>
          </label>
        </div>
        <p>
          or
        </p>
        <div>
          <label>
            Upload JSON file <br/>
            <input type="file" onChange={(e) => onUploadDataFile(e)} ></input>
          </label>
        </div>
      </div>

      <div role='tabpanel' id='tabpanel-fields' aria-labelledby='tab-fields' hidden={tab !== 'fields'}>
        <h3>Fields</h3>

        <div className='unit-spec'>
          <div className='def-property-label'>Select fields:</div>
          <div className='def-property-col'>
            {
              allFields.map((field) => {
                return (
                  <div key={field.name}>
                    <label>
                      <input type='checkbox' checked={fields.find(f => f.name === field.name) !== undefined} onChange={(e) => toggleField(field.name, e.target.checked)}/> {field.name}
                    </label>
                  </div>
                )
              })
            }
          </div>
        </div>

        <div className='def-property'>
          <div className='def-property-label'>Key:</div>
          <div className='def-property-col' aria-live="polite">
            {/* {
              key?.length < fields?.length - 1 ?
              (
                <button onClick={() => addKey()}>Add field to key</button>
              ) : null
            } */}
            <div>
              {
                key?.length ? (
                  key.map((fieldName) => {
                    return (
                      <div key={fieldName}>
                        {fieldName}
                      </div>
                    )
                  })
                ) : 'None'
              }
            </div>
          </div>
        </div>
        {
          fields.map(field => {
            return (
              <div className='field-def' key={field.name}>
                <h5 id={`label-${field.name}`} className='def-name'>{field.name}</h5>
                <div className='def-property'>
                  <label>
                    Type
                    <select aria-describedby={`label-${field.name}`} value={field.type} onChange={(e) => onSelectType(field, e.target.value)}>
                        {
                          assignableMtypes(field).map(mtype => {
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
                  <div className='def-property-col' aria-live="polite">
                    {/* {
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
                            <button onClick={() => removeEncodingFromField(field.name, encodingRef)}>Remove encoding</button>
                          </div>
                        )
                      })
                    } */}
                    {
                      field.encodings.length < propertyNames.length ?
                      (
                        <button aria-describedby={`label-${field.name}`} onClick={() => addEncoding(field)}>Add encoding</button>
                      ) : null
                    }
                    {
                      [...field.encodings].reverse().map((encodingRef, idx) => {
                        const reversedIdx = field.encodings.length - idx - 1;
                        return (
                          <div key={`${encodingRef.property}-${encodingRef.unit}`}>
                            <select aria-describedby={`label-${field.name}`} value={encodingRef.property} onChange={(e) => onSelectEncoding(field.name, reversedIdx, e.target.value)}>
                              {
                                !assignablePropertyNames().includes(encodingRef.property) ? (
                                  <option value={encodingRef.property}>{encodingRef.property}</option>
                                ) : null
                              }
                              {
                                assignablePropertyNames().map(propName => {
                                  return (
                                    <option key={propName} value={propName}>{propName}</option>
                                  )
                                })
                              }
                            </select>
                            {
                              ((visualPropNames.includes(encodingRef.property as any) && visualUnitSpecs.length > 1) ||
                               (audioPropNames.includes(encodingRef.property as any) && audioUnitSpecs.length > 1)) ? (
                                <select aria-describedby={`label-${field.name}`} value={encodingRef.unit} onChange={(e) => onSelectUnit(field.name, reversedIdx, e.target.value)}>
                                  {
                                    !assignableUnitsForProperty(encodingRef.property).includes(encodingRef.unit) ? (
                                      <option value={encodingRef.unit}>{encodingRef.unit}</option>
                                    ) : null
                                  }
                                  {
                                    assignableUnitsForProperty(encodingRef.property).map(unitName => {
                                      return (
                                        <option key={unitName} value={unitName}>{unitName}</option>
                                      )
                                    })
                                  }
                                </select>
                              ) : null
                            }
                            <button id={`field-${field.name}-${encodingRef.property}`} onClick={() => jumpToEncodingRef(encodingRef)}>Go to {visualPropNames.includes(encodingRef.property as any) ? 'visual' : 'audio'} tab</button>
                            <button onClick={() => removeEncodingFromField(field.name, encodingRef)}>Remove encoding</button>
                          </div>
                        )
                      })
                    }
                  </div>
                </div>
                <div>
                  {
                    (!key.includes(field.name) && field.type === 'quantitative') || field.type === 'quantitative' || field.type === 'temporal' ? (
                      <details>
                        <summary>Additional options</summary>
                        {
                          !key.includes(field.name) && field.type === 'quantitative' ? (
                            <div className='def-property'>
                              <label>
                                Aggregate
                                <select aria-describedby={`label-${field.name}`} value={field.aggregate} onChange={(e) => onSelectFieldProperty(field, 'aggregate', e.target.value)}>
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
                          ) : null
                        }
                        {
                          field.type === 'quantitative' || field.type === 'temporal' ? (
                            <div className='def-property'>
                              <label>
                                Bin
                                <input aria-describedby={`label-${field.name}`} type='checkbox' checked={field.bin} onChange={(e) => onSelectFieldProperty(field, 'bin', e.target.checked)}/>
                              </label>
                            </div>
                          ) : null
                        }
                        {
                          field.type === 'temporal' ? (
                            <div className='def-property'>
                              <label>
                                Time unit
                                <select aria-describedby={`label-${field.name}`} value={field.timeUnit} onChange={(e) => onSelectFieldProperty(field, 'timeUnit', e.target.value)}>
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
                        {/* <div className='def-property'>
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
                        </div> */}
                      </details>
                    ) : null
                  }
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
                              <span id={`label-${visualUnitSpec.name}-${propName}`}>{(propValue.bin ?? fieldDef.bin) ? `binned ` : null}{(propValue.aggregate ?? fieldDef.aggregate) && propValue.aggregate as any !== NONE ? `${propValue.aggregate ?? fieldDef.aggregate} ` : null}{propValue.field}{(propValue.timeUnit ?? fieldDef.timeUnit) && propValue.timeUnit !== NONE ? ` (${propValue.timeUnit ?? fieldDef.timeUnit})` : null}</span>
                              <button aria-describedby={`label-${visualUnitSpec.name}-${propName}`} id={`encoding-${visualUnitSpec.name}-${propName}`} onClick={() => jumpToField(propValue.field, propName)}>Go to fields tab</button>
                              <button aria-describedby={`label-${visualUnitSpec.name}-${propName}`} onClick={() => removeEncoding(visualUnitSpec, propName)}>Remove encoding</button>
                            </div>
                            {
                              (!key.includes(fieldDef.name) && fieldDef.type === 'quantitative') || fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' ? (
                                <details>
                                  <summary>Additional options</summary>
                                  {
                                    !key.includes(fieldDef.name) && fieldDef.type === 'quantitative' ? (
                                      <div className='def-property'>
                                        <label>
                                          Aggregate
                                          <select value={propValue.aggregate ?? fieldDef.aggregate} onChange={(e) => onSelectEncodingProperty(visualUnitSpec, propName, 'aggregate', e.target.value)}>
                                            <option value={NONE}>None</option>
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
                                    ) : null
                                  }
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
                                            <option value={NONE}>None</option>
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
                                  {/* {
                                    propName === 'color' ? (
                                      <div className='def-property'>
                                        <details>
                                          <summary>Scale</summary>
                                          <label>
                                            Scheme
                                            <select></select>
                                          </label>
                                        </details>
                                      </div>
                                    ) : null
                                  } */}
                                  {/*
                                  <div className='def-property'>
                                    <label>
                                      Sort
                                      (todo: ascending, descending, by encoding, by field, etc)
                                    </label>
                                  </div> */}
                                </details>
                              ) : null
                            }
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
                              <span id={`label-${audioUnitSpec.name}-${propName}`}>{(propValue.aggregate ?? fieldDef.aggregate) && propValue.aggregate as any !== NONE ? `${propValue.aggregate ?? fieldDef.aggregate} ` : null}{propValue.field}</span>
                              <button aria-describedby={`label-${audioUnitSpec.name}-${propName}`} id={`encoding-${audioUnitSpec.name}-${propName}`} onClick={() => jumpToField(propValue.field, propName)}>Go to fields tab</button>
                              <button aria-describedby={`label-${audioUnitSpec.name}-${propName}`} onClick={() => removeEncoding(audioUnitSpec, propName)}>Remove encoding</button>
                            </div>
                            {
                              !key.includes(fieldDef.name) && fieldDef.type === 'quantitative' ? (
                                <details>
                                  <summary>Additional options</summary>
                                  {
                                    !key.includes(fieldDef.name) && fieldDef.type === 'quantitative' ? (
                                      <div className='def-property'>
                                        <label>
                                          Aggregate
                                          <select value={propValue.aggregate ?? fieldDef.aggregate} onChange={(e) => onSelectEncodingProperty(audioUnitSpec, propName, 'aggregate', e.target.value)}>
                                            <option value={NONE}>None</option>
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
                                    ) : null
                                  }
                                  {/* {
                                    fieldDef.type === 'temporal' ? (
                                      <div className='def-property'>
                                        <label>
                                          Time unit
                                          <select value={propValue.timeUnit ?? fieldDef.timeUnit} onChange={(e) => onSelectEncodingProperty(audioUnitSpec, propName, 'timeUnit', e.target.value)}>
                                            <option value={NONE}>None</option>
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
                                  } */}

                                  {/* <div className='def-property'>
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
                                  </div> */}
                                </details>
                              ) : null
                            }
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
                              <span id={`label-${audioUnitSpec.name}-traversal-${traversal.field}`}>{(traversal.bin ?? fieldDef.bin) ? `binned ` : null}{traversal.field}{(traversal.timeUnit ?? fieldDef.timeUnit) && traversal.timeUnit !== NONE ? ` (${traversal.timeUnit ?? fieldDef.timeUnit})` : null}</span>
                              {/* <button onClick={() => jumpToField(traversal.field, propName)}>Go to field</button> */}
                              <button aria-describedby={`label-${audioUnitSpec.name}-traversal-${traversal.field}`} onClick={() => removeTraversal(audioUnitSpec, traversal.field)}>Remove traversal</button>
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
                                        <option value={NONE}>None</option>
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
                              {/* <div className='def-property'>
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
                              </div> */}
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
        {/* {
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
        } */}
      </div>
    </div>
  );

}, (prevProps, nextProps) => {
  return prevProps.initialSpec === nextProps.initialSpec
});

export default UmweltEditor;
