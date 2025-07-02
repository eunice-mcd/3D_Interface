import React from 'react'

export interface BuildingData {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  color: string;
  type: string;
}

export interface NeighborhoodData {
  buildings: BuildingData[];
  centerSpace: {
    position: { x: number; y: number; z: number };
    dimensions: { width: number; height: number; depth: number };
  };
  metadata: {
    version: string;
    created: string;
    description: string;
  };
}

export const createDummyNeighborhood = (): NeighborhoodData => {
  const buildings: BuildingData[] = [
    {
      id: 'north-tower',
      name: 'North Residential Tower',
      position: { x: 0, y: 5, z: -15 }, // y = height/2 to sit on ground
      dimensions: { width: 8, height: 10, depth: 6 }, // Max 10m per side
      color: '#2c3e50',
      type: 'residential'
    },
    {
      id: 'south-mall',
      name: 'South Shopping Mall',
      position: { x: 2, y: 4, z: 15 }, // y = height/2
      dimensions: { width: 10, height: 8, depth: 9 },
      color: '#2c3e50',
      type: 'commercial'
    },
    {
      id: 'east-office',
      name: 'East Office Complex',
      position: { x: 18, y: 4.5, z: -2 }, // y = height/2
      dimensions: { width: 7, height: 9, depth: 8 },
      color: '#2c3e50',
      type: 'commercial'
    },
    {
      id: 'west-mixed',
      name: 'West Mixed Development',
      position: { x: -18, y: 3.5, z: 3 }, // y = height/2
      dimensions: { width: 9, height: 7, depth: 8 },
      color: '#2c3e50',
      type: 'mixed'
    },
    {
      id: 'northwest-industrial',
      name: 'Northwest Industrial Hub',
      position: { x: -12, y: 3, z: -12 }, // y = height/2
      dimensions: { width: 10, height: 6, depth: 9 },
      color: '#2c3e50',
      type: 'industrial'
    },
  ];

  return {
    buildings,
    centerSpace: {
      position: { x: 0, y: 0, z: 0 }, // Ground level
      dimensions: { width: 50, height: 0.2, depth: 50 } // Thin ground plane
    },
    metadata: {
      version: "1.0",
      created: new Date().toISOString(),
      description: "Meter-scaled neighborhood with ground-based buildings"
    }
  };
};


export const encodeNeighborhoodToBase64 = (data: NeighborhoodData): string => {
  const jsonString = JSON.stringify(data, null, 2);
  return btoa(jsonString);
};

export const decodeNeighborhoodFromBase64 = (base64: string): NeighborhoodData => {
  try {
    const decoded = atob(base64);
    return JSON.parse(decoded) as NeighborhoodData;
  } catch (error) {
    throw new Error('Invalid base64 neighborhood data format');
  }
};