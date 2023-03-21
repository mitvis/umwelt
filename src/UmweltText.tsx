import { OlliDataset } from 'olli';
import React, { createRef, useEffect, useRef, useState } from 'react';
import { ElaboratedFieldDef, SelectionSpec, ElaboratedGroupNode, ElaboratedLeafNode, TextNode, ElaboratedPredNode, ElaboratedTextNode } from './grammar';
import { Tree } from './text/Tree';
import { textSpecToFullPredicateSpec } from './utils/text';
import './text/TreeStyle.css'
import { LogicalAnd } from 'vega-lite/src/logical';
import { FieldPredicate } from 'vega-lite/src/predicate';
import { SelectionCtrl } from './Umwelt';

interface TextProps {
  textSpec: ElaboratedTextNode[],
  selectionCtrl: SelectionCtrl
  selectionSpec: SelectionSpec,
  onTextPred: (predicate: LogicalAnd<FieldPredicate>) => void;
}

const UmweltText = React.memo(({ textSpec, selectionCtrl, selectionSpec, onTextPred }: TextProps) => {

  const treeContainer = createRef<HTMLDivElement>();
  const nodeMap = useRef<{[key: string]: ElaboratedTextNode}>({});

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
  }, [textSpec])

  function renderPredTree(predTree: ElaboratedTextNode[], depth: number, id: string) {
    return (
      <ul role={depth === 0 ? "tree" : "group"}>
        {
          predTree.map((predNode, idx) => {
            if (!predNode) return null;
            const nodeId = `${id}-${idx}`;
            nodeMap.current[nodeId] = predNode;
            let description = `${idx + 1} of ${predTree.length}. `;
            if ((predNode as ElaboratedGroupNode).field) {
              description += `Group of ${(predNode as ElaboratedGroupNode).field}`;
            }
            else if ((predNode as ElaboratedPredNode).predicate) {
              description += JSON.stringify((predNode as ElaboratedPredNode).predicate);
            }
            else if ((predNode as ElaboratedLeafNode).fullPredicate) {
              description += JSON.stringify((predNode as ElaboratedLeafNode).fullPredicate);
            }
            description += `. ${(predNode as ElaboratedPredNode).children?.length || '0'} children.`;
            return (
              <li role="treeitem" aria-expanded="false" data-nodeid={nodeId} key={nodeId}>
                <span>{description.trim()}</span>
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

