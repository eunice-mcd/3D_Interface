import React, { useEffect, useState } from "react";
import proj4 from "proj4";

type LatLon = [number, number];
type MeterCoord = [number, number];

const inputCoords: LatLon[] = [
  [77.60811946037832, 12.985979516439556],
  [77.60829652602337, 12.986230849997597],
  [77.60856979266505, 12.986025707528569],
  [77.60843176514815, 12.985968647997993],
  [77.60811946037832, 12.985979516439556]
];

// EPSG:4326 (WGS84) -> EPSG:32643 (UTM Zone 43N for Bangalore)
proj4.defs("EPSG:32643", "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs");

function latLonArrayToLocalMeters(coords: LatLon[]): MeterCoord[] {
  if (!coords.length) return [];
  const utmCoords = coords.map(([lon, lat]) =>
    proj4('EPSG:4326', 'EPSG:32643', [lon, lat]) as MeterCoord
  );
  const [x0, y0] = utmCoords[0];
  return utmCoords.map(([x, y]) => [parseFloat((x - x0).toFixed(2)), parseFloat((y - y0).toFixed(2))]);
}

const UTMConverter: React.FC = () => {
  const [convertedCoords, setConvertedCoords] = useState<MeterCoord[]>([]);

  useEffect(() => {
    setConvertedCoords(latLonArrayToLocalMeters(inputCoords));
  }, []);

  return (
    <div style={{ padding: '1rem', fontFamily: 'monospace' }}>
      <h3>Converted Site Coordinates (in meters)</h3>
      <ul>
        {convertedCoords.map(([x, y], i) => (
          <li key={i}>
            Point {i}: [{x >= 0 ? x.toFixed(2) : `-${Math.abs(x).toFixed(2)}`}, {y >= 0 ? y.toFixed(2) : `-${Math.abs(y).toFixed(2)}`}]
            {x < 0 && " (left of first vertex)"}
            {y < 0 && " (below first vertex)"}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UTMConverter;