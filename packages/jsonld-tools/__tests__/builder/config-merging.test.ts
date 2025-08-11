/**
 * Config Merging Behavior Tests for JSON-LD Builder
 *
 * Tests the new consistent merging behavior and clear methods
 */

import { createJsonLdConfig } from '../../src';

describe('Config Merging Behavior', () => {
  describe('Default Merging', () => {
    test('includeIds merges by default', () => {
      const config = createJsonLdConfig().includeIds(['a', 'b']).includeIds(['c', 'd']).getConfig();

      expect(config.filters?.includeIds).toEqual(['a', 'b', 'c', 'd']);
    });

    test('excludeIds merges by default', () => {
      const config = createJsonLdConfig().excludeIds(['a', 'b']).excludeIds(['c', 'd']).getConfig();

      expect(config.filters?.excludeIds).toEqual(['a', 'b', 'c', 'd']);
    });

    test('includeTypes merges by default', () => {
      const config = createJsonLdConfig()
        .includeTypes(['Person', 'Organization'])
        .includeTypes(['Article', 'WebSite'])
        .getConfig();

      expect(config.filters?.includeTypes).toEqual([
        'Person',
        'Organization',
        'Article',
        'WebSite',
      ]);
    });

    test('excludeTypes merges by default', () => {
      const config = createJsonLdConfig()
        .excludeTypes(['ImageObject'])
        .excludeTypes(['VideoObject'])
        .getConfig();

      expect(config.filters?.excludeTypes).toEqual(['ImageObject', 'VideoObject']);
    });

    test('requiredProperties merges by default', () => {
      const config = createJsonLdConfig()
        .requiredProperties(['name'])
        .requiredProperties(['url'])
        .getConfig();

      expect(config.filters?.requiredProperties).toEqual(['name', 'url']);
    });

    test('excludeEntitiesWithProperties merges by default', () => {
      const config = createJsonLdConfig()
        .excludeEntitiesWithProperties(['internal'])
        .excludeEntitiesWithProperties(['draft'])
        .getConfig();

      expect(config.filters?.excludeEntitiesWithProperties).toEqual(['internal', 'draft']);
    });

    test('multiple calls with empty arrays still work', () => {
      const config = createJsonLdConfig()
        .includeIds(['a'])
        .includeIds([])
        .includeIds(['b'])
        .getConfig();

      expect(config.filters?.includeIds).toEqual(['a', 'b']);
    });

    test('mixed configuration merging works correctly', () => {
      const config = createJsonLdConfig()
        .includeIds(['id1', 'id2'])
        .includeTypes(['Person'])
        .excludeIds(['exclude1'])
        .includeIds(['id3'])
        .excludeTypes(['ImageObject'])
        .getConfig();

      expect(config.filters?.includeIds).toEqual(['id1', 'id2', 'id3']);
      expect(config.filters?.includeTypes).toEqual(['Person']);
      expect(config.filters?.excludeIds).toEqual(['exclude1']);
      expect(config.filters?.excludeTypes).toEqual(['ImageObject']);
    });
  });

  describe('Clear Methods', () => {
    test('clearIds clears both include and exclude IDs', () => {
      const config = createJsonLdConfig()
        .includeIds(['a', 'b'])
        .excludeIds(['c', 'd'])
        .clearIds()
        .getConfig();

      expect(config.filters?.includeIds).toBeUndefined();
      expect(config.filters?.excludeIds).toBeUndefined();
    });

    test('clearTypes clears both include and exclude types', () => {
      const config = createJsonLdConfig()
        .includeTypes(['Person'])
        .excludeTypes(['ImageObject'])
        .clearTypes()
        .getConfig();

      expect(config.filters?.includeTypes).toBeUndefined();
      expect(config.filters?.excludeTypes).toBeUndefined();
    });

    test('clearPropertyRequirements clears both property requirements', () => {
      const config = createJsonLdConfig()
        .requiredProperties(['name'])
        .excludeEntitiesWithProperties(['internal'])
        .clearPropertyRequirements()
        .getConfig();

      expect(config.filters?.requiredProperties).toBeUndefined();
      expect(config.filters?.excludeEntitiesWithProperties).toBeUndefined();
    });

    test('clearPropertyFilters clears all property filters', () => {
      const config = createJsonLdConfig()
        .filterPropertiesByIds(['org:1'], { exclude: ['internal'] })
        .filterPropertiesByTypes(['Person'], { include: ['name'] })
        .clearPropertyFilters()
        .getConfig();

      expect(config.filters?.propertyFiltersByIds).toBeUndefined();
      expect(config.filters?.propertyFiltersByTypes).toBeUndefined();
    });

    test('clearSubgraph clears subgraph roots', () => {
      const config = createJsonLdConfig().subgraph(['org:hyperweb']).clearSubgraph().getConfig();

      expect(config.filters?.subgraphRoots).toBeUndefined();
    });

    test('clearAll clears everything except baseGraph', () => {
      const graph = [{ '@id': 'test', '@type': 'Thing' }];
      const config = createJsonLdConfig()
        .baseGraph(graph)
        .includeIds(['a'])
        .excludeTypes(['ImageObject'])
        .addEntities([{ '@id': 'extra', '@type': 'Thing' }])
        .clearAll()
        .getConfig();

      expect(config.baseGraph).toBe(graph);
      expect(config.filters).toBeUndefined();
      expect(config.additionalEntities).toBeUndefined();
    });

    test('clear methods are selective - only clear specified config', () => {
      const config = createJsonLdConfig()
        .includeIds(['keep-these'])
        .includeTypes(['Person'])
        .requiredProperties(['name'])
        .clearTypes()
        .getConfig();

      // Types should be cleared
      expect(config.filters?.includeTypes).toBeUndefined();
      expect(config.filters?.excludeTypes).toBeUndefined();

      // Other config should remain
      expect(config.filters?.includeIds).toEqual(['keep-these']);
      expect(config.filters?.requiredProperties).toEqual(['name']);
    });
  });

  describe('Clear and Rebuild Patterns', () => {
    test('clear then add creates fresh configuration', () => {
      const config = createJsonLdConfig()
        .includeIds(['old1', 'old2'])
        .clearIds()
        .includeIds(['new1', 'new2'])
        .getConfig();

      expect(config.filters?.includeIds).toEqual(['new1', 'new2']);
    });

    test('chaining clear methods works correctly', () => {
      const config = createJsonLdConfig()
        .includeIds(['a'])
        .excludeIds(['b'])
        .includeTypes(['Person'])
        .excludeTypes(['ImageObject'])
        .clearIds()
        .clearTypes()
        .includeIds(['new'])
        .includeTypes(['Article'])
        .getConfig();

      expect(config.filters?.includeIds).toEqual(['new']);
      expect(config.filters?.excludeIds).toBeUndefined();
      expect(config.filters?.includeTypes).toEqual(['Article']);
      expect(config.filters?.excludeTypes).toBeUndefined();
    });

    test('clear in middle of chain works correctly', () => {
      const config = createJsonLdConfig()
        .includeIds(['first'])
        .includeTypes(['Person'])
        .clearIds()
        .includeIds(['second'])
        .includeTypes(['Organization'])
        .getConfig();

      expect(config.filters?.includeIds).toEqual(['second']);
      expect(config.filters?.includeTypes).toEqual(['Person', 'Organization']);
    });
  });

  describe('Immutability', () => {
    test('clear methods return new instances', () => {
      const original = createJsonLdConfig().includeIds(['a', 'b']);
      const cleared = original.clearIds();

      expect(original).not.toBe(cleared);
      expect(original.getConfig().filters?.includeIds).toEqual(['a', 'b']);
      expect(cleared.getConfig().filters?.includeIds).toBeUndefined();
    });

    test('merging methods return new instances', () => {
      const original = createJsonLdConfig().includeIds(['a', 'b']);
      const extended = original.includeIds(['c', 'd']);

      expect(original).not.toBe(extended);
      expect(original.getConfig().filters?.includeIds).toEqual(['a', 'b']);
      expect(extended.getConfig().filters?.includeIds).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('Edge Cases', () => {
    test('clearing empty configuration works', () => {
      const config = createJsonLdConfig().clearIds().clearTypes().clearAll().getConfig();

      expect(config).toEqual({});
    });

    test('duplicate values in merging are preserved', () => {
      const config = createJsonLdConfig().includeIds(['a', 'b']).includeIds(['b', 'c']).getConfig();

      expect(config.filters?.includeIds).toEqual(['a', 'b', 'b', 'c']);
    });

    test('undefined and empty array handling', () => {
      const config = createJsonLdConfig()
        .includeIds([])
        .includeIds(['a'])
        .includeIds([])
        .getConfig();

      expect(config.filters?.includeIds).toEqual(['a']);
    });
  });
});
