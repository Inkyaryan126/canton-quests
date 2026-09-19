'use client';

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { GridAdminOverview } from '@/lib/grid/server/grid-admin-overview';
import type { GridRuntimeMaintenanceSweepResult } from '@/lib/grid/server/runtime-maintenance-sweep-service';
import './grid-admin.css';

interface MaintenanceResponse {
  success: boolean;
  result?: GridRuntimeMaintenanceSweepResult;
  error?: string;
}

function Empty({ children }: { children: string }) {
  return <p className="cq-grid-admin__empty">{children}</p>;
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="cq-grid-admin__panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function phaseStatus(
  phase: GridRuntimeMaintenanceSweepResult['lifecycle'],
): string {
  if (phase.status === 'failed') return 'Failed';
  if (phase.status === 'skipped') return 'Skipped';
  return phase.result.changed ? 'Updated' : 'Current';
}

function lifecycleSummary(
  phase: GridRuntimeMaintenanceSweepResult['lifecycle'],
): string {
  if (phase.status === 'failed') return phase.error;
  if (phase.status === 'skipped') return phase.reason;
  return phase.result.changed
    ? phase.result.previousStatus + ' → ' + phase.result.status
    : phase.result.status + ' confirmed';
}

function auctionSummary(
  phase: GridRuntimeMaintenanceSweepResult['auctions'],
): string {
  if (phase.status === 'failed') return phase.error;
  if (phase.status === 'skipped') return phase.reason;
  return (
    phase.result.settled +
    ' settled · ' +
    phase.result.alreadySettled +
    ' already settled · ' +
    phase.result.failed +
    ' failed'
  );
}

function rewardSummary(
  phase: GridRuntimeMaintenanceSweepResult['contractRewards'],
): string {
  if (phase.status === 'failed') return phase.error;
  if (phase.status === 'skipped') return phase.reason;
  return (
    phase.result.applied +
    ' paid · ' +
    phase.result.duplicates +
    ' duplicates · ' +
    phase.result.failed +
    ' failed'
  );
}

export default function GridAdminClient() {
  const [overview, setOverview] = useState<GridAdminOverview | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [maintenanceResult, setMaintenanceResult] =
    useState<GridRuntimeMaintenanceSweepResult | null>(null);
  const [maintenanceError, setMaintenanceError] =
    useState<string | null>(null);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/grid/overview${q ? `?q=${encodeURIComponent(q)}` : ''}`,
        { cache: 'no-store' },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body.error || 'Unable to load Grid operations data.',
        );
      }
      setOverview(body.overview);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to load Grid operations data.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const runMaintenance = useCallback(async () => {
    setMaintenanceBusy(true);
    setMaintenanceError(null);
    try {
      const response = await fetch('/api/admin/grid/runtime/sweep', {
        method: 'POST',
      });
      const body = (await response.json()) as MaintenanceResponse;
      if (!response.ok || !body.result) {
        throw new Error(
          body.error || 'Unable to run Grid maintenance.',
        );
      }

      setMaintenanceResult(body.result);
      if (!body.success) {
        setMaintenanceError(
          'Maintenance completed with one or more failures. Review the phase results below.',
        );
      }
      await load(query);
    } catch (reason) {
      setMaintenanceError(
        reason instanceof Error
          ? reason.message
          : 'Unable to run Grid maintenance.',
      );
    } finally {
      setMaintenanceBusy(false);
    }
  }, [load, query]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !overview) {
    return (
      <main className="cq-grid-admin">
        <p className="cq-grid-admin__status">
          Loading Grid operations…
        </p>
      </main>
    );
  }

  if (error && !overview) {
    return (
      <main className="cq-grid-admin">
        <p className="cq-grid-admin__error">{error}</p>
      </main>
    );
  }

  if (!overview) return null;

  return (
    <main className="cq-grid-admin">
      <header className="cq-grid-admin__header">
        <div>
          <p className="cq-grid-admin__eyebrow">
            THE GRID / GAME MASTER
          </p>
          <h1>Operations Console</h1>
          <p>
            Live command visibility and guarded maintenance for Canton&apos;s
            game world.
          </p>
        </div>
        <button
          className="cq-grid-admin__refresh"
          onClick={() => void load(query)}
        >
          Refresh
        </button>
      </header>

      {error && <p className="cq-grid-admin__error">{error}</p>}

      <Panel title="Season state">
        <div className="cq-grid-admin__season">
          <strong>{overview.season.seasonName}</strong>
          <span>
            {overview.season.cityName} · {overview.season.status}
          </span>
          <span>
            Surge:{' '}
            {overview.season.surgeStartsAt
              ? new Date(
                  overview.season.surgeStartsAt,
                ).toLocaleString()
              : 'not scheduled'}
          </span>
        </div>
        <div className="cq-grid-admin__metrics">
          <span>
            <b>{overview.counts.players}</b> players
          </span>
          <span>
            <b>{overview.counts.occupiedTerritories}</b> territories held
          </span>
          <span>
            <b>{overview.counts.occupiedProperties}</b> properties held
          </span>
          <span>
            <b>{overview.counts.activeContests}</b> contests
          </span>
          <span>
            <b>{overview.counts.activeAuctions}</b> auctions
          </span>
        </div>
      </Panel>

      <Panel title="Runtime maintenance">
        <div className="cq-grid-admin__maintenance-head">
          <div>
            <strong>Lifecycle · Auctions · Contract rewards</strong>
            <p>
              Reconcile the season clock, settle expired auctions, and pay
              pending Contract reward intents using the enabled server-side
              systems.
            </p>
          </div>
          <button
            className="cq-grid-admin__maintenance-button"
            disabled={maintenanceBusy}
            onClick={() => void runMaintenance()}
          >
            {maintenanceBusy
              ? 'Running maintenance…'
              : 'Run maintenance sweep'}
          </button>
        </div>

        {maintenanceError && (
          <p className="cq-grid-admin__maintenance-warning">
            {maintenanceError}
          </p>
        )}

        {maintenanceResult && (
          <div className="cq-grid-admin__maintenance-results">
            <article>
              <span>Season lifecycle</span>
              <strong>{phaseStatus(maintenanceResult.lifecycle)}</strong>
              <small>
                {lifecycleSummary(maintenanceResult.lifecycle)}
              </small>
            </article>
            <article>
              <span>Expired auctions</span>
              <strong>
                {maintenanceResult.auctions.status === 'completed'
                  ? 'Processed'
                  : maintenanceResult.auctions.status === 'failed'
                    ? 'Failed'
                    : 'Skipped'}
              </strong>
              <small>
                {auctionSummary(maintenanceResult.auctions)}
              </small>
            </article>
            <article>
              <span>Contract rewards</span>
              <strong>
                {maintenanceResult.contractRewards.status === 'completed'
                  ? 'Processed'
                  : maintenanceResult.contractRewards.status === 'failed'
                    ? 'Failed'
                    : 'Skipped'}
              </strong>
              <small>
                {rewardSummary(maintenanceResult.contractRewards)}
              </small>
            </article>
          </div>
        )}
      </Panel>

      <Panel title="Player lookup">
        <form
          className="cq-grid-admin__search"
          onSubmit={(event) => {
            event.preventDefault();
            void load(query);
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={80}
            placeholder="Search display name"
            aria-label="Search display name"
          />
          <button type="submit">Search</button>
        </form>
        {overview.players.length ? (
          <div className="cq-grid-admin__rows">
            {overview.players.map((player) => (
              <article
                key={`${player.displayName}-${player.totalXp}`}
              >
                <strong>{player.displayName}</strong>
                <span>
                  Level {player.level} · {player.totalXp.toLocaleString()} XP
                </span>
                <span>
                  {player.credits.toLocaleString()} Credits ·{' '}
                  {player.influence} Influence · {player.commandPoints} CP
                </span>
              </article>
            ))}
          </div>
        ) : (
          <Empty>No players match this lookup.</Empty>
        )}
      </Panel>

      <div className="cq-grid-admin__columns">
        <Panel title="Territory control">
          {overview.territories.length ? (
            <div className="cq-grid-admin__rows">
              {overview.territories.map((territory) => (
                <article key={territory.slug}>
                  <strong>{territory.name}</strong>
                  <span>{territory.districtName}</span>
                  <span>
                    {territory.ownerDisplayName || 'Neutral'}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <Empty>No territories are provisioned yet.</Empty>
          )}
        </Panel>

        <Panel title="Property ownership">
          {overview.properties.length ? (
            <div className="cq-grid-admin__rows">
              {overview.properties.map((property) => (
                <article key={property.slug}>
                  <strong>{property.name}</strong>
                  <span>
                    {property.territoryName} ·{' '}
                    {property.ownerDisplayName || 'Neutral'}
                  </span>
                  <span>
                    Development {property.developmentLevel} · Condition{' '}
                    {Math.round(property.conditionBps / 100)}%
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <Empty>No properties are provisioned yet.</Empty>
          )}
        </Panel>
      </div>

      <div className="cq-grid-admin__columns">
        <Panel title="Active contests">
          {overview.activeContests.length ? (
            <div className="cq-grid-admin__rows">
              {overview.activeContests.map((contest) => (
                <article
                  key={`${contest.sourceTerritoryName}-${contest.targetTerritoryName}`}
                >
                  <strong>
                    {contest.sourceTerritoryName} →{' '}
                    {contest.targetTerritoryName}
                  </strong>
                  <span>
                    {contest.status} · started{' '}
                    {new Date(contest.startedAt).toLocaleString()}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <Empty>No active contests.</Empty>
          )}
        </Panel>

        <Panel title="Auctions">
          {overview.auctions.length ? (
            <div className="cq-grid-admin__rows">
              {overview.auctions.map((auction) => (
                <article
                  key={`${auction.propertyName}-${auction.endsAt}`}
                >
                  <strong>{auction.propertyName}</strong>
                  <span>
                    {auction.status} · ends{' '}
                    {new Date(auction.endsAt).toLocaleString()}
                  </span>
                  <span>
                    Leading bid:{' '}
                    {auction.leadingBidCredits === null
                      ? 'none'
                      : `${auction.leadingBidCredits.toLocaleString()} Credits`}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <Empty>No active auctions.</Empty>
          )}
        </Panel>
      </div>

      <div className="cq-grid-admin__columns">
        <Panel title="Market activity">
          {overview.marketTransactions.length ? (
            <div className="cq-grid-admin__rows">
              {overview.marketTransactions.map((transaction) => (
                <article key={transaction.transactedAt}>
                  <strong>{transaction.propertyName}</strong>
                  <span>
                    {transaction.priceCredits.toLocaleString()} Credits ·{' '}
                    {new Date(
                      transaction.transactedAt,
                    ).toLocaleString()}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <Empty>No recent market transactions.</Empty>
          )}
        </Panel>

        <Panel title="NPC strongholds">
          <Empty>
            {overview.availability.strongholds === 'unavailable'
              ? 'No live stronghold projection is connected yet.'
              : 'No active NPC strongholds.'}
          </Empty>
        </Panel>

        <Panel title="Dynamic events">
          <Empty>
            {overview.availability.dynamicEvents === 'unavailable'
              ? 'No live dynamic-event projection is connected yet.'
              : 'No scheduled dynamic events.'}
          </Empty>
        </Panel>
      </div>

      <Panel title="Audit activity">
        {overview.activity.length ? (
          <div className="cq-grid-admin__rows">
            {overview.activity.map((event, index) => (
              <article key={`${event.createdAt}-${index}`}>
                <strong>{event.eventType}</strong>
                <span>
                  {event.entityType || 'system'} ·{' '}
                  {event.actorDisplayName || 'system actor'} ·{' '}
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <Empty>No activity recorded yet.</Empty>
        )}
      </Panel>

      <p className="cq-grid-admin__footnote">
        Guarded Game Master checkpoint · generated{' '}
        {new Date(overview.generatedAt).toLocaleString()} · no private IDs or
        raw event payloads are exposed.
      </p>
    </main>
  );
}
