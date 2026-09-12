import { notFound } from 'next/navigation';
import { cantonFoundingSeasonPackage } from '../../lib/grid/cities/canton/founding-season';
import { validateGridCityPackage } from '../../lib/grid/core/city-package';
import { isGridFoundationEnabled } from '../../lib/grid/server/feature-flags';

export const dynamic = 'force-dynamic';

export default function GridFoundationPage() {
  if (!isGridFoundationEnabled()) notFound();

  const pkg = cantonFoundingSeasonPackage;
  const validation = validateGridCityPackage(pkg);

  return (
    <main className="cq-grid-foundation">
      <section className="cq-grid-foundation__panel">
        <p className="cq-grid-foundation__eyebrow">THE GRID</p>
        <h1 className="cq-grid-foundation__title">Canton — City #001</h1>
        <p className="cq-grid-foundation__season">Founding Season</p>
        <p className="cq-grid-foundation__copy">
          Multi-city engine foundation online. Gameplay remains locked while
          Canton geography and core systems are built and validated.
        </p>

        <dl className="cq-grid-foundation__status">
          <div>
            <dt>Package</dt>
            <dd>v{pkg.packageVersion}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{pkg.status.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Validation</dt>
            <dd>{validation.ok ? 'PASS' : 'BLOCKED'}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
