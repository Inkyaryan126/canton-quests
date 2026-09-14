#!/usr/bin/env python3

import hashlib
import json
from pathlib import Path

from shapely.geometry import (
    GeometryCollection,
    LineString,
    MultiLineString,
    mapping,
    shape,
)

ROOT = Path("research/grid/canton/source-data")
RAW = ROOT / "raw"
OUT = ROOT / "processed"

OUT.mkdir(parents=True, exist_ok=True)

BOUNDARY_FILE = RAW / "canton-city-boundary.geojson"

ROAD_SOURCES = [
    ("primary", RAW / "canton-primary-roads.geojson"),
    ("secondary", RAW / "canton-secondary-roads.geojson"),
    ("local", RAW / "canton-local-roads.geojson"),
]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract_lines(geometry):
    if geometry.is_empty:
        return []

    if isinstance(geometry, LineString):
        return [geometry]

    if isinstance(geometry, MultiLineString):
        return list(geometry.geoms)

    if isinstance(geometry, GeometryCollection):
        result = []
        for part in geometry.geoms:
            result.extend(extract_lines(part))
        return result

    return []


boundary_data = json.loads(BOUNDARY_FILE.read_text())
boundary_features = boundary_data.get("features", [])

if len(boundary_features) != 1:
    raise SystemExit(
        f"Expected exactly one Canton boundary; got {len(boundary_features)}"
    )

boundary = shape(boundary_features[0]["geometry"])

if not boundary.is_valid:
    boundary = boundary.buffer(0)

if boundary.is_empty:
    raise SystemExit("Canton boundary is empty after validation")

print("Canton boundary loaded")
print("Boundary bounds:", boundary.bounds)

report = {
    "schemaVersion": 1,
    "cityId": "canton-oh",
    "boundarySource": str(BOUNDARY_FILE),
    "boundarySha256": sha256(BOUNDARY_FILE),
    "layers": {},
}

for layer_name, source_file in ROAD_SOURCES:
    source = json.loads(source_file.read_text())

    input_features = source.get("features", [])
    output_features = []

    dropped = 0
    line_parts = 0

    for feature in input_features:
        geometry_data = feature.get("geometry")

        if not geometry_data:
            dropped += 1
            continue

        road_geometry = shape(geometry_data)

        if road_geometry.is_empty:
            dropped += 1
            continue

        clipped = road_geometry.intersection(boundary)
        parts = extract_lines(clipped)

        if not parts:
            dropped += 1
            continue

        line_parts += len(parts)

        if len(parts) == 1:
            final_geometry = parts[0]
        else:
            final_geometry = MultiLineString(parts)

        properties = dict(feature.get("properties") or {})
        properties["_gridSourceLayer"] = layer_name
        properties["_gridCityId"] = "canton-oh"

        output_features.append(
            {
                "type": "Feature",
                "properties": properties,
                "geometry": mapping(final_geometry),
            }
        )

    output_features.sort(
        key=lambda feature: (
            str(feature["properties"].get("OID", "")),
            str(feature["properties"].get("NAME", "")),
        )
    )

    output = {
        "type": "FeatureCollection",
        "name": f"canton-{layer_name}-roads-clipped",
        "features": output_features,
    }

    destination = OUT / f"canton-{layer_name}-roads.geojson"

    destination.write_text(
        json.dumps(
            output,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    )

    # Hard validation: every resulting road must be contained by Canton.
    violations = 0

    for feature in output_features:
        geom = shape(feature["geometry"])

        if not boundary.covers(geom):
            violations += 1

    if violations:
        raise SystemExit(
            f"{layer_name}: {violations} clipped geometries escaped Canton boundary"
        )

    layer_report = {
        "source": str(source_file),
        "sourceSha256": sha256(source_file),
        "inputFeatures": len(input_features),
        "outputFeatures": len(output_features),
        "droppedOutsideBoundary": dropped,
        "outputLineParts": line_parts,
        "output": str(destination),
        "outputSha256": sha256(destination),
        "containmentViolations": violations,
    }

    report["layers"][layer_name] = layer_report

    print()
    print(layer_name.upper())
    print(" input features :", len(input_features))
    print(" output features:", len(output_features))
    print(" dropped        :", dropped)
    print(" line parts     :", line_parts)
    print(" violations     :", violations)

report_file = OUT / "clip-report.json"

report_file.write_text(
    json.dumps(report, indent=2, sort_keys=True) + "\n"
)

print()
print("Processed geography written to:", OUT)
print("Report:", report_file)
print("CANTON_CLIP_OK")
