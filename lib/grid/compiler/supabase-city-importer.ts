import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import { assertSafeTestSupabaseMutationTarget } from '../../supabase-test-safety';
import { computeCentroid } from '../geo/geometry';
import type { GridCityPackage, GridLatLng } from '../core/types';
import { runCityValidation } from './validate-package';
import type { GridCityImportPort, GridCityImportResult } from './city-import-port';

type IdSlugRow = { id: string; slug: string };

function clientUrl(client: SupabaseClient): string | undefined {
  return (client as unknown as { supabaseUrl?: string }).supabaseUrl;
}

function pointWkt(point: GridLatLng | undefined): string | null {
  return point ? `SRID=4326;POINT(${point.lng} ${point.lat})` : null;
}

function multiPolygonWkt(geometry: GeoJSON.MultiPolygon | undefined): string | null {
  if (!geometry) return null;
  const polygons = geometry.coordinates.map((polygon) => {
    const rings = polygon.map((ring) =>
      `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(',')})`,
    );
    return `(${rings.join(',')})`;
  });
  return `SRID=4326;MULTIPOLYGON(${polygons.join(',')})`;
}

function configWithMetadata(
  config: Record<string, unknown> | undefined,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(config ?? {}), ...extra };
}

async function requireRows(
  promise: PromiseLike<{ data: unknown; error: { message?: string } | null }>,
  label: string,
): Promise<any[]> {
  const { data, error } = await promise;
  if (error) throw new Error(`Failed to import Grid ${label}: ${error.message ?? 'unknown error'}`);
  return Array.isArray(data) ? data : data ? [data] : [];
}

export function createSupabaseGridCityImporter(
  client: SupabaseClient | null = supabaseAdmin,
): GridCityImportPort {
  if (!client) {
    throw new Error('Grid city importer requires Supabase service-role configuration');
  }

  const url = clientUrl(client);
  assertSafeTestSupabaseMutationTarget(url);

  return {
    async importCityPackage(pkg: GridCityPackage): Promise<GridCityImportResult> {
      if (pkg.status !== 'ready') {
        throw new Error('Grid city importer requires a ready city package');
      }

      const validation = runCityValidation(pkg);
      const errors = validation.issues.filter((issue) => issue.severity === 'ERROR');
      if (errors.length > 0) {
        throw new Error(
          `Grid city importer rejected package with validation errors: ${errors.map((x) => x.code).join(', ')}`,
        );
      }

      const cityRows = await requireRows(
        client
          .from('grid_cities')
          .upsert(
            {
              slug: pkg.city.slug,
              name: pkg.city.name,
              region_code: pkg.city.regionCode,
              country_code: pkg.city.countryCode,
              timezone: pkg.city.timezone,
              status: 'draft',
              map_center: pointWkt(pkg.city.mapCenter),
              package_version: pkg.packageVersion,
              config: configWithMetadata(undefined, {
                compilerVersion: pkg.compilerVersion,
                sourceSnapshotVersion: pkg.sourceSnapshotVersion,
                checksum: pkg.checksum,
              }),
            },
            { onConflict: 'slug' },
          )
          .select('id,slug'),
        'city',
      );
      const cityId = (cityRows[0] as IdSlugRow | undefined)?.id;
      if (!cityId) throw new Error('Grid city import did not return a city id');

      const districtRows = await requireRows(
        client
          .from('grid_districts')
          .upsert(
            pkg.districts.map((district) => ({
              city_id: cityId,
              slug: district.slug,
              name: district.name,
              boundary: multiPolygonWkt(district.geometry),
              config: configWithMetadata(district.config, { sourceRefs: district.sourceRefs ?? [] }),
            })),
            { onConflict: 'city_id,slug' },
          )
          .select('id,slug'),
        'districts',
      );
      const districtIds = new Map(
        (districtRows as IdSlugRow[]).map((row) => [row.slug, row.id]),
      );

      const territoryRows = await requireRows(
        client
          .from('grid_territories')
          .upsert(
            pkg.territories.map((territory) => {
              const districtId = districtIds.get(territory.districtSlug);
              if (!districtId) {
                throw new Error(
                  `Grid city import cannot resolve district ${territory.districtSlug} for ${territory.slug}`,
                );
              }
              return {
                city_id: cityId,
                district_id: districtId,
                slug: territory.slug,
                name: territory.name,
                boundary: multiPolygonWkt(territory.geometry),
                centroid: territory.geometry ? pointWkt(computeCentroid(territory.geometry)) : null,
                base_value: territory.baseValue,
                config: configWithMetadata(territory.config, {
                  historical: territory.historical,
                  sourceRefs: territory.sourceRefs ?? [],
                }),
              };
            }),
            { onConflict: 'city_id,slug' },
          )
          .select('id,slug'),
        'territories',
      );
      const territoryIds = new Map(
        (territoryRows as IdSlugRow[]).map((row) => [row.slug, row.id]),
      );

      const existingEdges = await requireRows(
        client
          .from('grid_territory_edges')
          .select('id,territory_a_id,territory_b_id,edge_type')
          .eq('city_id', cityId),
        'existing territory edges',
      );

      const edgeByPair = new Map<string, { id: string; edge_type: string }>();
      for (const row of existingEdges as Array<{
        id: string;
        territory_a_id: string;
        territory_b_id: string;
        edge_type: string;
      }>) {
        const key = [row.territory_a_id, row.territory_b_id].sort().join('::');
        edgeByPair.set(key, { id: row.id, edge_type: row.edge_type });
      }

      const missingEdges: Array<Record<string, unknown>> = [];
      for (const edge of pkg.edges) {
        const aId = territoryIds.get(edge.a);
        const bId = territoryIds.get(edge.b);
        if (!aId || !bId) {
          throw new Error(`Grid city import cannot resolve edge ${edge.a}::${edge.b}`);
        }
        const [territoryAId, territoryBId] = [aId, bId].sort();
        const key = `${territoryAId}::${territoryBId}`;
        const existing = edgeByPair.get(key);
        const edgeType = edge.edgeType ?? 'border';

        if (!existing) {
          missingEdges.push({
            city_id: cityId,
            territory_a_id: territoryAId,
            territory_b_id: territoryBId,
            edge_type: edgeType,
          });
        } else if (existing.edge_type !== edgeType) {
          const { error } = await client
            .from('grid_territory_edges')
            .update({ edge_type: edgeType })
            .eq('id', existing.id);
          if (error) throw new Error(`Failed to update Grid territory edge: ${error.message}`);
        }
      }

      if (missingEdges.length > 0) {
        await requireRows(
          client.from('grid_territory_edges').insert(missingEdges).select('id'),
          'territory edges',
        );
      }

      if (pkg.properties.length > 0) {
        await requireRows(
          client
            .from('grid_properties')
            .upsert(
              pkg.properties.map((property) => {
                const territoryId = territoryIds.get(property.territorySlug);
                if (!territoryId) {
                  throw new Error(
                    `Grid city import cannot resolve property territory ${property.territorySlug}`,
                  );
                }
                return {
                  city_id: cityId,
                  territory_id: territoryId,
                  slug: property.slug,
                  display_name: property.name,
                  public_name_safe: property.publicNameSafe,
                  boundary: multiPolygonWkt(property.geometry),
                  point: pointWkt(property.point),
                  base_value: property.baseValue,
                  config: configWithMetadata(property.config, {
                    privacyClass: property.privacyClass,
                    historical: property.historical,
                    sourceRefs: property.sourceRefs ?? [],
                  }),
                };
              }),
              { onConflict: 'city_id,slug' },
            )
            .select('id'),
          'properties',
        );
      }

      if (pkg.landmarks.length > 0) {
        await requireRows(
          client
            .from('grid_landmarks')
            .upsert(
              pkg.landmarks.map((landmark) => {
                const territoryId = territoryIds.get(landmark.territorySlug);
                if (!territoryId) {
                  throw new Error(
                    `Grid city import cannot resolve landmark territory ${landmark.territorySlug}`,
                  );
                }
                return {
                  city_id: cityId,
                  territory_id: territoryId,
                  slug: landmark.slug,
                  name: landmark.name,
                  point: pointWkt(landmark.point),
                  config: {
                    privacyClass: landmark.privacyClass,
                    historical: landmark.historical,
                    sourceRefs: landmark.sourceRefs ?? [],
                  },
                };
              }),
              { onConflict: 'city_id,slug' },
            )
            .select('id'),
          'landmarks',
        );
      }

      return {
        citySlug: pkg.city.slug,
        districtsUpserted: pkg.districts.length,
        territoriesUpserted: pkg.territories.length,
        edgesUpserted: pkg.edges.length,
        propertiesUpserted: pkg.properties.length,
        landmarksUpserted: pkg.landmarks.length,
      };
    },
  };
}
