import { useCallback, useState } from 'react';
import './App.css';
import Debounce from 'react-debounce-component';
import { OlliDataset } from 'olli';
import Umwelt from './Umwelt';
import { UmweltSpec } from './grammar';
import UmweltEditor from './UmweltEditor';

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

  const [props, setProps] = useState<{spec: UmweltSpec, data: OlliDataset}>(null);

  const onSpec = useCallback((spec: UmweltSpec, data: OlliDataset) => {
    setProps({spec, data});
  }, []);

  return (
    <div className="App">
      <div className="logo" aria-hidden="true">
        <img src='/umwelt/umwelt.svg' />
      </div>
      <div className="column">
        {/* <div>
          Choose spec: <select onChange={(e) => setSelectedSpec(e.target.value)} value={selectedSpec}>
            {
              Object.keys(specs).map(spec => {
                return <option key={spec} value={spec}>{spec.substring(0, spec.indexOf('.uw.json'))}</option>
              })
            }
          </select>
        </div> */}
        <h1 id="header-editor">Editor</h1>
        <UmweltEditor initialSpec={specs[selectedSpec]} onSpec={onSpec} />


      </div>
      <div className='column'>
      <h1 id="header-viewer">Viewer</h1>
        <Debounce ms={250}>
          {/* {
            props ? (
              <pre>
                {JSON.stringify(props.spec, null, 2)}
              </pre>
            ) : null
          } */}
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
