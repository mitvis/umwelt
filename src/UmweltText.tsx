import { OlliDataset } from 'olli';
import React, { createRef, useEffect, useRef } from 'react';
import { ElaboratedFieldDef, SelectionSpec, ElaboratedGroupNode, ElaboratedPredNode, ElaboratedTextNode, isGroupNode, isLeafNode, isPredNode } from './grammar';
import { Tree } from './text/Tree';
import './text/TreeStyle.css'
import { LogicalAnd } from 'vega-lite/src/logical';
import { FieldPredicate } from 'vega-lite/src/predicate';
import { SelectionCtrl } from './Umwelt';
import { selectionTest } from './utils/selection';
import { describe } from './utils/description';
import useState from 'react-usestateref';

interface TextProps {
  textSpec: ElaboratedTextNode[],
  selectionCtrl: SelectionCtrl
  selectionSpec: SelectionSpec,
  data: OlliDataset,
  fields: ElaboratedFieldDef[],
  onTextPred: (predicate: LogicalAnd<FieldPredicate>) => void;
}

const UmweltText = React.memo(({ textSpec, selectionCtrl, selectionSpec, data, fields, onTextPred }: TextProps) => {

  const treeContainer = createRef<HTMLDivElement>();
  const nodeMap = useRef<{[key: string]: ElaboratedTextNode}>({});
  const [descriptionMap, setDescriptionMap, descriptionMapRef] = useState<{[key: string]: string}>({});

  useEffect(() => {
    const el = treeContainer.current;
    if (el) {
      const ul = el.children.item(0);
      if (ul) {
        const t = new Tree(el.children.item(0) as HTMLElement, (el) => {
          const key = el.getAttribute('data-nodeid');
          const node = nodeMap.current[key];
          onTextPred(node.fullPredicate);
        });
        t.init();
      }
    }
    buildNodeMap(textSpec, 0, '0');
  }, [textSpec])

  useEffect(() => {
    Object.entries(nodeMap.current).reduce(async (memo, [nodeId, node]) => {
      await memo; // necessary to run the api calls sequentially, to avoid triggering rate limit
      if (isGroupNode(node) && node.field) {
        // group nodes e.g. axes have the same pred as their parent
        return;
      }
      const selection = selectionTest(data, {predicate: node.fullPredicate}, fields);
      if (selection.length <= 1) {
        // don't ask gpt to describe single data points or empty data
        return;
      }
      const description = await describe(selection);
      setDescriptionMap({
        ...descriptionMapRef.current,
        [nodeId]: description
      })
    }, undefined as any)
  }, [nodeMap])

  function buildNodeMap(predTree: ElaboratedTextNode[], depth: number, idPrefix: string) {
    predTree.map((predNode, idx) => {
      if (!predNode) return null;
      const nodeId = `${idPrefix}-${idx}`;
      nodeMap.current[nodeId] = predNode;

      const children = (predNode as ElaboratedGroupNode | ElaboratedPredNode)?.children;
      if (children) {
        buildNodeMap(children, depth + 1, nodeId);
      }
    });
  }

  function renderPredTree(predTree: ElaboratedTextNode[], depth: number, idPrefix: string) {
    return (
      <ul role={depth === 0 ? "tree" : "group"}>
        {
          predTree.map((predNode, idx) => {
            if (!predNode) return null;
            const nodeId = `${idPrefix}-${idx}`;
            let description = `${idx + 1} of ${predTree.length}. `;
            if ((predNode as ElaboratedGroupNode).field) {
              description += `Group of ${(predNode as ElaboratedGroupNode).field}`;
            }
            // else if ((predNode as ElaboratedPredNode).predicate) {
            //   description += JSON.stringify((predNode as ElaboratedPredNode).predicate);
            // }
            description += JSON.stringify(predNode.fullPredicate);
            description += `. ${(predNode as ElaboratedPredNode).children?.length || '0'} children.`;

            return (
              <li role="treeitem" aria-expanded="false" data-nodeid={nodeId} key={nodeId}>
                <span style={{color: 'blue'}}>{descriptionMapRef.current[nodeId] ? descriptionMapRef.current[nodeId] : null}</span> <span>{description.trim()}</span>
                {
                  (predNode as ElaboratedGroupNode | ElaboratedPredNode)?.children ?
                    renderPredTree((predNode as ElaboratedGroupNode | ElaboratedPredNode)?.children, depth + 1, nodeId) :
                    null
                }
              </li>
            );
          })
        }
      </ul>
    )
  }

  // function renderData(predNode) {
  //   return (
  //     <ul role="group">
  //       {
  //         selectionTest(data, {predicate: predNode.predicate}, fields).map(datum => {
  //           return <li role="treeitem" aria-expanded="false">{JSON.stringify(datum)}</li>
  //         })
  //       }
  //     </ul>
  //   )
  // }

  return (
    <div>
      <div className='olli-vis' ref={treeContainer}>
        {textSpec ? renderPredTree(textSpec, 0, '0') : null}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.textSpec === nextProps.textSpec
});

export default UmweltText;

