import { useCallback, useEffect, useState } from 'react';
import './App.css';
import Debounce from 'react-debounce-component';
import Umwelt from './Umwelt';
import { umwelt, UmweltOutput, UmweltSpec } from './grammar';
import JSONC from 'jsonc-simple-parser';
import { debounce } from 'vega';
import UmveltEditor from './UmweltEditor';

function App() {

  const specs = {
    "multi-line-date-symbol.uw.json": require('./specs/multi-line-date-symbol.uw.json'),
    "multi-line-symbol-date.uw.json": require('./specs/multi-line-symbol-date.uw.json'),
    "multi-line-mean-price.uw.json": require('./specs/multi-line-mean-price.uw.json'),
    "scatterplot-binned.uw.json": require('./specs/scatterplot-binned.uw.json'),
    "temperature-annotations.uw.json": require('./specs/temperature-annotations.uw.json'),
    "barley-facet.uw.json": require('./specs/barley-facet.uw.json'),
    "barley-facet-agg.uw.json": require('./specs/barley-facet-agg.uw.json'),
    "connected-scatterplot.uw.json": require('./specs/connected-scatterplot.uw.json'),
  }

  const [selectedSpec, setSelectedSpec] =
    // useState("temperature-annotations.uw.json");
    // useState("scatterplot-binned.uw.json");
    useState("multi-line-date-symbol.uw.json");
    // useState("multi-line-symbol-date.uw.json");
    // useState("multi-line-mean-price.uw.json");
    // useState("barley-facet.uw.json");
    // useState("barley-facet-agg.uw.json");
    // useState("connected-scatterplot.uw.json");

  const [textValue, setTextValue] = useState("");
  const [specValue, setSpecValue] = useState<UmweltSpec>();
  const [props, setProps] = useState<UmweltOutput>(null);

  useEffect(() => {
    const spec = specs[selectedSpec];
    setTextValue(JSON.stringify(spec, null, 2));
  }, [selectedSpec]);

  const onTextValue = useCallback(debounce(250, (textValue) => {
    try {
      const spec = JSONC.parse(textValue);
      setSpecValue(spec);
    }
    catch (e) {}
  }), []);

  useEffect(() => {
    onTextValue(textValue);
  }, [textValue]);

  // useEffect(() => {
  //   if (specValue) {
  //     umwelt(specValue).then((props) => {
  //       setProps(props);
  //     });
  //   }
  // }, [specValue]);

  function printableUwspec() {
    if (props) {
      const { data, ...uwspec } = props.uwSpec;
      return JSON.stringify(uwspec, null, 2);
    }
    return null;
  }

  return (
    <div className="App">
      <div className='column'>
      <UmveltEditor initialSpec={specs[selectedSpec]}></UmveltEditor>
      </div>
      {/* <div className='column' style={{flex: 2}}>
        <div>
          <div style={{fontWeight: 'bold'}}>Umwelt</div>
        </div>
        <Debounce ms={250}>
          {
            props ? (
              <Umwelt {...props} />
            ) : null
          }
        </Debounce>
      </div> */}
      <div className="column">
        <div style={{fontWeight: 'bold'}}>User-provided spec</div>
        <div>
        Choose spec: <select onChange={(e) => setSelectedSpec(e.target.value)} value={selectedSpec}>
          {
            Object.keys(specs).map(spec => {
              return <option key={spec} value={spec}>{spec.substring(0, spec.indexOf('.uw.json'))}</option>
            })
          }
        </select>
        </div><br/>
        {/* <textarea
            value={textValue}
            onChange={(e) => {setTextValue(e.target.value)}}
        /> */}
        <div className="logo" aria-hidden="true">
          <img src='/umwelt/umwelt.svg' />
        </div>
      </div>
    </div>
  );
}

export default App;
