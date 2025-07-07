/**
 * Custom JSON-LD graph utilities
 * 
 * Simple, focused functions for working with JSON-LD graph arrays.
 * No external dependencies, no context expansion - just pure graph traversal.
 */

// JSON-LD Entity type - flexible type that requires @id
export type JsonLdEntity = {
  '@id': string;
  '@type'?: string | string[];
  [key: string]: any;
};

export type JsonLdGraph = JsonLdEntity[];

/**
 * Find a single entity in the graph by @id
 * 
 * @param graph - Array of JSON-LD entities
 * @param id - The @id to search for
 * @returns The entity if found, undefined otherwise
 */
export function findEntity(graph: JsonLdGraph, id: string): JsonLdEntity | undefined {
  return graph.find(entity => entity['@id'] === id);
}

/**
 * Find multiple entities in the graph by @id
 * 
 * @param graph - Array of JSON-LD entities
 * @param ids - Array of @ids to search for
 * @returns Array of found entities (may be fewer than requested if some not found)
 */
export function findEntities(graph: JsonLdGraph, ids: string[]): JsonLdEntity[] {
  const idSet = new Set(ids);
  return graph.filter(entity => idSet.has(entity['@id']));
}

/**
 * Find entities by @type
 * 
 * @param graph - Array of JSON-LD entities
 * @param type - The @type to search for
 * @returns Array of entities matching the type
 */
export function findEntitiesByType(graph: JsonLdGraph, type: string): JsonLdEntity[] {
  return graph.filter(entity => {
    const entityType = entity['@type'];
    if (Array.isArray(entityType)) {
      return entityType.includes(type);
    }
    return entityType === type;
  });
}

/**
 * Extract all @id references from an entity's properties
 * 
 * @param entity - JSON-LD entity to scan
 * @returns Set of @id strings found in the entity
 */
export function extractReferences(entity: JsonLdEntity): Set<string> {
  const references = new Set<string>();
  
  function scanValue(value: any): void {
    if (value === null || value === undefined) {
      return;
    }
    
    if (typeof value === 'string') {
      // Check if it looks like an @id reference using regex pattern
      // Pattern: ^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?[^\s]+$
      // This matches:
      //   - URIs with scheme: scheme:path (e.g., mailto:user@example.com)
      //   - Compact URIs: prefix:suffix (e.g., person:danlynch, org:hyperweb)
      //   - Must not contain spaces (filters out titles/descriptions with colons)
      const idPattern = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)[^\s]+$/;
      // Additional checks:
      // - Must match the pattern
      // - Must contain a colon (to be a reference)
      // - Exclude http/https URLs (handled separately)
      if (idPattern.test(value) && value.includes(':') && !value.startsWith('http')) {
        references.add(value);
      }
      return;
    }
    
    if (Array.isArray(value)) {
      value.forEach(scanValue);
      return;
    }
    
    if (typeof value === 'object') {
      // If it has an @id, add it
      if (value['@id']) {
        references.add(value['@id']);
      }
      
      // Recursively scan all properties
      Object.values(value).forEach(scanValue);
      return;
    }
  }
  
  // Scan all properties except @id and @type
  Object.entries(entity).forEach(([key, value]) => {
    if (key !== '@id' && key !== '@type') {
      scanValue(value);
    }
  });
  
  return references;
}

/**
 * Extract a subgraph containing an entity and all its referenced entities
 * 
 * Recursively finds all @id references within the entity and includes
 * those entities in the result. Returns a filtered array of the original
 * graph elements - does not modify the entities themselves.
 * 
 * @param graph - Array of JSON-LD entities
 * @param id - The root @id to start from
 * @returns Array containing the root entity and all recursively referenced entities
 */
export function extractSubgraph(graph: JsonLdGraph, id: string): JsonLdEntity[] {
  const result = new Map<string, JsonLdEntity>();
  const visited = new Set<string>();
  const toProcess = new Set<string>([id]);
  
  while (toProcess.size > 0) {
    const currentId = toProcess.values().next().value!;
    toProcess.delete(currentId);
    
    if (visited.has(currentId)) {
      continue;
    }
    
    visited.add(currentId);
    
    const entity = findEntity(graph, currentId);
    if (!entity) {
      continue;
    }
    
    result.set(currentId, entity);
    
    // Find all references in this entity
    const references = extractReferences(entity);
    
    // Add unvisited references to process queue
    references.forEach(refId => {
      if (!visited.has(refId)) {
        toProcess.add(refId);
      }
    });
  }
  
  return Array.from(result.values());
}

/**
 * Extract subgraphs for multiple root entities
 * 
 * @param graph - Array of JSON-LD entities
 * @param ids - Array of root @ids to start from
 * @returns Array containing all entities and their recursively referenced entities
 */
export function extractSubgraphs(graph: JsonLdGraph, ids: string[]): JsonLdEntity[] {
  const allEntities = new Map<string, JsonLdEntity>();
  
  ids.forEach(id => {
    const subgraph = extractSubgraph(graph, id);
    subgraph.forEach(entity => {
      allEntities.set(entity['@id'], entity);
    });
  });
  
  return Array.from(allEntities.values());
}

/**
 * Find entities that reference a specific @id
 * 
 * @param graph - Array of JSON-LD entities
 * @param targetId - The @id to find references to
 * @returns Array of entities that reference the target @id
 */
export function findReferencingEntities(graph: JsonLdGraph, targetId: string): JsonLdEntity[] {
  return graph.filter(entity => {
    const references = extractReferences(entity);
    return references.has(targetId);
  });
}

/**
 * Extract a subgraph with limited depth traversal
 * 
 * Unlike extractSubgraph which recursively follows all references,
 * this function only traverses to a specified depth from the root entity.
 * 
 * @param graph - Array of JSON-LD entities
 * @param id - The root @id to start from
 * @param maxDepth - Maximum depth to traverse (1 = direct references only)
 * @returns Array containing entities up to the specified depth
 */
export function extractSubgraphWithDepth(
  graph: JsonLdGraph, 
  id: string, 
  maxDepth: number
): JsonLdEntity[] {
  if (maxDepth < 1) {
    return [];
  }
  
  const result = new Map<string, JsonLdEntity>();
  const visited = new Set<string>();
  
  // Queue items with their current depth
  type QueueItem = { id: string; depth: number };
  const toProcess: QueueItem[] = [{ id, depth: 0 }];
  
  while (toProcess.length > 0) {
    const current = toProcess.shift()!;
    
    if (visited.has(current.id) || current.depth > maxDepth) {
      continue;
    }
    
    visited.add(current.id);
    
    const entity = findEntity(graph, current.id);
    if (!entity) {
      continue;
    }
    
    result.set(current.id, entity);
    
    // Only process references if we haven't reached max depth
    if (current.depth < maxDepth) {
      const references = extractReferences(entity);
      
      references.forEach(refId => {
        if (!visited.has(refId)) {
          toProcess.push({ id: refId, depth: current.depth + 1 });
        }
      });
    }
  }
  
  return Array.from(result.values());
}

/**
 * Find all @id references that don't have corresponding entities in the graph
 * @param graph - The JSON-LD graph to analyze
 * @returns Array of missing @id references
 */
export function findMissingReferences(graph: JsonLdGraph): string[] {
  // First, collect all entity @ids that exist in the graph
  const existingIds = new Set<string>();
  for (const entity of graph) {
    if (entity['@id']) {
      existingIds.add(entity['@id']);
    }
  }
  
  // Then, collect all referenced @ids
  const allReferences = new Set<string>();
  for (const entity of graph) {
    const references = extractReferences(entity);
    for (const ref of references) {
      allReferences.add(ref);
    }
  }
  
  // Find references that don't exist
  const missing: string[] = [];
  for (const ref of allReferences) {
    if (!existingIds.has(ref)) {
      missing.push(ref);
    }
  }
  
  return missing.sort(); // Sort for consistent output
}

/**
 * Find entities that contain nested objects (potential normalization candidates)
 * @param graph - The JSON-LD graph to analyze
 * @returns Array of objects with parent @id and details about nested entities
 */
export function findNestedEntities(graph: JsonLdGraph): Array<{
  parentId: string;
  property: string;
  nestedEntity: any;
  hasId: boolean;
}> {
  const results: Array<{
    parentId: string;
    property: string;
    nestedEntity: any;
    hasId: boolean;
  }> = [];
  
  function isNestedEntity(value: any): boolean {
    // Check if it's an object (not null, not array)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    
    // Skip if it's just an @id reference (only has @id property)
    if (Object.keys(value).length === 1 && value['@id']) {
      return false;
    }
    
    // It's a nested entity if it has properties beyond just @id
    return true;
  }
  
  function scanEntity(entity: any, parentId: string, basePath: string = '') {
    for (const [key, value] of Object.entries(entity)) {
      // Skip special JSON-LD properties
      if (key.startsWith('@')) continue;
      
      const propertyPath = basePath ? `${basePath}.${key}` : key;
      
      if (isNestedEntity(value)) {
        results.push({
          parentId: parentId,
          property: propertyPath,
          nestedEntity: value,
          hasId: !!(value as any)['@id']
        });
        
        // Recursively scan the nested entity
        scanEntity(value, parentId, propertyPath);
      } else if (Array.isArray(value)) {
        // Check arrays for nested entities
        value.forEach((item, index) => {
          if (isNestedEntity(item)) {
            const arrayPath = `${propertyPath}[${index}]`;
            results.push({
              parentId: parentId,
              property: arrayPath,
              nestedEntity: item,
              hasId: !!item['@id']
            });
            
            // Recursively scan the nested entity in array
            scanEntity(item, parentId, arrayPath);
          }
        });
      }
    }
  }
  
  for (const entity of graph) {
    if (!entity['@id']) continue;
    scanEntity(entity, entity['@id']);
  }
  
  return results;
}

/**
 * Find all entities that exist in the graph but are never referenced by other entities
 * @param graph - The JSON-LD graph to analyze
 * @returns Array of orphaned @id values
 */
export function findOrphans(graph: JsonLdGraph): string[] {
  // First, collect all entity @ids that exist in the graph
  const allIds = new Set<string>();
  for (const entity of graph) {
    if (entity['@id']) {
      allIds.add(entity['@id']);
    }
  }
  
  // Then, collect all referenced @ids
  const referencedIds = new Set<string>();
  for (const entity of graph) {
    const references = extractReferences(entity);
    for (const ref of references) {
      referencedIds.add(ref);
    }
  }
  
  // Find entities that exist but are never referenced
  const orphans: string[] = [];
  for (const id of allIds) {
    if (!referencedIds.has(id)) {
      orphans.push(id);
    }
  }
  
  return orphans.sort(); // Sort for consistent output
}


/**
 * Inline all @id references within entities, replacing them with their full entity data
 * 
 * This function takes an array of entities and recursively replaces all @id references
 * with the actual entity data. If a specific root ID is provided, it returns only
 * that entity with all its references inlined. Otherwise, it returns all entities
 * with references inlined.
 * 
 * @param entities - Array of JSON-LD entities
 * @param rootId - Optional root entity @id to return (if not provided, returns all entities)
 * @returns Either a single entity with inlined references or array of all entities with inlined references
 */
export function inlineReferences(entities: JsonLdGraph, rootId?: string): JsonLdEntity | JsonLdGraph {
  // Create a lookup map for all entities
  const entityMap = new Map<string, JsonLdEntity>();
  entities.forEach(entity => {
    if (entity['@id']) {
      entityMap.set(entity['@id'], entity);
    }
  });

  // Function to recursively inline references with circular reference protection
  function inlineValue(value: any, visited: Set<string> = new Set()): any {
    if (value === null || value === undefined) {
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.map(v => inlineValue(v, visited));
    }
    
    if (typeof value === 'object') {
      // If it's an @id reference (object with only @id property), replace with the full entity
      if (value['@id'] && Object.keys(value).length === 1) {
        const id = value['@id'];
        
        // Check for circular reference
        if (visited.has(id)) {
          // Return just the @id reference to break the cycle
          return { '@id': id };
        }
        
        const referencedEntity = entityMap.get(id);
        if (referencedEntity) {
          // Add to visited set before processing
          const newVisited = new Set(visited);
          newVisited.add(id);
          
          // Create a copy and inline its references
          const copy = { ...referencedEntity };
          return inlineValue(copy, newVisited);
        }
      }
      
      // Otherwise, recursively process all properties
      const result: any = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = inlineValue(val, visited);
      }
      return result;
    }
    
    return value;
  }

  // If a root ID is specified, return only that entity with inlined references
  if (rootId) {
    const mainEntity = entities.find(e => e['@id'] === rootId);
    if (!mainEntity) {
      throw new Error(`Entity with @id "${rootId}" not found`);
    }
    return inlineValue(mainEntity);
  }

  // Otherwise, inline references in all entities
  return entities.map(entity => inlineValue(entity));
}
