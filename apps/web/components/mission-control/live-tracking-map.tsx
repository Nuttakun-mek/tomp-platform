"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { DriverLocation } from "@tomp/types/domain";

export type MarkerFreshness = "live" | "idle" | "slow" | "offline" | "stopped";

export interface TrackedPoint {
  id: string;
  latitude: number;
  longitude: number;
  freshness: MarkerFreshness;
  title: string;
  subtitle: string;
  ageLabel: string;
  accuracy: number | null;
}

export const TRACKING_MARKER_COLORS: Record<MarkerFreshness, string> = {
  live: "#10b981",
  // Parked and heartbeating — working, just not moving, so it must not read as
  // a warning colour.
  idle: "#0ea5e9",
  slow: "#f59e0b",
  offline: "#f43f5e",
  stopped: "#64748b"
};

// Real interactive map (Leaflet + OSM tiles) with one marker per driver. Trails
// are kept per driver id across refreshes so movement is visible.
export function LiveTrackingMap({ points, height = 480 }: { points: TrackedPoint[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const trailsRef = useRef<Map<string, Array<[number, number]>>>(new Map());
  const firstFitRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView([13.7563, 100.5018], 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();
      const valid = points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

      for (const p of valid) {
        const trail = trailsRef.current.get(p.id) ?? [];
        const last = trail[trail.length - 1];
        if (!last || last[0] !== p.latitude || last[1] !== p.longitude) {
          trail.push([p.latitude, p.longitude]);
          if (trail.length > 30) trail.shift();
          trailsRef.current.set(p.id, trail);
        }
        if (trail.length > 1) {
          L.polyline(trail, { color: TRACKING_MARKER_COLORS[p.freshness], weight: 3, opacity: 0.5 }).addTo(layer);
        }

        const color = TRACKING_MARKER_COLORS[p.freshness];
        L.circleMarker([p.latitude, p.longitude], {
          radius: 9,
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 1
        })
          .bindPopup(
            `<strong>${p.title}</strong><br/>${p.subtitle}<br/><span style="color:${color}">● ${p.ageLabel}</span>` +
              (p.accuracy ? `<br/>ความแม่นยำ ${Math.round(p.accuracy)} ม.` : "")
          )
          .addTo(layer);
      }

      if (valid.length && firstFitRef.current) {
        firstFitRef.current = false;
        const bounds = L.latLngBounds(valid.map((p) => [p.latitude, p.longitude] as [number, number]));
        map.fitBounds(bounds.pad(0.3), { maxZoom: 15 });
      }
    })();
  }, [points]);

  return <div ref={containerRef} className="w-full" style={{ height }} aria-label="แผนที่ติดตามคนขับ" />;
}

export function toTrackedPoint(location: DriverLocation, freshness: MarkerFreshness, title: string, subtitle: string, ageLabel: string): TrackedPoint {
  return {
    id: location.assignmentId || location.driverId || location.id,
    latitude: location.latitude,
    longitude: location.longitude,
    freshness,
    title,
    subtitle,
    ageLabel,
    accuracy: location.accuracy ?? null
  };
}
