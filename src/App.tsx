import { useCallback, useEffect, useState } from 'react';
import './App.css';
import Debounce from 'react-debounce-component';
import Umvelt from './Umvelt';
import { umvelt } from './grammar';
import JSONC from 'jsonc-simple-parser';
import { debounce } from 'vega';

function App() {

  const specs = {
    "scatterplot.uv.json": require('./specs/scatterplot.uv.json'),
    "multi-series-line.uv.json": require('./specs/multi-series-line.uv.json'),
    "line-sequence.uv.json": require('./specs/line-sequence.uv.json'),
    "line-interaction-sequence.uv.json": require('./specs/line-interaction-sequence.uv.json'),
    "line-interaction-agg.uv.json": require('./specs/line-interaction-agg.uv.json'),
    "barley-facet.uv.json": require('./specs/barley-facet.uv.json'),
    "barley-facet-agg.uv.json": require('./specs/barley-facet-agg.uv.json'),
  }

  const [selectedSpec, setSelectedSpec] =
    // useState("multi-series-line.uv.json");
    useState("scatterplot.uv.json");
    // useState("line-sequence.uv.json");
    // useState("line-interaction-sequence.uv.json");
    // useState("line-interaction-agg.uv.json");
    // useState("barley-facet.uv.json");
    // useState("barley-facet-agg.uv.json");

  const [textValue, setTextValue] = useState("");
  const [props, setProps] = useState(null);

  useEffect(() => {
    const spec = specs[selectedSpec];
    if (spec.data.url && spec.data.url.startsWith('data/')) {
      spec.data.url = 'https://raw.githubusercontent.com/vega/vega-datasets/master/' + spec.data.url;
    }
    setTextValue(JSON.stringify(spec, null, 2));

    umvelt(spec).then((props) => {
      setProps(props);
    })
  }, [selectedSpec]);

  const onTextValue = useCallback(debounce(250, (textValue) => {
    try {
      console.log('onvalue');
      const spec = JSONC.parse(textValue);
      umvelt(spec).then((props) => {
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
              return <option key={spec} value={spec}>{spec}</option>
            })
          }
        </select>
      </div>
      <div className='column'>
        <Debounce ms={250}>
          {
            props ? (
              <Umvelt {...props} />
            ) : null
          }
        </Debounce>
      </div>
    </div>
  );
}

export default App;
