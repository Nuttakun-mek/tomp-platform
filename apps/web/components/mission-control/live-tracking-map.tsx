"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { DriverLocation } from "@tomp/types/domain";
import { spreadOverlappingMapPoints } from "@/lib/map/marker-overlap";
import { inferVehicleIcon, vehicleIconSvgMarkup, type VehicleIconKey } from "@/lib/domain/vehicle-icon";

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
  vehicleIcon?: VehicleIconKey;
  vehicleType?: string | null;
}

export const TRACKING_MARKER_COLORS: Record<MarkerFreshness, string> = {
  live: "#10b981",
  idle: "#0ea5e9",
  slow: "#f59e0b",
  offline: "#f43f5e",
  stopped: "#64748b"
};

const TRACKING_MARKER_STATUS_ICON: Record<MarkerFreshness, string> = {
  live: "✓",
  idle: "●",
  slow: "!",
  offline: "×",
  stopped: "■"
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
  const [focusedPointId, setFocusedPointId] = useState<string | null>(null);

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
    function handleFocus(event: Event) {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (detail?.id) setFocusedPointId(detail.id);
    }

    window.addEventListener("tomp:focus-map-point", handleFocus);
    return () => window.removeEventListener("tomp:focus-map-point", handleFocus);
  }, []);

  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();
      const valid = spreadOverlappingMapPoints(points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)));

      let focusedMarker: ReturnType<typeof L.marker> | null = null;
      let focusedLatLng: [number, number] | null = null;

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

        const marker = L.marker([spread.displayLatitude, spread.displayLongitude], {
          icon: L.divIcon({
            className: "",
            html: `<span class="tomp-map-marker" style="--marker-color:${color}">${vehicleIconSvgMarkup(point.vehicleIcon ?? "sedan")}<span class="tomp-map-marker-status">${TRACKING_MARKER_STATUS_ICON[point.freshness]}</span></span>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            popupAnchor: [0, -18]
          })
        })
          .bindPopup(popup)
          .addTo(layer);
        if (focusedPointId && point.id === focusedPointId) {
          focusedMarker = marker;
          focusedLatLng = [spread.displayLatitude, spread.displayLongitude];
        }
      }

      if (focusedMarker && focusedLatLng) {
        map.setView(focusedLatLng, Math.max(map.getZoom(), 16), { animate: true });
        focusedMarker.openPopup();
      } else if (valid.length && firstFitRef.current) {
        firstFitRef.current = false;
        const bounds = L.latLngBounds(valid.map((spread) => [spread.latitude, spread.longitude] as [number, number]));
        map.fitBounds(bounds.pad(0.3), { maxZoom: 15 });
      }
    })();
  }, [focusedPointId, points]);

  return <div ref={containerRef} className="w-full" style={{ height }} aria-label="แผนที่ติดตามคนขับ" />;
}

export function toTrackedPoint(location: DriverLocation, freshness: MarkerFreshness, title: string, subtitle: string, ageLabel: string): TrackedPoint {
  const vehicleType = typeof location.metadata.vehicleType === "string" ? location.metadata.vehicleType : null;
  const capacity = typeof location.metadata.vehicleCapacity === "number" ? location.metadata.vehicleCapacity : null;
  return {
    id: location.assignmentId || location.driverId || location.id,
    latitude: location.latitude,
    longitude: location.longitude,
    freshness,
    title,
    subtitle,
    ageLabel,
    accuracy: location.accuracy ?? null,
    vehicleIcon: inferVehicleIcon({ icon: location.metadata.vehicleIcon, vehicleType, capacity }),
    vehicleType
  };
}
