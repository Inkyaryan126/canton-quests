import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';

export interface GridAdminOverviewInput {
  generatedAt: string;
  season: {
    cityName: string;
    seasonName: string;
    status: string;
    startsAt: string | null;
    surgeStartsAt: string | null;
    endsAt: string | null;
  };
  players: Array<{ playerId: string; displayName: string; level: number; totalXp: number; credits: number; influence: number; commandPoints: number; lastActiveAt: string | null }>;
  territories: Array<{ slug: string; name: string; districtName: string; ownerDisplayName: string | null; status: 'neutral' | 'occupied' }>;
  properties: Array<{ slug: string; name: string; territoryName: string; ownerDisplayName: string | null; status: 'neutral' | 'occupied'; developmentLevel: number; conditionBps: number }>;
  activeContests: Array<{ contestId: string; sourceTerritoryName: string; targetTerritoryName: string; status: string; startedAt: string }>;
  auctions: Array<{ auctionId: string; propertyName: string; status: string; endsAt: string; leadingBidCredits: number | null }>;
  marketTransactions: Array<{ propertyName: string; priceCredits: number; transactedAt: string }>;
  strongholds: Array<{ strongholdName: string; factionName: string; status: string; garrisonInfluence: number }>;
  dynamicEvents: Array<{ kind: string; status: string; startsAt: string; endsAt: string }>;
  activity: Array<{ eventType: string; entityType: string | null; actorDisplayName: string | null; createdAt: string }>;
}

export interface GridAdminOverview {
  version: 1;
  readOnly: true;
  generatedAt: string;
  season: GridAdminOverviewInput['season'];
  players: Array<Omit<GridAdminOverviewInput['players'][number], 'playerId'>>;
  territories: GridAdminOverviewInput['territories'];
  properties: GridAdminOverviewInput['properties'];
  activeContests: Array<Omit<GridAdminOverviewInput['activeContests'][number], 'contestId'>>;
  auctions: Array<Omit<GridAdminOverviewInput['auctions'][number], 'auctionId'>>;
  marketTransactions: GridAdminOverviewInput['marketTransactions'];
  strongholds: GridAdminOverviewInput['strongholds'];
  dynamicEvents: GridAdminOverviewInput['dynamicEvents'];
  activity: GridAdminOverviewInput['activity'];
  counts: { players: number; occupiedTerritories: number; occupiedProperties: number; activeContests: number; activeAuctions: number };
  availability: { marketTransactions: 'live' | 'empty'; strongholds: 'live' | 'unavailable'; dynamicEvents: 'live' | 'unavailable' };
}

export function buildGridAdminOverview(input: GridAdminOverviewInput): GridAdminOverview {
  return {
    version: 1,
    readOnly: true,
    generatedAt: input.generatedAt,
    season: input.season,
    players: input.players.map(({ playerId: _playerId, ...player }) => player),
    territories: input.territories,
    properties: input.properties,
    activeContests: input.activeContests.map(({ contestId: _contestId, ...contest }) => contest),
    auctions: input.auctions.map(({ auctionId: _auctionId, ...auction }) => auction),
    marketTransactions: input.marketTransactions,
    strongholds: input.strongholds,
    dynamicEvents: input.dynamicEvents,
    activity: input.activity,
    counts: {
      players: input.players.length,
      occupiedTerritories: input.territories.filter((row) => row.status === 'occupied').length,
      occupiedProperties: input.properties.filter((row) => row.status === 'occupied').length,
      activeContests: input.activeContests.length,
      activeAuctions: input.auctions.filter((row) => row.status === 'open').length,
    },
    availability: {
      marketTransactions: input.marketTransactions.length ? 'live' : 'empty',
      strongholds: input.strongholds.length ? 'live' : 'unavailable',
      dynamicEvents: input.dynamicEvents.length ? 'live' : 'unavailable',
    },
  };
}

type Row = Record<string, any>;
function asRows(data: unknown): Row[] { return Array.isArray(data) ? data as Row[] : []; }
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === '42P01' || error.message?.includes('does not exist')));
}
async function optionalRows(client: SupabaseClient, table: string, selection: string, configure?: (query: any) => any): Promise<Row[]> {
  let query: any = client.from(table).select(selection);
  if (configure) query = configure(query);
  const { data, error } = await query;
  if (error && !isMissingTable(error)) throw new Error(`Failed to read Grid ${table}: ${error.message}`);
  return error ? [] : asRows(data);
}

export async function readGridAdminOverview(
  client: SupabaseClient | null = supabaseAdmin,
  search = '',
  now = new Date().toISOString(),
): Promise<GridAdminOverview> {
  if (!client) throw new Error('Grid admin overview requires Supabase configuration');
  const pkgCity = 'canton-oh';
  const pkgSeason = 'founding-season';
  const cityResult = await client.from('grid_cities').select('id,name').eq('slug', pkgCity).maybeSingle();
  if (cityResult.error) throw new Error(`Failed to read Grid city: ${cityResult.error.message}`);
  if (!cityResult.data) return buildGridAdminOverview({ generatedAt: now, season: { cityName: 'Canton', seasonName: 'Founding Season', status: 'not-provisioned', startsAt: null, surgeStartsAt: null, endsAt: null }, players: [], territories: [], properties: [], activeContests: [], auctions: [], marketTransactions: [], strongholds: [], dynamicEvents: [], activity: [] });
  const city = cityResult.data as { id: string; name: string };
  const seasonResult = await client.from('grid_seasons').select('id,name,status,starts_at,surge_starts_at,ends_at').eq('city_id', city.id).eq('slug', pkgSeason).maybeSingle();
  if (seasonResult.error) throw new Error(`Failed to read Grid season: ${seasonResult.error.message}`);
  const seasonRow = seasonResult.data as Row | null;
  if (!seasonRow) return buildGridAdminOverview({ generatedAt: now, season: { cityName: city.name, seasonName: 'Founding Season', status: 'not-provisioned', startsAt: null, surgeStartsAt: null, endsAt: null }, players: [], territories: [], properties: [], activeContests: [], auctions: [], marketTransactions: [], strongholds: [], dynamicEvents: [], activity: [] });

  const seasonId = seasonRow.id as string;
  const [players, states, districts, territories, properties, territoryState, propertyState, contests, auctions, events] = await Promise.all([
    optionalRows(client, 'players', 'id,display_name,level,total_xp', (q) => search.trim() ? q.ilike('display_name', `%${search.trim().replace(/[%_]/g, '')}%`).limit(25) : q.order('display_name').limit(25)),
    optionalRows(client, 'grid_player_season_state', 'player_id,credits,influence,command_points,last_active_at', (q) => q.eq('season_id', seasonId)),
    optionalRows(client, 'grid_districts', 'id,name', (q) => q.eq('city_id', city.id)),
    optionalRows(client, 'grid_territories', 'id,slug,name,district_id', (q) => q.eq('city_id', city.id)),
    optionalRows(client, 'grid_properties', 'id,slug,display_name,public_name_safe,territory_id', (q) => q.eq('city_id', city.id)),
    optionalRows(client, 'grid_season_territory_state', 'territory_id,owner_player_id', (q) => q.eq('season_id', seasonId)),
    optionalRows(client, 'grid_season_property_state', 'property_id,owner_player_id,development_level,condition_bps', (q) => q.eq('season_id', seasonId)),
    optionalRows(client, 'grid_contests', 'id,source_territory_id,target_territory_id,status,started_at', (q) => q.eq('season_id', seasonId).eq('status', 'active')),
    optionalRows(client, 'grid_property_auctions', 'id,property_id,status,ends_at,leading_bid_credits', (q) => q.eq('season_id', seasonId).in('status', ['scheduled', 'open']).gt('ends_at', now)),
    optionalRows(client, 'grid_game_events', 'event_type,entity_type,actor_player_id,payload,created_at', (q) => q.eq('season_id', seasonId).order('created_at', { ascending: false }).limit(30)),
  ]);
  const names = new Map(players.map((p) => [p.id, String(p.display_name || 'Unnamed player')]));
  const statesByPlayer = new Map(states.map((s) => [s.player_id, s]));
  const districtsById = new Map(districts.map((d) => [d.id, d.name]));
  const territoryById = new Map(territories.map((t) => [t.id, t]));
  const territoryOwners = new Map(territoryState.map((s) => [s.territory_id, s.owner_player_id]));
  const propertyOwners = new Map(propertyState.map((s) => [s.property_id, s]));
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  return buildGridAdminOverview({
    generatedAt: now,
    season: { cityName: city.name, seasonName: seasonRow.name, status: seasonRow.status, startsAt: seasonRow.starts_at, surgeStartsAt: seasonRow.surge_starts_at, endsAt: seasonRow.ends_at },
    players: players.map((p) => { const state = statesByPlayer.get(p.id) || {}; return { playerId: p.id, displayName: names.get(p.id) || 'Unnamed player', level: Number(p.level || 0), totalXp: Number(p.total_xp || 0), credits: Number(state.credits || 0), influence: Number(state.influence || 0), commandPoints: Number(state.command_points || 0), lastActiveAt: state.last_active_at || null }; }),
    territories: territories.map((t) => { const ownerId = territoryOwners.get(t.id); return { slug: t.slug, name: t.name, districtName: districtsById.get(t.district_id) || 'Unknown district', ownerDisplayName: ownerId ? names.get(ownerId) || 'Unnamed player' : null, status: ownerId ? 'occupied' : 'neutral' }; }),
    properties: properties.map((p) => { const state = propertyOwners.get(p.id); const ownerId = state?.owner_player_id; return { slug: p.slug, name: p.public_name_safe ? p.display_name : 'Grid Property', territoryName: territoryById.get(p.territory_id)?.name || 'Unknown territory', ownerDisplayName: ownerId ? names.get(ownerId) || 'Unnamed player' : null, status: ownerId ? 'occupied' : 'neutral', developmentLevel: Number(state?.development_level || 0), conditionBps: Number(state?.condition_bps ?? 10000) }; }),
    activeContests: contests.flatMap((c) => { const source = territoryById.get(c.source_territory_id); const target = territoryById.get(c.target_territory_id); return source && target ? [{ contestId: c.id, sourceTerritoryName: source.name, targetTerritoryName: target.name, status: c.status, startedAt: c.started_at }] : []; }),
    auctions: auctions.flatMap((a) => { const property = propertyById.get(a.property_id); return property ? [{ auctionId: a.id, propertyName: property.public_name_safe ? property.display_name : 'Grid Property', status: a.status, endsAt: a.ends_at, leadingBidCredits: a.leading_bid_credits === null ? null : Number(a.leading_bid_credits) }] : []; }),
    marketTransactions: events.filter((e) => e.event_type === 'grid:property_acquired').flatMap((e) => { const payload = e.payload as Row | undefined; return payload?.priceCredits ? [{ propertyName: 'Grid Property', priceCredits: Number(payload.priceCredits), transactedAt: e.created_at }] : []; }),
    strongholds: [],
    dynamicEvents: [],
    activity: events.map((e) => ({ eventType: e.event_type, entityType: e.entity_type || null, actorDisplayName: e.actor_player_id ? names.get(e.actor_player_id) || 'Unnamed player' : null, createdAt: e.created_at })),
  });
}
