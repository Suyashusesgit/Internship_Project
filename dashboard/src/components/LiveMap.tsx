"use client";

import React, { useEffect, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

interface LiveMapProps {
  lat: number | null;
  lon: number | null;
  label?: string;
}

type LeafletModules = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MapContainer: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TileLayer: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Marker: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Popup: React.ComponentType<any>;
  mapRef: LeafletMap | null;
};

/**
 * Shows the dog's current GPS location on a Leaflet map.
 * Dynamically imported to prevent SSR issues.
 */
export default function LiveMapInner({ lat, lon, label = "Dog location" }: LiveMapProps) {
  const [mods, setMods] = useState<LeafletModules | null>(null);

  useEffect(() => {
    Promise.all([import("react-leaflet"), import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([rl, L]) => {
      // Fix Leaflet default marker icon paths broken by webpack/turbopack
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
        Marker: rl.Marker,
        Popup: rl.Popup,
        mapRef: null,
      });
    });
  }, []);

  if (!mods) {
    return <MapPlaceholder label="Loading map…" height={260} />;
  }

  if (lat === null || lon === null) {
    return <MapPlaceholder label="No GPS fix yet" height={260} />;
  }

  const { MapContainer, TileLayer, Marker, Popup } = mods;

  return (
    <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", height: 260 }}>
      <MapContainer
        center={[lat, lon]}
        zoom={16}
        style={{ width: "100%", height: "260px" }}
        key={`${lat}-${lon}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lon]}>
          <Popup>{label}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

function MapPlaceholder({ label, height }: { label: string; height: number }) {
  return (
    <div
      style={{
        height,
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
      <div
        style={{
          padding: "var(--space-3)",
          background: "var(--bg-input)",
          borderRadius: "50%",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}
