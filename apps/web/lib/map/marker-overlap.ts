export interface MapPointLike {
  id: string;
  latitude: number;
  longitude: number;
}

export interface SpreadMapPoint<TPoint extends MapPointLike> {
  point: TPoint;
  latitude: number;
  longitude: number;
  displayLatitude: number;
  displayLongitude: number;
  overlapIndex: number;
  overlapCount: number;
  isOffset: boolean;
}

const EARTH_METERS_PER_DEGREE_LATITUDE = 111_320;

function keyFor(point: MapPointLike) {
  return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
}

function offsetCoordinate(latitude: number, longitude: number, eastMeters: number, northMeters: number) {
  const latitudeDelta = northMeters / EARTH_METERS_PER_DEGREE_LATITUDE;
  const longitudeMetersPerDegree = Math.max(1, EARTH_METERS_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180));
  const longitudeDelta = eastMeters / longitudeMetersPerDegree;

  return {
    latitude: latitude + latitudeDelta,
    longitude: longitude + longitudeDelta
  };
}

export function spreadOverlappingMapPoints<TPoint extends MapPointLike>(
  points: readonly TPoint[],
  radiusMeters = 22
): Array<SpreadMapPoint<TPoint>> {
  const groups = new Map<string, TPoint[]>();
  for (const point of points) {
    const key = keyFor(point);
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }

  const spreadByPoint = new Map<TPoint, SpreadMapPoint<TPoint>>();
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const overlapCount = ordered.length;

    ordered.forEach((point, overlapIndex) => {
      if (overlapCount === 1) {
        spreadByPoint.set(point, {
          point,
          latitude: point.latitude,
          longitude: point.longitude,
          displayLatitude: point.latitude,
          displayLongitude: point.longitude,
          overlapIndex: 0,
          overlapCount,
          isOffset: false
        });
        return;
      }

      const angle = (Math.PI * 2 * overlapIndex) / overlapCount - Math.PI / 2;
      const radius = Math.min(52, Math.max(radiusMeters, 14 + overlapCount * 2));
      const display = offsetCoordinate(point.latitude, point.longitude, Math.cos(angle) * radius, Math.sin(angle) * radius);
      spreadByPoint.set(point, {
        point,
        latitude: point.latitude,
        longitude: point.longitude,
        displayLatitude: display.latitude,
        displayLongitude: display.longitude,
        overlapIndex,
        overlapCount,
        isOffset: true
      });
    });
  }

  return points.map((point) => spreadByPoint.get(point)!);
}
