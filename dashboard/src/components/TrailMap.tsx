"use client";

import React, { useEffect, useState } from "react";

interface GpsPoint {
  lat: number;
  lon: number;
  time: number;
}

interface TrailMapProps {
  trail: GpsPoint[];
}

type LeafletModules = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MapContainer: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TileLayer: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Polyline: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CircleMarker: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Popup: React.ComponentType<any>;
};

/**
 * Renders a GPS trail as a polyline on a Leaflet map.
 * Start point = indigo circle, most recent = teal circle.
 */
export default function TrailMapInner({ trail }: TrailMapProps) {
  const [mods, setMods] = useState<LeafletModules | null>(null);

  useEffect(() => {
    Promise.all([import("react-leaflet"), import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([rl, L]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
      setMods({
        MapContainer: rl.MapContainer,
        TileLayer: rl.TileLayer,
        Polyline: rl.Polyline,
        CircleMarker: rl.CircleMarker,
        Popup: rl.Popup,
      });
    });
  }, []);

  if (!mods) return <MapPlaceholder label="Loading map…" />;
  if (trail.length === 0) return <MapPlaceholder label="No GPS data in selected range" />;

  const { MapContainer, TileLayer, Polyline, CircleMarker, Popup } = mods;
  const positions: [number, number][] = trail.map((p) => [p.lat, p.lon]);
  const last = trail[trail.length - 1];

  const avgLat = trail.reduce((s, p) => s + p.lat, 0) / trail.length;
  const avgLon = trail.reduce((s, p) => s + p.lon, 0) / trail.length;

  return (
    <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", height: 340 }}>
      <MapContainer
        center={[avgLat, avgLon]}
        zoom={14}
        style={{ width: "100%", height: "340px" }}
        key={trail.length}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline
          positions={positions}
          pathOptions={{ color: "#14b8a6", weight: 3, opacity: 0.85 }}
        />
        {/* Start marker — indigo */}
        <CircleMarker
          center={positions[0]}
          radius={6}
          pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 1, weight: 2 }}
        >
          <Popup>Start</Popup>
        </CircleMarker>
        {/* End marker — teal */}
        <CircleMarker
          center={[last.lat, last.lon]}
          radius={8}
          pathOptions={{ color: "#14b8a6", fillColor: "#14b8a6", fillOpacity: 1, weight: 2 }}
        >
          <Popup>
            Most recent location
            <br />
            {new Date(last.time).toLocaleString()}
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}

function MapPlaceholder({ label }: { label: string }) {
  return (
    <div
      style={{
        height: 340,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
        <path d="M3 11l19-9-9 19-2-8-8-2z" />
      </svg>
      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}
