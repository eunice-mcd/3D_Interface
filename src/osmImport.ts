import { latLonToMeters } from "./buildingHelper";

// Example OSM coordinates array
const osmCoords: { lat: number; lon: number }[] = [
    { lat: 12.9716, lon: 77.5946 },
    { lat: 12.9717, lon: 77.5947 },
    // ...add your coordinates here
];

const origin = osmCoords[0];
const verticesInMeters = osmCoords.map((pt) =>
    latLonToMeters(pt.lat, pt.lon, origin.lat, origin.lon)
);
// Use verticesInMeters for your building polygons