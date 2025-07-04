import { OrbitControls, Line, Html } from "@react-three/drei";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { computeSceneCenter, CanvasContent, BuildingMeshes } from "./buildingHelper";

// Update the PolygonData type definition to include originalIndex:
type PolygonData = {
    vertices: [number, number][];
    height: number;
    isMain: boolean;
    buffer?: [number, number][];
    floorLevel?: number;
    baseBuilding?: number;
    originalIndex?: number; // Add this line
};

interface BuildingSceneProps {
    buildings: PolygonData[];
    roads: [number, number][][];
}

export default function BuildingScene({
    buildings,
    roads,
}: BuildingSceneProps) {
    const [buildingList, setBuildingList] = useState(buildings);
    const [selected, setSelected] = useState<number | null>(null);
    const [history, setHistory] = useState<PolygonData[][]>([]);
    const [isMoving, setIsMoving] = useState(false);
    const [moveOffset, setMoveOffset] = useState<[number, number] | null>(null);
    const [editMode, setEditMode] = useState<{
        buildingIdx: number;
        faceIndex: number;
    } | null>(null);
    const [moveMode, setMoveMode] = useState(false);
    const [activeTool, setActiveTool] = useState<string>('select');
    const [extrudeHeight, setExtrudeHeight] = useState<string>('10');
    const [showHeightInput, setShowHeightInput] = useState(false);
    const [selectedForExtrude, setSelectedForExtrude] = useState<number | null>(null);
    const [showFloorInput, setShowFloorInput] = useState(false);
    const [floorHeight, setFloorHeight] = useState<string>('3');
    const [numberOfFloors, setNumberOfFloors] = useState<string>('1');
    const [selectedForFloors, setSelectedForFloors] = useState<number | null>(null);
    const [is2DView, setIs2DView] = useState(false);
    const [showCoordinates, setShowCoordinates] = useState(false);
    const [siteCoordinates, setSiteCoordinates] = useState<any>(null);

    // Add a new state for site measurements
    const [showSiteMeasurements, setShowSiteMeasurements] = useState(false);
    const [siteMeasurements, setSiteMeasurements] = useState<any>(null);

    const orbitRef = useRef<any>(null);

    const calculateSiteCoordinates = useCallback(() => {
        if (buildingList.length === 0) {
            alert('No buildings found to calculate site coordinates');
            return;
        }

        const mainBuilding = buildingList.find(b => b.isMain);
        if (!mainBuilding) {
            alert('No main site boundary found');
            return;
        }

        const { centerX, centerY } = computeSceneCenter(buildingList, roads);

        const gridSize = 2000;  // Total grid size
        const gridDivisions = 1000;  // Number of divisions
        const cellSize = gridSize / gridDivisions;

        const siteBoundary = mainBuilding.vertices.map(([x, y], index) => {
            const displayX = x - centerX;
            const displayY = y - centerY;
            const gridX = Math.round(displayX / cellSize);
            const gridY = Math.round(displayY / cellSize);
            return { x: gridX, y: gridY, z: 0 };
        });

        const minX = Math.min(...siteBoundary.map(v => v.x));
        const maxX = Math.max(...siteBoundary.map(v => v.x));
        const minY = Math.min(...siteBoundary.map(v => v.y));
        const maxY = Math.max(...siteBoundary.map(v => v.y));

        const siteWidth = maxX - minX;
        const siteHeight = maxY - minY;

        const isPointInPolygon = (x: number, y: number, polygon: [number, number][]) => {
            let inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i][0], yi = polygon[i][1];
                const xj = polygon[j][0], yj = polygon[j][1];

                const intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        const isBuildingInsideSite = (building: PolygonData) => {
            return building.vertices.every(([x, y]) =>
                isPointInPolygon(x, y, mainBuilding.vertices));
        };

        // Group buildings by their base building to calculate cumulative heights
        const buildingGroups: { [key: number]: PolygonData[] } = {};
        
        buildingList.forEach((building, index) => {
            if (!building.isMain && isBuildingInsideSite(building)) {
                const baseIndex = building.baseBuilding ?? index;
                if (!buildingGroups[baseIndex]) {
                    buildingGroups[baseIndex] = [];
                }
                buildingGroups[baseIndex].push({ ...building, originalIndex: index });
            }
        });

        const buildings = Object.entries(buildingGroups).flatMap(([baseIndex, group]) => {
            // Sort floors by floor level (base building first, then floors in order)
            const sortedGroup = group.sort((a, b) => (a.floorLevel || 0) - (b.floorLevel || 0));
            
            let cumulativeHeight = 0;
            
            return sortedGroup.map((building, groupIndex) => {
                const currentFloorZ = cumulativeHeight;
                const nextFloorZ = cumulativeHeight + building.height;
                
                // Update cumulative height for next floor
                cumulativeHeight += building.height;

                const baseVertices = building.vertices.map(([x, y], index) => {
                    const displayX = x - centerX;
                    const displayY = y - centerY;
                    const gridX = Math.round(displayX / cellSize);
                    const gridY = Math.round(displayY / cellSize);
                    return {
                        index,
                        position: 'base',
                        x: gridX,
                        y: gridY,
                        z: currentFloorZ // Base of current floor
                    };
                });

                const topVertices = building.vertices.map(([x, y], index) => {
                    const displayX = x - centerX;
                    const displayY = y - centerY;
                    const gridX = Math.round(displayX / cellSize);
                    const gridY = Math.round(displayY / cellSize);
                    return {
                        index,
                        position: 'top',
                        x: gridX,
                        y: gridY,
                        z: nextFloorZ // Top of current floor (cumulative)
                    };
                });

                const allCorners = [...baseVertices, ...topVertices];

                return {
                    id: building.originalIndex || parseInt(baseIndex),
                    height: building.height,
                    isFloor: building.floorLevel !== undefined,
                    floorLevel: building.floorLevel || 0,
                    baseBuilding: building.baseBuilding,
                    corners: allCorners,
                    zPosition: {
                        base: currentFloorZ,
                        top: nextFloorZ,
                        totalHeight: cumulativeHeight
                    }
                };
            });
        });

        const coordinatesData = {
            site: {
                boundary: siteBoundary,
                dimensions: {
                    width: siteWidth,
                    height: siteHeight,
                    area: siteWidth * siteHeight
                },
                gridInfo: {
                    cellSize,
                    gridSize,
                    gridDivisions
                }
            },
            buildings: buildings,
            metadata: {
                coordinateSystem: "Grid",
                timestamp: new Date().toISOString(),
                note: "Z coordinates represent cumulative heights for stacked floors"
            }
        };

        setSiteCoordinates(coordinatesData);
        setShowCoordinates(true);
    }, [buildingList, roads]);

    const exportCoordinatesJSON = () => {
        if (!siteCoordinates) {
            calculateSiteCoordinates();
            return;
        }

        const dataStr = JSON.stringify(siteCoordinates, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `site_coordinates_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const getMainSiteGridPoints = () => {
        const mainBuilding = buildingList.find(b => b.isMain);
        if (!mainBuilding) {
            console.error("No main building found");
            return null;
        }

        const { centerX, centerY } = computeSceneCenter(buildingList, roads);
        const gridSize = 2000;  // Total grid size
        const gridDivisions = 1000;  // Number of divisions
        const cellSize = gridSize / gridDivisions;

        const gridPoints = mainBuilding.vertices.map(([x, y], index) => {
            const displayX = x - centerX;
            const displayY = y - centerY;
            const gridX = Math.round(displayX / cellSize);
            const gridY = Math.round(displayY / cellSize);

            return {
                index,
                grid: [gridX, gridY]
            };
        });

        return gridPoints;
    };

    // Update the getSiteSideLengthsInMeters function to show results:
    const getSiteSideLengthsInMeters = () => {
        const mainBuilding = buildingList.find(b => b.isMain);
        if (!mainBuilding) {
            alert('No main site boundary found');
            return null;
        }

        const vertices = mainBuilding.vertices;
        if (vertices.length < 3) {
            alert('Site boundary needs at least 3 points');
            return null;
        }

        const sides = [];
        let totalPerimeter = 0;
        
        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length];
            const distance = Math.sqrt(
                Math.pow(v2[0] - v1[0], 2) +
                Math.pow(v2[1] - v1[1], 2)
            );

            sides.push({
                start: i,
                end: (i + 1) % vertices.length,
                length: distance,
                startPoint: v1,
                endPoint: v2
            });
            
            totalPerimeter += distance;
        }

        // Calculate area using shoelace formula
        let area = 0;
        for (let i = 0; i < vertices.length; i++) {
            const j = (i + 1) % vertices.length;
            area += vertices[i][0] * vertices[j][1];
            area -= vertices[j][0] * vertices[i][1];
        }
        area = Math.abs(area) / 2;

        const measurementData = {
            sides: sides,
            totalPerimeter: totalPerimeter,
            area: area,
            numberOfSides: vertices.length,
            timestamp: new Date().toISOString()
        };

        setSiteMeasurements(measurementData);
        setShowSiteMeasurements(true);
        
        return sides;
    };

    const exportCoordinatesCSV = () => {
        if (!siteCoordinates) {
            calculateSiteCoordinates();
            return;
        }

        let csvContent = "Type,ID,X,Y,Z,Additional_Info\n";

        siteCoordinates.site.boundary.forEach((point: any, index: number) => {
            csvContent += `Site_Boundary,${index},${point.x},${point.y},${point.z},Corner_${index}\n`;
        });

        siteCoordinates.buildings.forEach((building: any) => {
            building.vertices.forEach((vertex: any, vIndex: number) => {
                csvContent += `Building,${building.buildingId}_${vIndex},${vertex.x},${vertex.y},${vertex.z},Height_${building.height}\n`;
            });
        });

        siteCoordinates.roads.forEach((road: any) => {
            road.vertices.forEach((vertex: any, vIndex: number) => {
                csvContent += `Road,${road.roadId}_${vIndex},${vertex.x},${vertex.y},${vertex.z},Road_Point\n`;
            });
        });

        const dataBlob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `site_coordinates_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const pushHistory = useCallback(() => {
        setHistory((prev: any) => [
            ...prev,
            buildingList.map((b: any) => ({
                ...b,
                vertices: b.vertices.map((v: any) => [...v] as [number, number]),
                buffer: b.buffer ? b.buffer.map((v: any) => [...v] as [number, number]) : undefined
            }))
        ]);
    }, [buildingList]);

    const handlePreciseExtrude = () => {
        if (selectedForExtrude === null) return;
        const height = parseFloat(extrudeHeight);
        if (isNaN(height) || height <= 0) {
            alert('Please enter a valid height value');
            return;
        }

        pushHistory();
        setBuildingList((prev: any) =>
            prev.map((b: any, i: any) => {
                if (i !== selectedForExtrude) return b;
                return { ...b, height: height };
            })
        );


        setShowHeightInput(false);
        setSelectedForExtrude(null);
        setActiveTool('select');
    };

    // Add this function to handle floor creation
    const handleCreateFloors = () => {
        if (selectedForFloors === null) return;

        const height = parseFloat(floorHeight);
        const floors = parseInt(numberOfFloors);

        if (isNaN(height) || height <= 0) {
            alert('Please enter a valid floor height value');
            return;
        }

        if (isNaN(floors) || floors <= 0 || floors > 20) {
            alert('Please enter a valid number of floors (1-20)');
            return;
        }

        pushHistory();

        const selectedBuilding = buildingList[selectedForFloors];
        if (!selectedBuilding || !selectedBuilding.vertices) return;

        const newBuildings: PolygonData[] = [];

        for (let i = 0; i < floors; i++) {
            const floorBuilding: PolygonData = {
                vertices: selectedBuilding.vertices.map((v: any) => [...v] as [number, number]),
                height: height,
                isMain: false,
                buffer: selectedBuilding.buffer?.map((v: any) => [...v] as [number, number]),
                floorLevel: i + 1,
                baseBuilding: selectedForFloors
            };
            newBuildings.push(floorBuilding);
        }

        setBuildingList((prev: any) => [...prev, ...newBuildings]);
        setShowFloorInput(false);
        setSelectedForFloors(null);
        setActiveTool('select');
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "z") {
                setHistory((prev: any) => {
                    if (prev.length === 0) return prev;
                    const last = prev[prev.length - 1];
                    setBuildingList(last);
                    return prev.slice(0, -1);
                });
            }

            if (e.key === "Delete" && selected !== null) {
                pushHistory();
                setBuildingList((prev: any) => prev.filter((_: any, i: any) => i !== selected));
                setSelected(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selected, pushHistory]);


    const handleFaceDoubleClick = (buildingIdx: number, faceIndex: number, event: any) => {
        setEditMode({ buildingIdx, faceIndex });
    };


    // Add this function to export coordinates in IDF format
    const exportBuildingCoordinates = () => {
        if (!siteCoordinates) {
            alert('Please calculate site coordinates first');
            return;
        }

        // Create simplified building coordinates data
        const buildingCoordinatesData: any = {
            location: {
                latitude: 12.9858,  // Bangalore coordinates - replace with actual OSM fetched coordinates
                longitude: 77.6081
            },
            buildings: []
        };

        // Group buildings by base building
        const buildingGroups: { [key: number]: any[] } = {};
        
        siteCoordinates.buildings.forEach((building: any) => {
            const baseId = building.baseBuilding || building.id;
            if (!buildingGroups[baseId]) {
                buildingGroups[baseId] = [];
            }
            buildingGroups[baseId].push(building);
        });

        // Create simplified building data for each group
        Object.entries(buildingGroups).forEach(([baseId, floors], buildingIndex) => {
            // Sort floors by floor level
            floors.sort((a, b) => (a.floorLevel || 0) - (b.floorLevel || 0));
            
            const buildingData = {
                buildingName: `Building ${buildingIndex + 1}`,
                zones: floors.map((floor, floorIndex) => {
                    // Get base and top vertices
                    const baseVertices = floor.corners.filter((corner: any) => corner.position === 'base');
                    const topVertices = floor.corners.filter((corner: any) => corner.position === 'top');

                    // Create surfaces for this zone
                    const surfaces: any = {};

                    // Floor surface (using base vertices)
                    surfaces.floor = {
                        surfaceName: "Floor",
                        vertices: baseVertices.map((vertex: any, index: number) => ({
                            name: `Floor_Vertex_${index + 1}`,
                            coordinates: `(${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)}, ${vertex.z.toFixed(2)})`
                        }))
                    };

                    // Ceiling surface (using top vertices)
                    surfaces.ceiling = {
                        surfaceName: "Ceiling",
                        vertices: topVertices.map((vertex: any, index: number) => ({
                            name: `Ceiling_Vertex_${index + 1}`,
                            coordinates: `(${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)}, ${vertex.z.toFixed(2)})`
                        }))
                    };

                    // Wall surfaces (connecting base and top vertices)
                    surfaces.walls = [];
                    for (let i = 0; i < baseVertices.length; i++) {
                        const nextIndex = (i + 1) % baseVertices.length;
                        
                        const wallVertices = [
                            // Bottom edge of wall (base level)
                            {
                                name: `Wall_${i + 1}_Vertex_1`,
                                coordinates: `(${baseVertices[i].x.toFixed(2)}, ${baseVertices[i].y.toFixed(2)}, ${baseVertices[i].z.toFixed(2)})`
                            },
                            {
                                name: `Wall_${i + 1}_Vertex_2`,
                                coordinates: `(${baseVertices[nextIndex].x.toFixed(2)}, ${baseVertices[nextIndex].y.toFixed(2)}, ${baseVertices[nextIndex].z.toFixed(2)})`
                            },
                            // Top edge of wall (top level)
                            {
                                name: `Wall_${i + 1}_Vertex_3`,
                                coordinates: `(${topVertices[nextIndex].x.toFixed(2)}, ${topVertices[nextIndex].y.toFixed(2)}, ${topVertices[nextIndex].z.toFixed(2)})`
                            },
                            {
                                name: `Wall_${i + 1}_Vertex_4`,
                                coordinates: `(${topVertices[i].x.toFixed(2)}, ${topVertices[i].y.toFixed(2)}, ${topVertices[i].z.toFixed(2)})`
                            }
                        ];

                        surfaces.walls.push({
                            surfaceName: `Wall ${i + 1}`,
                            vertices: wallVertices
                        });
                    }

                    return {
                        zoneName: `Building ${buildingIndex + 1} Zone ${floorIndex + 1}`,
                        floorName: `Building ${buildingIndex + 1} - Floor ${floorIndex + 1}`,
                        floorNumber: floorIndex + 1,
                        floorLevel: floor.floorLevel || 0,
                        floorHeight: floor.height,
                        surfaces: surfaces
                    };
                })
            };

            buildingCoordinatesData.buildings.push(buildingData);
        });

        // Export the simplified coordinates JSON
        const dataStr = JSON.stringify(buildingCoordinatesData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `building_zones_surfaces_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);

        // Log simplified output to console
        console.log('=== BUILDING ZONES WITH SURFACES ===');
        buildingCoordinatesData.buildings.forEach((building: any) => {
            console.log(`\n${building.buildingName}:`);
            building.zones.forEach((zone: any) => {
                console.log(`\n  ${zone.zoneName}:`);
                console.log(`  ${zone.floorName}`);
                
                // Log floor
                console.log(`    Floor:`);
                zone.surfaces.floor.vertices.forEach((vertex: any) => {
                    console.log(`      ${vertex.name}: ${vertex.coordinates}`);
                });
                
                // Log walls
                zone.surfaces.walls.forEach((wall: any, wallIndex: number) => {
                    console.log(`    ${wall.surfaceName}:`);
                    wall.vertices.forEach((vertex: any) => {
                        console.log(`      ${vertex.name}: ${vertex.coordinates}`);
                    });
                });
                
                // Log ceiling
                console.log(`    Ceiling:`);
                zone.surfaces.ceiling.vertices.forEach((vertex: any) => {
                    console.log(`      ${vertex.name}: ${vertex.coordinates}`);
                });
            });
        });

        alert(`Exported ${buildingCoordinatesData.buildings.length} buildings with surfaces (walls, floor, ceiling) for each zone`);
    };

    return (
        <>
            <div
                style={{
                    position: "absolute",
                    zIndex: 20,
                    top: 20,
                    left: 20,
                    right: 20,
                    backgroundColor: "white",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    padding: "10px",
                }}
            >
                <div style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>
                    Tools
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: activeTool === 'select' ? "#e0e0e0" : "#f9f9f9",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => {
                            setActiveTool('select');
                            setMoveMode(false);
                        }}
                    >
                        🖱️ Select
                    </button>

                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: moveMode ? "#00ccff" : "#f9f9f9",
                            color: moveMode ? "white" : "black",
                            border: moveMode ? "2px solid #0088cc" : "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => {
                            setMoveMode(!moveMode);
                            setActiveTool(moveMode ? 'select' : 'move');
                        }}
                    >
                        🏃 Move
                    </button>

                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: activeTool === 'pan' ? "#e0e0e0" : "#f9f9f9",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => {
                            setActiveTool('pan');
                            setMoveMode(false);
                        }}
                    >
                        🖐️ Pan
                    </button>

                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: activeTool === 'rectangle' ? "#e0e0e0" : "#f9f9f9",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => setActiveTool('rectangle')}
                    >
                        ⬜ Rectangle
                    </button>

                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: activeTool === 'circle' ? "#e0e0e0" : "#f9f9f9",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => setActiveTool('circle')}
                    >
                        ⭕ Circle
                    </button>

                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: activeTool === 'polygon' ? "#e0e0e0" : "#f9f9f9",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => setActiveTool('polygon')}
                    >
                        🔷 Polygon
                    </button>

                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: activeTool === 'pushpull' ? "#e0e0e0" : "#f9f9f9",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => setActiveTool('pushpull')}
                    >
                        📏 Push/Pull
                    </button>

                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: activeTool === 'extrude' ? "#e0e0e0" : "#f9f9f9",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => setActiveTool('extrude')}
                    >
                        🔼 Extrude
                    </button>

                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: showHeightInput ? "#ffcc00" : "#f9f9f9",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => {
                            if (selected !== null && buildingList[selected]?.height <= 0.1) {
                                setSelectedForExtrude(selected);
                                setShowHeightInput(true);
                            } else {
                                alert('Please select a 2D shape to extrude');
                            }
                        }}
                    >
                        📐 Height Input
                    </button>

                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: showFloorInput ? "#ffaa00" : "#f9f9f9",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => {
                            if (selected !== null && buildingList[selected]?.height > 0.1) {
                                setSelectedForFloors(selected);
                                setShowFloorInput(true);
                            } else {
                                alert('Please select a 3D building to add floors');
                            }
                        }}
                    >
                        🏢 Create Floors
                    </button>

                    {/* Keep Show Coordinates Button */}
                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: "#4CAF50",
                            color: "white",
                            border: "1px solid #45a049",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={calculateSiteCoordinates}
                    >
                        📊 Show Coordinates
                    </button>

                    <button
                        onClick={getMainSiteGridPoints}
                        style={{
                            padding: "8px 12px",
                            backgroundColor: "#FF9800",
                            color: "white",
                            border: "1px solid #F57C00",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                    >
                        Get Site Grid Points
                    </button>

                    <button
                        onClick={getSiteSideLengthsInMeters}
                        style={{
                            padding: "8px 12px",
                            backgroundColor: "#9C27B0",
                            color: "white",
                            border: "1px solid #7B1FA2",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                    >
                        📏 Site Measurements
                    </button>

                    <button
                        style={{
                            padding: "8px 12px",
                            backgroundColor: is2DView ? "#4CAF50" : "#f9f9f9",
                            color: is2DView ? "white" : "black",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                        onClick={() => {
                            setIs2DView(!is2DView);
                            if (orbitRef.current) {
                                if (!is2DView) {

                                    orbitRef.current.object.position.set(0, 0, 800);
                                    orbitRef.current.object.lookAt(0, 0, 0);
                                    orbitRef.current.enableRotate = false;
                                    orbitRef.current.target.set(0, 0, 0);
                                } else {

                                    orbitRef.current.object.position.set(200, 300, 400);
                                    orbitRef.current.object.lookAt(0, 0, 0);
                                    orbitRef.current.enableRotate = true;
                                }
                                orbitRef.current.update();
                            }
                        }}
                    >
                        🗺️ {is2DView ? '3D View' : '2D View'}
                    </button>

                    <button
                        onClick={exportBuildingCoordinates}
                        style={{
                            padding: "8px 12px",
                            backgroundColor: "#2E7D32",
                            color: "white",
                            border: "1px solid #1B5E20",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                        }}
                    >
                        📐 Export Building Coordinates
                    </button>
                </div>

                {showHeightInput && (
                    <div style={{
                        marginTop: "10px",
                        padding: "10px",
                        backgroundColor: "#f0f0f0",
                        borderRadius: "4px",
                        border: "1px solid #ddd"
                    }}>
                        <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px" }}>
                            Enter Extrusion Height:
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input
                                type="number"
                                value={extrudeHeight}
                                onChange={(e) => setExtrudeHeight(e.target.value)}
                                placeholder="Enter height"
                                style={{
                                    padding: "4px 8px",
                                    border: "1px solid #ddd",
                                    borderRadius: "4px",
                                    width: "80px",
                                    fontSize: "12px"
                                }}
                                min="0.1"
                                step="0.1"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handlePreciseExtrude();
                                    }
                                }}
                            />
                            <span style={{ fontSize: "12px", color: "#666" }}>units</span>
                            <button
                                style={{
                                    padding: "4px 12px",
                                    backgroundColor: "#00cc00",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "12px"
                                }}
                                onClick={handlePreciseExtrude}
                            >
                                Apply
                            </button>
                            <button
                                style={{
                                    padding: "4px 12px",
                                    backgroundColor: "#ff4444",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "12px"
                                }}
                                onClick={() => {
                                    setShowHeightInput(false);
                                    setSelectedForExtrude(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                        {selectedForExtrude !== null && (
                            <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                                Selected building: {selectedForExtrude} (Current height: {buildingList[selectedForExtrude]?.height.toFixed(1)})
                            </div>
                        )}
                    </div>
                )}

                {showFloorInput && (
                    <div style={{
                        marginTop: "10px",
                        padding: "10px",
                        backgroundColor: "#fff3e0",
                        borderRadius: "4px",
                        border: "1px solid #ffaa00"
                    }}>
                        <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px" }}>
                            Create Floors:
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <label style={{ fontSize: "11px" }}>Floors:</label>
                                <input
                                    type="number"
                                    value={numberOfFloors}
                                    onChange={(e) => setNumberOfFloors(e.target.value)}
                                    placeholder="Number"
                                    style={{
                                        padding: "4px 8px",
                                        border: "1px solid #ddd",
                                        borderRadius: "4px",
                                        width: "60px",
                                        fontSize: "12px"
                                    }}
                                    min="1"
                                    max="20"
                                    step="1"
                                />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <label style={{ fontSize: "11px" }}>Height:</label>
                                <input
                                    type="number"
                                    value={floorHeight}
                                    onChange={(e) => setFloorHeight(e.target.value)}
                                    placeholder="Floor height"
                                    style={{
                                        padding: "4px 8px",
                                        border: "1px solid #ddd",
                                        borderRadius: "4px",
                                        width: "70px",
                                        fontSize: "12px"
                                    }}
                                    min="0.1"
                                    step="0.1"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCreateFloors();
                                        }
                                    }}
                                />
                                <span style={{ fontSize: "11px", color: "#666" }}>units</span>
                            </div>
                            <button
                                style={{
                                    padding: "4px 12px",
                                    backgroundColor: "#ff9900",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "12px"
                                }}
                                onClick={handleCreateFloors}
                            >
                                Create
                            </button>
                            <button
                                style={{
                                    padding: "4px 12px",
                                    backgroundColor: "#ff4444",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "12px"
                                }}
                                onClick={() => {
                                    setShowFloorInput(false);
                                    setSelectedForFloors(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                        {selectedForFloors !== null && (
                            <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                                Base building: {selectedForFloors} (Height: {buildingList[selectedForFloors]?.height.toFixed(1)}) |
                                Total floors will be: {numberOfFloors} × {floorHeight} = {(parseInt(numberOfFloors) * parseFloat(floorHeight)).toFixed(1)} units
                            </div>
                        )}
                    </div>
                )}
            </div>


            {showCoordinates && siteCoordinates && (
                <div
                    style={{
                        position: "absolute",
                        zIndex: 25,
                        top: "120px",
                        right: "20px",
                        width: "400px",
                        maxHeight: "70vh",
                        backgroundColor: "white",
                        border: "2px solid #4CAF50",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        overflow: "auto",
                    }}
                >
                    <div style={{
                        padding: "10px",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}>
                        <h3 style={{ margin: 0, fontSize: "14px" }}>Site Grid Coordinates</h3>
                        <button
                            onClick={() => setShowCoordinates(false)}
                            style={{
                                background: "none",
                                border: "none",
                                color: "white",
                                fontSize: "16px",
                                cursor: "pointer"
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    <div style={{ padding: "15px" }}>
                        {/* Site Boundary */}
                        <div style={{ marginBottom: "15px" }}>
                            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#333" }}>
                                🏗️ Site Boundary Grid Points
                            </h4>
                            <div style={{ fontSize: "11px", marginBottom: "8px", color: "#666" }}>
                                Grid Dimensions: {siteCoordinates.site.dimensions.width.toFixed(2)} × {siteCoordinates.site.dimensions.height.toFixed(2)} units
                                (Grid Area: {siteCoordinates.site.dimensions.area.toFixed(2)} grid units)
                            </div>
                            <div style={{
                                backgroundColor: "#f5f5f5",
                                padding: "8px",
                                borderRadius: "4px",
                                fontFamily: "monospace",
                                fontSize: "11px"
                            }}>
                                {siteCoordinates.site.boundary.map((point: any, index: number) => (
                                    <div key={index}>
                                        Grid Point {index}: ({point.x.toFixed(2)}, {point.y.toFixed(2)})
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Buildings Grid Points - NEW SECTION */}
                        {siteCoordinates.buildings && siteCoordinates.buildings.length > 0 && (
                            <div style={{ marginBottom: "15px" }}>
                                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#333" }}>
                                    🏢 Building Grid Points (Cumulative Z Heights)
                                </h4>
                                <div style={{ fontSize: "11px", marginBottom: "8px", color: "#666" }}>
                                    {siteCoordinates.buildings.length} buildings inside site boundary
                                </div>

                                {siteCoordinates.buildings.map((building: any, bIndex: number) => (
                                    <div
                                        key={bIndex}
                                        style={{
                                            backgroundColor: building.isFloor ? "#f0f8ff" : "#f5f5f5",
                                            padding: "8px",
                                            borderRadius: "4px",
                                            fontFamily: "monospace",
                                            fontSize: "11px",
                                            marginBottom: "10px",
                                            border: building.isFloor ? "1px solid #87CEEB" : "none"
                                        }}
                                    >
                                        <div style={{
                                            fontWeight: "bold",
                                            marginBottom: "5px",
                                            borderBottom: "1px solid #ddd",
                                            paddingBottom: "3px"
                                        }}>
                                            {building.isFloor ? 
                                                `Floor ${building.floorLevel} (Base: ${building.baseBuilding})` : 
                                                `Building ${building.id}`
                                            }
                                            - Floor Height: {building.height.toFixed(2)}
                                        </div>
                                        
                                        {/* Show Z position information */}
                                        <div style={{ 
                                            fontSize: "10px", 
                                            color: "#0066cc", 
                                            marginBottom: "5px",
                                            fontWeight: "bold"
                                        }}>
                                            Z Range: {building.zPosition.base.toFixed(2)} → {building.zPosition.top.toFixed(2)} 
                                            (Total Stack Height: {building.zPosition.totalHeight.toFixed(2)})
                                        </div>

                                        {building.corners.map((point: any, pIndex: number) => (
                                            <div key={pIndex} style={{
                                                color: point.position === 'base' ? '#666' : '#000'
                                            }}>
                                                Corner {point.index} ({point.position}):
                                                ({point.x.toFixed(2)}, {point.y.toFixed(2)}, {point.z.toFixed(2)})
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}


                        <div style={{ marginBottom: "15px" }}>
                            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#333" }}>
                                📏 Grid System Information
                            </h4>
                            <div style={{
                                backgroundColor: "#f0f7ff",
                                padding: "8px",
                                borderRadius: "4px",
                                fontSize: "11px"
                            }}>
                                <div>Grid Size: {siteCoordinates.site.gridInfo.gridSize} units</div>
                                <div>Grid Divisions: {siteCoordinates.site.gridInfo.gridDivisions}</div>
                                <div>Cell Size: {siteCoordinates.site.gridInfo.cellSize} units</div>
                            </div>
                        </div>

                        {/* Export Buttons */}
                        <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "15px" }}>
                            <button
                                onClick={exportCoordinatesJSON}
                                style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#2196F3",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "11px"
                                }}
                            >
                                📄 Download JSON
                            </button>
                            <button
                                onClick={exportCoordinatesCSV}
                                style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#FF9800",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "11px"
                                }}
                            >
                                📊 Download CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSiteMeasurements && siteMeasurements && (
                <div
                    style={{
                        position: "absolute",
                        zIndex: 25,
                        top: "120px",
                        left: "20px",
                        width: "400px",
                        maxHeight: "70vh",
                        backgroundColor: "white",
                        border: "2px solid #9C27B0",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        overflow: "auto",
                    }}
                >
                    <div style={{
                        padding: "10px",
                        backgroundColor: "#9C27B0",
                        color: "white",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}>
                        <h3 style={{ margin: 0, fontSize: "14px" }}>📏 Site Measurements</h3>
                        <button
                            onClick={() => setShowSiteMeasurements(false)}
                            style={{
                                background: "none",
                                border: "none",
                                color: "white",
                                fontSize: "16px",
                                cursor: "pointer"
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    <div style={{ padding: "15px" }}>
                        {/* Summary Information */}
                        <div style={{ marginBottom: "15px" }}>
                            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#333" }}>
                                📊 Site Summary
                            </h4>
                            <div style={{
                                backgroundColor: "#f8f4ff",
                                padding: "8px",
                                borderRadius: "4px",
                                fontSize: "11px"
                            }}>
                                <div><strong>Total Perimeter:</strong> {siteMeasurements.totalPerimeter.toFixed(2)} meters</div>
                                <div><strong>Site Area:</strong> {siteMeasurements.area.toFixed(2)} square meters</div>
                                <div><strong>Number of Sides:</strong> {siteMeasurements.numberOfSides}</div>
                            </div>
                        </div>

                        {/* Individual Side Measurements */}
                        <div style={{ marginBottom: "15px" }}>
                            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#333" }}>
                                📐 Side Measurements
                            </h4>
                            <div style={{
                                backgroundColor: "#f5f5f5",
                                padding: "8px",
                                borderRadius: "4px",
                                fontFamily: "monospace",
                                fontSize: "11px",
                                maxHeight: "200px",
                                overflowY: "auto"
                            }}>
                                {siteMeasurements.sides.map((side: any, index: number) => (
                                    <div key={index} style={{ 
                                        marginBottom: "6px", 
                                        paddingBottom: "6px", 
                                        borderBottom: index < siteMeasurements.sides.length - 1 ? "1px solid #ddd" : "none" 
                                    }}>
                                        <div><strong>Side {index + 1}:</strong> {side.length.toFixed(2)} meters</div>
                                        <div style={{ fontSize: "10px", color: "#666" }}>
                                            From Point {side.start} to Point {side.end}
                                        </div>
                                        <div style={{ fontSize: "10px", color: "#666" }}>
                                            ({side.startPoint[0].toFixed(2)}, {side.startPoint[1].toFixed(2)}) → 
                                            ({side.endPoint[0].toFixed(2)}, {side.endPoint[1].toFixed(2)})
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Export Button for Measurements */}
                        <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "15px" }}>
                            <button
                                onClick={() => {
                                    const dataStr = JSON.stringify(siteMeasurements, null, 2);
                                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                                    const url = URL.createObjectURL(dataBlob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `site_measurements_${new Date().toISOString().split('T')[0]}.json`;
                                    link.click();
                                    URL.revokeObjectURL(url);
                                }}
                                style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#9C27B0",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "11px"
                                }}
                            >
                                📄 Download Measurements
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Canvas
                camera={{ position: [0, 0, 500], fov: 50 }}
                shadows
                style={{ width: "100vw", height: "100vh", background: "#E8E8E8" }}
            >
                <CanvasContent
                    buildingList={buildingList}
                    setBuildingList={setBuildingList}
                    selected={selected}
                    setSelected={setSelected}
                    isMoving={isMoving}
                    setIsMoving={setIsMoving}
                    moveOffset={moveOffset}
                    setMoveOffset={setMoveOffset}
                    roads={roads}
                    orbitRef={orbitRef}
                    onFaceDoubleClick={handleFaceDoubleClick}
                    moveMode={moveMode}
                    activeTool={activeTool}
                    is2DView={is2DView}
                    setIs2DView={setIs2DView}
                />
            </Canvas>


        </>
    );
}

