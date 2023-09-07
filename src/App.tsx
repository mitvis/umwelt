import { useCallback, useEffect, useState } from 'react';
import './App.css';
import Debounce from 'react-debounce-component';
import { OlliDataset } from 'olli';
import Umwelt from './Umwelt';
import { UmweltSpec, validateSpec } from './grammar';
import UmweltEditor from './UmweltEditor';
import LZString from 'lz-string';

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
  const [initialSpec, setInitialSpec] = useState<UmweltSpec>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spec = params.get('spec');
    if (spec) {
      try {
        const maybeSpec = JSON.parse(LZString.decompressFromEncodedURIComponent(spec));
        if (validateSpec(maybeSpec)) {
          setInitialSpec(maybeSpec);
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }, [])

  const onSpec = useCallback((spec: UmweltSpec, data: OlliDataset) => {
    setProps({spec, data});
    const params = new URLSearchParams(window.location.search);
    params.set('spec', LZString.compressToEncodedURIComponent(JSON.stringify(spec)));
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
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
        <UmweltEditor initialSpec={initialSpec} onSpec={onSpec} />


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
        <div>
          <h2>Keyboard shortcuts</h2>
          <ul style={{listStyleType: 'none'}}>
            <li>e — Jump to editor</li>
            <li>v — Jump to viewer</li>
            <li>o — Jump to olli text structure</li>
            <li>a — Jump to audio controls</li>
            <li>p — Play audio</li>
            <li>shift + p — Jump to playback mode control</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
