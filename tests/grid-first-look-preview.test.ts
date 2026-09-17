import { describe, expect, it } from 'vitest';
import GridWorldClient from '../app/grid/grid-world-client';
import GridPreviewPage, { metadata } from '../app/grid/preview/page';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';

describe('Grid first-look preview', () => {
  it('renders the real Canton read-only world through the existing City Board', () => {
    const element = GridPreviewPage();

    expect(element.type).toBe(GridWorldClient);
    expect(element.props.initialProjection.readOnly).toBe(true);
    expect(element.props.initialProjection.source).toBe('compiled-package');
    expect(element.props.initialProjection.city.slug).toBe(cantonFoundingSeasonPackage.city.slug);
    expect(element.props.initialProjection.counts.territories).toBe(cantonFoundingSeasonPackage.territories.length);
    expect(element.props.initialProjection.counts.properties).toBe(cantonFoundingSeasonPackage.properties.length);
  });

  it('keeps the private first-look page out of search indexes', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
