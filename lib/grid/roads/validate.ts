import type { GridRoadGraph, GridRoadGraphValidationIssue } from './types';

export function validateRoadGraph(graph: GridRoadGraph): GridRoadGraphValidationIssue[] {
  const issues: GridRoadGraphValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const degree = new Map<string, number>();

  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({ code: 'DUPLICATE_NODE', message: 'duplicate road node id', assetId: node.id });
    }
    nodeIds.add(node.id);
    degree.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({ code: 'DUPLICATE_EDGE', message: 'duplicate road edge id', assetId: edge.id });
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      issues.push({ code: 'MISSING_ENDPOINT', message: 'road edge references a missing node', assetId: edge.id });
      continue;
    }
    if (!Number.isSafeInteger(edge.lengthMillimeters) || edge.lengthMillimeters <= 0) {
      issues.push({ code: 'INVALID_LENGTH', message: 'road edge length must be a positive safe integer', assetId: edge.id });
    }
    degree.set(edge.fromNodeId, (degree.get(edge.fromNodeId) ?? 0) + 1);
    degree.set(edge.toNodeId, (degree.get(edge.toNodeId) ?? 0) + 1);
  }
  for (const [nodeId, nodeDegree] of degree) {
    if (nodeDegree === 0) {
      issues.push({ code: 'ORPHAN_NODE', message: 'road node has no incident edge', assetId: nodeId });
    }
  }

  return issues.sort((a, b) => {
    const codeDelta = a.code.localeCompare(b.code);
    return codeDelta !== 0 ? codeDelta : a.assetId.localeCompare(b.assetId);
  });
}
