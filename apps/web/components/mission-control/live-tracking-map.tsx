"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { DriverLocation } from "@tomp/types/domain";
import { spreadOverlappingMapPoints } from "@/lib/map/marker-overlap";

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
  idle: "#0ea5e9",
  slow: "#f59e0b",
  offline: "#f43f5e",
  stopped: "#64748b"
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
      const valid = spreadOverlappingMapPoints(points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)));

      for (const spread of valid) {
        const point = spread.point;
        const trail = trailsRef.current.get(point.id) ?? [];
        const last = trail[trail.length - 1];
        if (!last || last[0] !== point.latitude || last[1] !== point.longitude) {
          trail.push([point.latitude, point.longitude]);
          if (trail.length > 30) trail.shift();
          trailsRef.current.set(point.id, trail);
        }

        const color = TRACKING_MARKER_COLORS[point.freshness];
        if (trail.length > 1) {
          L.polyline(trail, { color, weight: 3, opacity: 0.5 }).addTo(layer);
        }

        if (spread.isOffset) {
          L.polyline(
            [
              [spread.latitude, spread.longitude],
              [spread.displayLatitude, spread.displayLongitude]
            ],
            { color, weight: 1.5, opacity: 0.45, dashArray: "3 5" }
          ).addTo(layer);
        }

        const popup =
          `<strong>${escapeHtml(point.title)}</strong><br/>${escapeHtml(point.subtitle)}<br/><span style="color:${color}">● ล่าสุด ${escapeHtml(point.ageLabel)}</span>` +
          (point.accuracy ? `<br/>ความแม่นยำ ${Math.round(point.accuracy)} ม.` : "") +
          (spread.isOffset ? `<br/>พิกัดจริงซ้อนกับ ${spread.overlapCount} คัน จึงแยกหมุดบนแผนที่เพื่อให้อ่านง่าย` : "");

        L.circleMarker([spread.displayLatitude, spread.displayLongitude], {
          radius: 9,
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 1
        })
          .bindPopup(popup)
          .addTo(layer);
      }

      if (valid.length && firstFitRef.current) {
        firstFitRef.current = false;
        const bounds = L.latLngBounds(valid.map((spread) => [spread.latitude, spread.longitude] as [number, number]));
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
