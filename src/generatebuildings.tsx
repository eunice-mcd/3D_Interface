import React, { useEffect, useState } from "react";
import BuildingScene from "./BuildingScene";
import * as turf from "@turf/turf";

type LatLon = [number, number];

interface PolygonData {
  vertices: [number, number][];
  height: number;
  isMain: boolean;
  buffer?: [number, number][];
}

async function fetchOSMBuildings(
  polygon: LatLon[],
  bufferDistance = 250
): Promise<{ polygons: PolygonData[]; roads: [number, number][][] }> {
  const geojsonPoly = turf.polygon([[...polygon.map(([lon, lat]) => [lon, lat])]]);
  const buffered = turf.buffer(geojsonPoly, bufferDistance, { units: "meters" });
  if (!buffered || !buffered.geometry || !buffered.geometry.coordinates) {
    throw new Error("Buffering failed. Check input polygon.");
  }

  const bufferedCoords = buffered.geometry.coordinates[0]
    .map((pt: any) => `${pt[1]} ${pt[0]}`)
    .join(" ");

  const buildingQuery = `
    [out:json];
    (
      way["building"](poly:"${bufferedCoords}");
    );
    out body;
    >;
    out skel qt;
  `;

  const highwayQuery = `
    [out:json];
    (
      way["highway"](poly:"${bufferedCoords}");
    );
    out body;
    >;
    out skel qt;
  `;

  const [buildingResp, highwayResp] = await Promise.all([
    fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(buildingQuery)),
    fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(highwayQuery)),
  ]);

  const [buildingData, highwayData] = await Promise.all([
    buildingResp.json(),
    highwayResp.json(),
  ]);

  // Merge node data from both results
  const nodeLookup: Record<number, { lat: number; lon: number }> = {};
  for (const data of [buildingData, highwayData]) {
    for (const el of data.elements) {
      if (el.type === "node") nodeLookup[el.id] = { lat: el.lat, lon: el.lon };
    }
  }

  const mercMain = polygon.map(([lon, lat]) => latlonToWebMercator(lon, lat));
  const mercBuffer = buffered.geometry.coordinates[0].map(
    (pt: any) => latlonToWebMercator(pt[0], pt[1])
  );

  const polygons: PolygonData[] = [
    { vertices: mercMain, height: 0, isMain: true, buffer: mercBuffer },
  ];

  // Buildings
  for (const el of buildingData.elements) {
    if (el.type !== "way" || !el.nodes) continue;
    const coords: LatLon[] = el.nodes
      .map((n: number) =>
        nodeLookup[n] ? [nodeLookup[n].lon, nodeLookup[n].lat] : null
      )
      .filter(Boolean) as LatLon[];
    if (coords.length < 3) continue;
    const mercVertices = coords.map(([lon, lat]) =>
      latlonToWebMercator(lon, lat)
    );
    polygons.push({
      vertices: mercVertices,
      height: Math.random() * 15 + 10,
      isMain: false,
    });
  }

  // Highways
  const roads: [number, number][][] = [];
  for (const el of highwayData.elements) {
    if (
      el.type === "way" &&
      el.tags &&
      el.tags.highway &&
      el.nodes
    ) {
      const coords: LatLon[] = el.nodes
        .map((n: number) =>
          nodeLookup[n] ? [nodeLookup[n].lon, nodeLookup[n].lat] : null
        )
        .filter(Boolean) as LatLon[];

      if (coords.length < 2) continue;
      const isClosed =
        coords.length > 2 &&
        coords[0][0] === coords[coords.length - 1][0] &&
        coords[0][1] === coords[coords.length - 1][1];
      if (isClosed) continue;

      const mercCoords = coords.map(([lon, lat]) =>
        latlonToWebMercator(lon, lat)
      );
      roads.push(mercCoords);
    }
  }

  return { polygons, roads };
}


// Web Mercator conversion
function latlonToWebMercator(lon: number, lat: number): [number, number] {
  const R = 6378137;
  const x = (lon * Math.PI * R) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R;
  return [x, y];
}

export default function GenerateBuildings() {
  const polygon: [number, number][] = [
        [
            77.60811946037832,
            12.985979516439556
        ],
        [
            77.60829652602337,
            12.986230849997597
        ],
        [
            77.60856979266505,
            12.986025707528569
        ],
        [
            77.60843176514815,
            12.985968647997993
        ],
        [
            77.60811946037832,
            12.985979516439556
        ]
    ];


    

  const [sceneData, setSceneData] = useState<{ polygons: PolygonData[]; roads: [number, number][][] } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    const result = await fetchOSMBuildings(polygon);
    setSceneData(result);
    setLoading(false);
  };

  useEffect(() => {
    handleFetch()
  },[])

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      {loading && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "24px" }}>
          Loading buildings...      
        </div>
      )}
      {sceneData && (
        <BuildingScene buildings={sceneData.polygons} roads={sceneData.roads} />
      )}
    </div>
  );
}