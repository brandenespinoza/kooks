"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

/**
 * Tap-to-drop-a-pin map for the Add Break flow (FR-1).
 *
 * Loaded only via `next/dynamic` with `ssr: false` — Leaflet touches `window` at import
 * time and throws during server rendering.
 *
 * Leaflet's default marker is a PNG resolved from a relative path that bundlers rewrite,
 * which is why the stock marker renders broken in most React setups. A `divIcon` sidesteps
 * the asset pipeline entirely and lets the pin use the Morning Light palette.
 */
const pinIcon = L.divIcon({
  className: "",
  html: `<span style="
    display:block;width:18px;height:18px;border-radius:9999px;
    background:#1a3a5c;border:3px solid #f5f0e8;
    box-shadow:0 1px 6px rgba(0,0,0,0.45);
  "></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** Emerald Isle, NC — the primary user's home water, so the map opens where she surfs. */
const DEFAULT_CENTER: [number, number] = [34.6618, -77.0669];

function ClickCapture({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

export default function BreakMap({
  pin,
  onPick,
  center = DEFAULT_CENTER,
}: {
  pin: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  center?: [number, number];
}) {
  return (
    <MapContainer
      center={pin ? [pin.lat, pin.lng] : center}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ClickCapture onPick={onPick} />
      {pin && <Marker position={[pin.lat, pin.lng]} icon={pinIcon} />}
    </MapContainer>
  );
}
