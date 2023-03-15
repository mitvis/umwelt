import { useCallback, useEffect, useState } from 'react';
import './App.css';
import Debounce from 'react-debounce-component';
import Umwelt from './Umwelt';
import { umwelt } from './grammar';
import JSONC from 'jsonc-simple-parser';
import { debounce } from 'vega';

function App() {

  const specs = {
    "scatterplot.uw.json": require('./specs/scatterplot.uw.json'),
    "multi-series-line.uw.json": require('./specs/multi-series-line.uw.json'),
    "line-sequence.uw.json": require('./specs/line-sequence.uw.json'),
    "line-interaction-sequence.uw.json": require('./specs/line-interaction-sequence.uw.json'),
    "line-interaction-agg.uw.json": require('./specs/line-interaction-agg.uw.json'),
    "barley-facet.uw.json": require('./specs/barley-facet.uw.json'),
    "barley-facet-agg.uw.json": require('./specs/barley-facet-agg.uw.json'),
  }

  const [selectedSpec, setSelectedSpec] =
    // useState("multi-series-line.uw.json");
    useState("scatterplot.uw.json");
    // useState("line-sequence.uw.json");
    // useState("line-interaction-sequence.uw.json");
    // useState("line-interaction-agg.uw.json");
    // useState("barley-facet.uw.json");
    // useState("barley-facet-agg.uw.json");

  const [textValue, setTextValue] = useState("");
  const [props, setProps] = useState(null);

  useEffect(() => {
    const spec = specs[selectedSpec];
    setTextValue(JSON.stringify(spec, null, 2));

    umwelt(spec).then((props) => {
      setProps(props);
    })
  }, [selectedSpec]);

  const onTextValue = useCallback(debounce(250, (textValue) => {
    try {
      console.log('onvalue');
      const spec = JSONC.parse(textValue);
      umwelt(spec).then((props) => {
        setProps(props);
      })
    }
    catch (e) {}
  }), []);

  useEffect(() => {
    onTextValue(textValue);
  }, [textValue]);

  return (
    <div className="App">
      <div className="column">
        <textarea
            value={textValue}
            onChange={(e) => {setTextValue(e.target.value)}}
        />
        <select onChange={(e) => setSelectedSpec(e.target.value)} value={selectedSpec}>
          {
            Object.keys(specs).map(spec => {
              return <option key={spec} value={spec}>{spec.substring(0, spec.indexOf('.uw.json'))}</option>
            })
          }
        </select>
        <div className="logo" aria-hidden="true">
          uw
        </div>
      </div>
      <div className='column'>
        <Debounce ms={250}>
          {
            props ? (
              <Umwelt {...props} />
            ) : null
          }
        </Debounce>
      </div>
    </div>
  );
}

export default App;
