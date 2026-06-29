import { countDescendants } from './tree';
import { MindMapNode } from './types';

export type LayoutNode = {
  node: MindMapNode;
  x: number;
  y: number;
  width: number;
  height: number;
  hiddenCount: number;
};

export type LayoutEdge = {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export type MindMapLayout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
};

const nodeWidth = 180;
const nodeHeight = 54;
const horizontalGap = 220;
const verticalGap = 28;

export function computeRightTreeLayout(root: MindMapNode): MindMapLayout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let cursorY = 0;
  let maxDepth = 0;

  function visit(node: MindMapNode, depth: number): LayoutNode {
    maxDepth = Math.max(maxDepth, depth);
    const visibleChildren = node.collapsed ? [] : node.children;
    let y: number;

    if (visibleChildren.length === 0) {
      y = cursorY;
      cursorY += nodeHeight + verticalGap;
    } else {
      const childLayouts = visibleChildren.map((child) => visit(child, depth + 1));
      y = (childLayouts[0].y + childLayouts[childLayouts.length - 1].y) / 2;
    }

    const layoutNode: LayoutNode = {
      node,
      x: depth * horizontalGap,
      y,
      width: nodeWidth,
      height: nodeHeight,
      hiddenCount: node.collapsed ? countDescendants(node) : 0,
    };

    nodes.push(layoutNode);

    for (const child of visibleChildren) {
      const childLayout = nodes.find((candidate) => candidate.node.id === child.id);
      if (childLayout) {
        edges.push({
          id: `${node.id}-${child.id}`,
          fromX: layoutNode.x + nodeWidth,
          fromY: layoutNode.y + nodeHeight / 2,
          toX: childLayout.x,
          toY: childLayout.y + nodeHeight / 2,
        });
      }
    }

    return layoutNode;
  }

  visit(root, 0);

  return {
    nodes,
    edges,
    width: (maxDepth + 1) * horizontalGap + nodeWidth,
    height: Math.max(cursorY, nodeHeight),
  };
}
