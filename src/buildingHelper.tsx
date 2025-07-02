import React, { useRef, useState, useEffect, useCallback } from "react";
import { OrbitControls, Line, Html } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";


type PolygonData = {
    vertices: [number, number][];
    height: number;
    isMain: boolean;
    buffer?: [number, number][];
    floorLevel?: number; // Add this to track floor level
    baseBuilding?: number; // Add this to reference the base building
};

 
interface BuildingSceneProps {
    buildings: PolygonData[];
    roads: [number, number][][];
}

export function computeSceneCenter(
    buildings: PolygonData[],
    roads: [number, number][][]
): { centerX: number; centerY: number } {
    const buildingVerts = buildings.flatMap((b) => b.vertices);
    const roadVerts = roads.flatMap((road) => road);
    const allVerts = [...buildingVerts, ...roadVerts];
    const n = allVerts.length;
    const centerX = allVerts.reduce((sum, [x]) => sum + x, 0) / n;
    const centerY = allVerts.reduce((sum, [, y]) => sum + y, 0) / n;
    return { centerX, centerY };
}


export function BuildingMeshes({
    buildings,
    roads,
    onBuildingClick,
    selectedBuilding,
    onFaceDoubleClick,
    activeTool,  
    faceEditMode,
    setFaceEditMode,
    onFaceClick,
}: BuildingSceneProps & {
    onBuildingClick?: (idx: number) => void,
    selectedBuilding?: number,
    onFaceDoubleClick?: (buildingIdx: number, faceIndex: number, event: any) => void,
    activeTool?: string,
    faceEditMode: {
        buildingIdx: number;
        hoveredFace: number | null;
        selectedFace: number | null;
    } | null;
    setFaceEditMode: (mode: any) => void;
    onFaceClick: (buildingIdx: number, faceIndex: number, event: any) => void;
}) {
    const { centerX, centerY } = computeSceneCenter(buildings, roads);
    
    // Group buildings by their base building to calculate floor positions
    const buildingGroups = buildings.reduce((groups, building, index) => {
        const baseIndex = building.baseBuilding ?? index;
        if (!groups[baseIndex]) {
            groups[baseIndex] = [];
        }
        groups[baseIndex].push({ building, index });
        return groups;
    }, {} as Record<number, Array<{ building: PolygonData; index: number }>>);
    
    return (
        <>
            {/* Render Roads as lines lying on the ground */}
            {roads.map((road, i) => {
                if (road.length < 2) return null;
                const points = road.map(([x, y]) => new THREE.Vector3(x - centerX, 0.05, y - centerY));
                return (
                    <Line
                        key={i}
                        points={points}
                        color="#404040"
                        opacity={0.6}
                        lineWidth={8}
                        position={[0, 0, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                    />
                );
            })}

            {/* Render Buildings with floor positioning */}
            {Object.entries(buildingGroups).map(([baseIndex, group]) => {
                // Sort floors by their level (base building first, then floors in order)
                const sortedGroup = group.sort((a, b) => (a.building.floorLevel ?? 0) - (b.building.floorLevel ?? 0));
                
                let cumulativeHeight = 0;
                
                return sortedGroup.map(({ building: b, index: i }) => {
                    const verts = b.vertices ?? [];
                    if (verts.length < 3) return null;

                    const shape = new THREE.Shape();
                    verts.forEach(([x, y], idx) => {
                        const adjustedX = x - centerX;
                        const adjustedY = y - centerY;
                        idx === 0 ? shape.moveTo(adjustedX, adjustedY) : shape.lineTo(adjustedX, adjustedY);
                    });

                    const isDrawnShape = b.height <= 0.1; // Change from 0.5 to 0.1
                    const isSelected = selectedBuilding === i;
                    const isEditMode = faceEditMode?.buildingIdx === i;
                    
                    // Different colors for floors
                    let color = isSelected 
                        ? "#00ccff" 
                        : b.isMain 
                            ? "#ff4444" 
                            : isDrawnShape
                                ? "#ff3333"
                                : b.floorLevel && b.floorLevel > 0
                                    ? "#88ccff" // Lighter blue for floors
                                    : "lightgray";

                    // Calculate position for this floor
                    const floorPosition = [0, 0, cumulativeHeight] as [number, number, number];
                    cumulativeHeight += b.height;

                    // ... rest of the existing rendering logic with floorPosition applied
                    return (
                        <mesh
                            key={i}
                            position={floorPosition}
                            castShadow
                            receiveShadow
                            onClick={(e:any) => {
                                e.stopPropagation();
                                if (activeTool === 'pushpull') {
                                    const faceIndex = Math.floor((e.faceIndex ?? 0) / 2) % verts.length;
                                    onFaceDoubleClick && onFaceDoubleClick(i, faceIndex, e);
                                } else {
                                    onBuildingClick && onBuildingClick(i);
                                }
                            }}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                setFaceEditMode({
                                    buildingIdx: i,
                                    hoveredFace: null,
                                    selectedFace: null
                                });
                            }}
                        >
                            <extrudeGeometry
                                args={[
                                    shape,
                                    {
                                        depth: b.height,
                                        bevelEnabled: false,
                                    },
                                ]}
                            />
                            <meshStandardMaterial
                                color={color}
                                transparent={isDrawnShape}
                                opacity={isDrawnShape ? 0.7 : 1.0}
                                wireframe={false}
                            />
                        </mesh>
                    );
                });
            })}
        </>
    );
}

export function CanvasContent({
    buildingList,
    setBuildingList,
    selected,
    setSelected,
    isMoving,
    setIsMoving,
    moveOffset,
    setMoveOffset,
    roads,
    orbitRef,
    onFaceDoubleClick,
    moveMode,
    activeTool,
    is2DView,
    setIs2DView,
}: {
    buildingList: PolygonData[];
    setBuildingList: React.Dispatch<React.SetStateAction<PolygonData[]>>;
    selected: number | null;
    setSelected: (idx: number | null) => void;
    isMoving: boolean;
    setIsMoving: (v: boolean) => void;
    moveOffset: [number, number] | null;
    setMoveOffset: (v: [number, number] | null) => void;
    roads: [number, number][][]; // Fix: Change from [number, number][] to [number, number][]
    orbitRef: React.RefObject<any>;
    onFaceDoubleClick: (buildingIdx: number, faceIndex: number, event: any) => void;
    moveMode: boolean;
    activeTool: string;
    is2DView: boolean;
    setIs2DView: (value: boolean) => void;
}) {
    const { camera, gl } = useThree();
    
    // Add these new state variables for rectangle drawing
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
    const [currentPoint, setCurrentPoint] = useState<[number, number] | null>(null);
    
    // Add polygon state variables HERE - MOVE FROM LINE 832 TO HERE
    const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
    const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
    const [polygonPreviewPoint, setPolygonPreviewPoint] = useState<[number, number] | null>(null);
    
    const [isPushPulling, setIsPushPulling] = useState(false);
    const [pushPullData, setPushPullData] = useState<{
        buildingIdx: number;
        faceIndex: number;
        startPoint: THREE.Vector3;
        faceNormal: THREE.Vector3;
        initialVertices: [number, number][];
    } | null>(null);
    const [isDraggingExtrude, setIsDraggingExtrude] = useState(false);
    const [extrudeData, setExtrudeData] = useState<{
        buildingIdx: number;
        startHeight: number;
        currentHeight: number;
    } | null>(null);
    const [isExtrudeActive, setIsExtrudeActive] = useState(false);
    const [faceEditMode, setFaceEditMode] = useState<{
        buildingIdx: number;
        hoveredFace: number | null;
        selectedFace: number | null;
    } | null>(null);
    const [highlightedFace, setHighlightedFace] = useState<{
        buildingIdx: number;
        faceIndex: number;
    } | null>(null);
   
    // Use refs to store current values for event handlers
    const currentStateRef = useRef({
        selected,
        buildingList,
        moveMode,
        activeTool
    });
   
    // Update the ref whenever the values change
    useEffect(() => {
        currentStateRef.current = { selected, buildingList, moveMode, activeTool };
    }, [selected, buildingList, moveMode, activeTool]);
 
    // Function to get ground intersection point
    const getGroundIntersection = (event: MouseEvent | PointerEvent) => {
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        
        // Use normal (0,0,1) for XY plane instead of (0,1,0)
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersection = new THREE.Vector3();
        
        if (raycaster.ray.intersectPlane(plane, intersection)) {
            // Return X and Y coordinates instead of X and Z
            return [intersection.x, intersection.y] as [number, number];
        }
        
        return [0, 0] as [number, number];
    };

    // Function to create circle vertices
    const createCircleVertices = (center: [number, number], radius: number, segments: number = 32): [number, number][] => {
        const vertices: [number, number][] = [];
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = center[0] + Math.cos(angle) * radius;
            const y = center[1] + Math.sin(angle) * radius;
            vertices.push([x, y]);
        }
        return vertices;
    };
 
    // Update the handleBuildingClick function in the CanvasContent component
    const handleBuildingClick = (idx: number) => {
        console.log('Clicked building index:', idx, 'Building data:', buildingList[idx]);
        
        // Don't allow selection of the main building (red building)
        if (buildingList[idx]?.isMain) {
            console.log('Clicked building is main building, ignoring selection');
            return; // Exit without selecting
        }
        
        // Handle extrude tool
        if (activeTool === 'extrude') {
            const building = buildingList[idx];
            
            // Only extrude if it's a 2D shape (height is very small)
            if (building.height <= 0.1) {
                // Start the extrusion process
                startExtrusion(idx);
            } else {
                console.log('Cannot extrude: Building is already 3D');
                // Show a notification or feedback to the user
            }
            return;
        }
        updateShapeCoordinatesWithHeight(idx)
        console.log('Selecting building:', idx);
        setSelected(idx);
        

        // Add this to handleBuildingClick or startExtrusion:

    };

const updateShapeCoordinatesWithHeight = (buildingIdx: number) => {
  const building = buildingList[buildingIdx];
  if (!building) return;
  
  // Get the center calculation
  const { centerX, centerY } = computeSceneCenter(buildingList, roads);
  
  // Calculate base coordinates (bottom 4 corners)
  const baseCoordinates = building.vertices.map(([x, y], index) => {
    return {
      index,
      position: "base",
      x: x - centerX,
      y: y - centerY,
      z: 0, // Base is at z=0
     
    };
  });
  
  // Calculate top coordinates (top 4 corners)
  const topCoordinates = building.vertices.map(([x, y], index) => {
    return {
      index,
      position: "top",
      x: x - centerX,
      y: y - centerY,
      z: building.height, // Top uses the building height
   
    };
  });
  
  // Combine all 8 coordinates
  const allCorners = [...baseCoordinates, ...topCoordinates];
  
  // Check if inside main site
  if (isShapeInsideMainSite(building.vertices.map(([x, y]) => [x - centerX, y - centerY]))) {
    console.log("3D shape inside main site - All 8 corners:", allCorners);
  } else {
    console.log("3D shape - All 8 corners:", allCorners);
  }
  
  return allCorners;
};
 
    // Add this function to the CanvasContent component to handle extrusion
    const startExtrusion = (buildingIdx: number) => {
        // If already in extrusion mode, this is a click to stop
        if (isDraggingExtrude && isExtrudeActive) {
            // Finalize the extrusion
            setIsDraggingExtrude(false);
            setIsExtrudeActive(false);
            setExtrudeData(null);
            
            // Re-enable orbit controls
            if (orbitRef.current) {
                orbitRef.current.enabled = true;
            }
            return;
        }
        
        // Start new extrusion
        setIsDraggingExtrude(true);
        setIsExtrudeActive(true);
        setExtrudeData({
            buildingIdx,
            startHeight: buildingList[buildingIdx].height,
            currentHeight: buildingList[buildingIdx].height
        });
        
        // Disable orbit controls
        if (orbitRef.current) {
            orbitRef.current.enabled = false;
        }
    };
 
    // Add function to finish polygon drawing
   // Modify the finishPolygon function:
const finishPolygon = () => {
  if (polygonPoints.length < 3) {
    alert('Need at least 3 points to create a polygon');
    return;
  }

  // Check if the polygon is inside the main site
  if (isShapeInsideMainSite(polygonPoints)) {
    // Get the center calculation that will be applied
    const { centerX, centerY } = computeSceneCenter(buildingList, roads);
    
    // Calculate coordinates with Z axis
    const coordinatesWithZ = polygonPoints.map(([x, y]) => {
      return {
        x: x,
        y: y,
        z: 0, // Z-axis is initially 0 for 2D shapes
        original: [x + centerX, y + centerY, 0],
        grid: [Math.round(x/2), Math.round(y/2), 0]
      };
    });
    
    console.log("Polygon inside main site:", coordinatesWithZ);
    alert("Polygon is inside the main site! Coordinates logged to console.");
  }

  // Continue with existing polygon creation code...
  const { centerX, centerY } = computeSceneCenter(buildingList, roads);
  
  // Convert points to building vertices
  const vertices: [number, number][] = polygonPoints.map(([x, y]) => [
    x + centerX, 
    y + centerY
  ]);

  setBuildingList(prev => [
    ...prev,
    {
      vertices,
      height: 0.1,
      isMain: false,
    }
  ]);

  // Reset polygon drawing state...
  setIsDrawingPolygon(false);
  setPolygonPoints([]);
  setPolygonPreviewPoint(null);
};

    // Add function to cancel polygon drawing
    const cancelPolygon = () => {
        setIsDrawingPolygon(false);
        setPolygonPoints([]);
        setPolygonPreviewPoint(null);

        // Re-enable orbit controls
        if (orbitRef.current) {
            orbitRef.current.enabled = true;
        }
    };
 
    // Add event listeners for drag functionality and pan
    useEffect(() => {
        const canvas = gl.domElement;
        let isDragging = false;
        let isPanning = false;
        let dragOffset: [number, number] | null = null;
        let originalVertices: [number, number][] | null = null;
        let originalBuffer: [number, number][] | null = null;
        let lastPanPosition: [number, number] | null = null;
 
        const handlePointerDown = (event: PointerEvent) => {
            const { activeTool: currentActiveTool, moveMode: currentMoveMode, selected: currentSelected } = currentStateRef.current;
            
            console.log('Pointer down, activeTool:', currentActiveTool); // Add debug log
            
            // Handle click to stop extrusion
            if (isExtrudeActive && isDraggingExtrude) {
                // If we click during active extrusion, finalize it
                setIsDraggingExtrude(false);
                setIsExtrudeActive(false);
                
                if (extrudeData) {
                    setBuildingList(prev => 
                        prev.map((b, i) => {
                            if (i !== extrudeData.buildingIdx) return b;
                            return { ...b, height: extrudeData.currentHeight };
                        })
                    );
                }
                
                setExtrudeData(null);
                
                // Re-enable orbit controls
                if (orbitRef.current) {
                    orbitRef.current.enabled = true;
                }
                
                event.stopPropagation();
                return;
            }
            
            // Handle pushpull tool
            if (currentActiveTool === 'pushpull') {
                return;
            }
            
            // Handle pan tool
            if (currentActiveTool === 'pan') {
                isPanning = true;
                lastPanPosition = [event.clientX, event.clientY];
                canvas.style.cursor = 'grabbing';
                
                // Disable orbit controls during panning
                if (orbitRef.current) {
                    orbitRef.current.enabled = false;
                }
                event.preventDefault();
                return;
            }
            
            // Handle rectangle drawing
            if (currentActiveTool === 'rectangle') {
                console.log('Rectangle tool activated'); // Debug log
                // Disable orbit controls when drawing
                if (orbitRef.current) {
                    orbitRef.current.enabled = false;
                }
                
                const point = getGroundIntersection(event);
                setStartPoint(point);
                setCurrentPoint(point);
                setIsDrawing(true);
                canvas.style.cursor = 'crosshair';
                event.preventDefault();
                return;
            }

            // Handle circle drawing
            if (currentActiveTool === 'circle') {
                console.log('Circle tool activated, starting circle drawing'); // Debug log
                // Disable orbit controls when drawing
                if (orbitRef.current) {
                    orbitRef.current.enabled = false;
                }
                
                const point = getGroundIntersection(event);
                console.log('Circle start point:', point); // Debug log
                setStartPoint(point);
                setCurrentPoint(point);
                setIsDrawing(true);
                canvas.style.cursor = 'crosshair';
                event.preventDefault();
                return;
            }

            // UPDATED: Handle move tool - seamless movement
            if ((currentActiveTool === 'move' || currentMoveMode)) {
                // If already dragging, stop the drag on click
                if (isDragging) {
                    isDragging = false;
                    dragOffset = null;
                    originalVertices = null;
                    originalBuffer = null;
                    setIsMoving(false);
                    setMoveOffset(null);
                    canvas.style.cursor = '';
                    
                    // Re-enable orbit controls
                    if (orbitRef.current) {
                        orbitRef.current.enabled = true;
                    }
                    event.preventDefault();
                    return;
                }
                
                // If not dragging and a building is selected, start dragging
                if (currentSelected !== null) {
                    const selectedBuilding = buildingList[currentSelected];
                    if (selectedBuilding && selectedBuilding.vertices) {
                        // Start dragging the selected building
                        isDragging = true;
                        const mousePos = getGroundIntersection(event);
                        
                        // Store original vertices and calculate offset
                        originalVertices = selectedBuilding.vertices.map(v => [...v] as [number, number]);
                        originalBuffer = selectedBuilding.buffer ? selectedBuilding.buffer.map(v => [...v] as [number, number]) : null;
                        
                        // Calculate centroid of the building
                        const centroid = originalVertices.reduce(
                            (acc, [x, y]) => [acc[0] + x, acc[1] + y],
                            [0, 0]
                        ).map(v => v / originalVertices!.length) as [number, number];
                        
                        // Store the offset from mouse position to building centroid
                        dragOffset = [centroid[0] - mousePos[0], centroid[1] - mousePos[1]];
                        
                        setIsMoving(true);
                        canvas.style.cursor = 'grabbing';
                        
                        // Disable orbit controls during dragging
                        if (orbitRef.current) {
                            orbitRef.current.enabled = false;
                        }
                        event.preventDefault();
                        return;
                    }
                }
            }
            
            // Handle polygon drawing - FIXED VERSION
            if (currentActiveTool === 'polygon') {
                const point = getGroundIntersection(event);
                
                if (!isDrawingPolygon) {
                    // Start new polygon with first point
                    setIsDrawingPolygon(true);
                    setPolygonPoints([point]);
                    
                    // Disable orbit controls when drawing
                    if (orbitRef.current) {
                        orbitRef.current.enabled = false;
                    }
                } else {
                    // We're already drawing a polygon
                    
                    // Check if we're close to the first point to close the polygon
                    if (polygonPoints.length >= 3) {
                        const firstPoint = polygonPoints[0];
                        const distance = Math.sqrt(
                            Math.pow(point[0] - firstPoint[0], 2) + 
                            Math.pow(point[1] - firstPoint[1], 2)
                        );
                        
                        // If close to first point (within 8 units), close the polygon
                        if (distance < 8) {
                            finishPolygon();
                            event.preventDefault();
                            return;
                        }
                    }
                    
                    // Add new point to the polygon
                    setPolygonPoints(prev => [...prev, point]);
                }
                
                event.preventDefault();
                return;
            }
            
            // Handle other tool interactions...
        };
 
        const handlePointerMove = (event: PointerEvent) => {
            const { activeTool: currentActiveTool } = currentStateRef.current;

            // Handle polygon drawing preview
            if (isDrawingPolygon && currentActiveTool === 'polygon') {
                const point = getGroundIntersection(event);
                setPolygonPreviewPoint(point);
                event.preventDefault();
                return;
            }

            // Handle rectangle drawing preview
            if (isDrawing && startPoint && currentActiveTool === 'rectangle') {
                const point = getGroundIntersection(event);
                setCurrentPoint(point);
                event.preventDefault();
                return;
            }

            // Handle circle drawing preview - ADD THIS
            if (isDrawing && startPoint && currentActiveTool === 'circle') {
                const point = getGroundIntersection(event);
                console.log('Circle move point:', point); // Debug log
                setCurrentPoint(point);
                event.preventDefault();
                return;
            }

            // UPDATED: Handle pan movement with faster speed
            if (isPanning && lastPanPosition && currentActiveTool === 'pan') {
                const deltaX = event.clientX - lastPanPosition[0];
                const deltaY = event.clientY - lastPanPosition[1];
      
                // Calculate pan speed based on camera distance (INCREASED SPEED)
                const distance = camera.position.length();
                const panSpeed = distance * 0.003; // Increased from 0.001 to 0.003 (3x faster)
      
                // Get camera's right and up vectors
                const cameraRight = new THREE.Vector3();
                const cameraUp = new THREE.Vector3();
      
                camera.getWorldDirection(new THREE.Vector3()); // This updates the camera's matrix
                cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
                cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
      
                // Apply panning
                const panVector = new THREE.Vector3()
                    .addScaledVector(cameraRight, -deltaX * panSpeed)
                    .addScaledVector(cameraUp, deltaY * panSpeed);
                   
                camera.position.add(panVector);
               
                // Update orbit controls target if available
                if (orbitRef.current && orbitRef.current.target) {
                    orbitRef.current.target.add(panVector);
                }
      
                lastPanPosition = [event.clientX, event.clientY];
                event.preventDefault();
                return;
            }

            // UPDATED: Handle building movement with improved responsiveness
            if (isDragging && dragOffset && originalVertices && originalVertices.length > 0) {
                // Get current selected value from the ref
                const { selected: currentSelected } = currentStateRef.current;
               
                if (currentSelected === null) return;
              
                const mousePos = getGroundIntersection(event);
                const targetCentroid: [number, number] = [
                    mousePos[0] + dragOffset[0],
                    mousePos[1] + dragOffset[1]
                ];
              
                // Get original centroid
                const originalCentroid = originalVertices.reduce(
                    (acc, [x, y]) => [acc[0] + x, acc[1] + y],
                    [0, 0]
                ).map(v => v / originalVertices!.length) as [number, number];
              
                // Calculate movement delta from original position
                const dx = targetCentroid[0] - originalCentroid[0];
                const dy = targetCentroid[1] - originalCentroid[1];
              
                // Apply movement to building using original vertices as reference
                // IMPROVED: Direct state update for better responsiveness
                setBuildingList(prev =>
                    prev.map((b, i) =>
                        i === currentSelected && originalVertices
                            ? {
                                ...b,
                                vertices: originalVertices.map(([x, y]) => [x + dx, y + dy] as [number, number]),
                                buffer: originalBuffer?.map(([x, y]) => [x + dx, y + dy] as [number, number])
                            }
                            : b
                    )
                );
                event.preventDefault();
                return;
            }

            // Handle interactive push/pull
            if (isPushPulling && pushPullData) {
                // Get the current mouse position in 3D space
                const point = getGroundIntersection(event);
                
                // Calculate the vector from the start point to the current point
                const moveVector = new THREE.Vector3(
                    point[0] - pushPullData.startPoint.x,
                    point[1] - pushPullData.startPoint.y,
                    0
                );
                
                // Project this vector onto the face normal to get the distance
                const distance = moveVector.dot(pushPullData.faceNormal);
                
                // Update the building in real-time
                const { buildingIdx, faceIndex, faceNormal, initialVertices } = pushPullData;
                setBuildingList(prev => 
                    prev.map((b, i) => {
                        if (i !== buildingIdx) return b;
                        
                        const newVerts = initialVertices.map((v, idx) => {
                            // Only move the vertices that belong to the selected face
                            if (idx === faceIndex || idx === (faceIndex + 1) % initialVertices.length) {
                                return [
                                    v[0] + faceNormal.x * distance,
                                    v[1] + faceNormal.y * distance
                                ] as [number, number];
                            }
                            return [...v] as [number, number];
                        });
                        
                        return { ...b, vertices: newVerts };
                    })
                );
            }
            
            // Handle extrusion
            if (isDraggingExtrude && extrudeData) {
                // Calculate extrusion height based on mouse Y movement
                const rect = gl.domElement.getBoundingClientRect();
                const mouseY = ((event.clientY - rect.top) / rect.height);
                
                // Map mouseY (0 to 1) to height (0 to 50)
                // Invert direction so moving mouse up increases height
                const newHeight = Math.max(0.1, 50 * (1 - mouseY));
                
                setExtrudeData({
                    ...extrudeData,
                    currentHeight: newHeight
                });
                
                // Update building height in real-time
                setBuildingList(prev => 
                    prev.map((b, i) => {
                        if (i !== extrudeData.buildingIdx) return b;
                        return { ...b, height: newHeight };
                    })
                );
            }
        };
 
        const handlePointerUp = (event: PointerEvent) => {
            // End push/pull operation
            if (isPushPulling) {
                setIsPushPulling(false);
                setPushPullData(null);
                
                // Re-enable orbit controls
                if (orbitRef.current) {
                    orbitRef.current.enabled = true;
                }
            }
            
            // Note: We DON'T reset isDraggingExtrude here if isExtrudeActive is true
            // Only reset extrude if we're not in active extrude mode
            if (isDraggingExtrude && !isExtrudeActive) {
                setIsDraggingExtrude(false);
                setExtrudeData(null);
                
                // Re-enable orbit controls
                if (orbitRef.current) {
                    orbitRef.current.enabled = true;
                }
            }
            
            // Complete rectangle drawing
          // filepath: c:\Users\Sreekanth\my-app\src\buildingHelper.tsx
// Modify the rectangle drawing completion in handlePointerUp:
if (isDrawing && startPoint && currentPoint && activeTool === 'rectangle') {
  // Calculate width and height
  const width = Math.abs(currentPoint[0] - startPoint[0]);
  const height = Math.abs(currentPoint[1] - startPoint[1]);
  
  // Only create rectangle if it has some size
  if (width > 0.5 && height > 0.5) {
    // Create rectangle vertices
    const minX = Math.min(startPoint[0], currentPoint[0]);
    const maxX = Math.max(startPoint[0], currentPoint[0]);
    const minY = Math.min(startPoint[1], currentPoint[1]);
    const maxY = Math.max(startPoint[1], currentPoint[1]);
    
    const vertices: [number, number][] = [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ];
    
    // Check if the rectangle is inside the main site
    if (isShapeInsideMainSite(vertices)) {
      // Get the center calculation that will be applied
      const { centerX, centerY } = computeSceneCenter(buildingList, roads);
      
      // Calculate grid coordinates and include z axis (0 for 2D shapes)
      const coordinatesWithZ = vertices.map(([x, y]) => {
        return {
          x: x,
          y: y,
          z: 0, // Z-axis is initially 0 for 2D shapes
          original: [x + centerX, y + centerY, 0], // Original coordinates with Z
          grid: [Math.round(x/2), Math.round(y/2), 0] // Grid coordinates with Z
        };
      });
      
      console.log("Drawing inside main site:", coordinatesWithZ);
     
    }
    
    // Continue with the existing code to add the building...
    const { centerX, centerY } = computeSceneCenter(buildingList, roads);
    
    const adjustedVertices: [number, number][] = [
      [minX + centerX, minY + centerY],
      [maxX + centerX, minY + centerY],
      [maxX + centerX, maxY + centerY],
      [minX + centerX, maxY + centerY],
    ];
    
    setBuildingList(prev => [
      ...prev,
      {
        vertices: adjustedVertices,
        height: 0.1,
        isMain: false,
      }
    ]);
    
    setSelected(buildingList.length);
  }
  
  // Reset drawing state
  setIsDrawing(false);
  setStartPoint(null);
  setCurrentPoint(null);
}

            // Complete circle drawing - FIX THIS SECTION
           // Modify the circle drawing completion in handlePointerUp:
if (isDrawing && startPoint && currentPoint && activeTool === 'circle') {
  // Calculate radius
  const radius = Math.sqrt(
    Math.pow(currentPoint[0] - startPoint[0], 2) + 
    Math.pow(currentPoint[1] - startPoint[1], 2)
  );
  
  if (radius > 0.5) {
    // Get the center calculation that will be applied
    const { centerX, centerY } = computeSceneCenter(buildingList, roads);
    
    // Create circle vertices
    const circleVertices = createCircleVertices([startPoint[0], startPoint[1]], radius, 32);
    
    // Check if the circle is inside the main site
    if (isShapeInsideMainSite(circleVertices)) {
      // Calculate coordinates with Z axis
      const coordinatesWithZ = circleVertices.map(([x, y]) => {
        return {
          x: x,
          y: y,
          z: 0, // Z-axis is initially 0 for 2D shapes
          original: [x + centerX, y + centerY, 0],
          grid: [Math.round(x/2), Math.round(y/2), 0]
        };
      });
      
      console.log("Circle inside main site:", coordinatesWithZ);
   
    }
    
    // Continue with the existing circle creation code...
    const adjustedVertices = createCircleVertices(
      [startPoint[0] + centerX, startPoint[1] + centerY], 
      radius, 
      32
    );
    
    setBuildingList(prev => [
      ...prev,
      {
        vertices: adjustedVertices,
        height: 0.1,
        isMain: false,
      }
    ]);
    
    setSelected(buildingList.length);
  }
  
  // Reset drawing state
  setIsDrawing(false);
  setStartPoint(null);
  setCurrentPoint(null);
}

            // UPDATED: DON'T automatically stop building dragging on pointer up
            // Building dragging will only stop when clicked again or tool is changed

            // Reset panning on pointer up
            if (isPanning) {
                isPanning = false;
                lastPanPosition = null;
                canvas.style.cursor = '';
                
                // Re-enable orbit controls
                if (orbitRef.current) {
                    orbitRef.current.enabled = true;
                }
            }
        };
 
        // Handle cursor changes for pan tool
        const handlePointerEnter = () => {
            const { activeTool: currentActiveTool } = currentStateRef.current;
            if (currentActiveTool === 'pan' && !isPanning) {
                canvas.style.cursor = 'grab';
            }
        };
 
        // Update the handlePointerLeave function to pass the event parameter
        const handlePointerLeave = (event: PointerEvent) => {
            canvas.style.cursor = '';
            // Also handle pointer up logic when leaving canvas
            handlePointerUp(event);
        };
 
        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerup', handlePointerUp);
        canvas.addEventListener('pointerleave', handlePointerLeave);
        canvas.addEventListener('pointerenter', handlePointerEnter);
 
        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown);
            canvas.removeEventListener('pointermove', handlePointerMove);
            canvas.removeEventListener('pointerup', handlePointerUp);
            canvas.removeEventListener('pointerleave', handlePointerLeave);
            canvas.removeEventListener('pointerenter', handlePointerEnter);
        };
    }, [camera, gl, orbitRef, setIsMoving, setMoveOffset, setBuildingList, isDrawing, startPoint, currentPoint, isPushPulling, pushPullData, isDraggingExtrude, extrudeData, isExtrudeActive,
        // Add these polygon dependencies
        isDrawingPolygon, polygonPoints, finishPolygon, cancelPolygon,
        // Add activeTool dependency for circle drawing
        activeTool, buildingList, roads // Add buildingList and roads for circle creation
    ]);
 
    // Modify the onFaceDoubleClick function in your return statement to handle push/pull directly
    const handleFaceClick = (buildingIdx: number, faceIndex: number, event: any) => {
        if (activeTool === 'pushpull') {
            // Disable orbit controls
            if (orbitRef.current) {
                orbitRef.current.enabled = false;
            }
            
            const building = buildingList[buildingIdx];
            if (!building || !building.vertices || building.vertices.length === 0) {
                console.error("Invalid building or vertices", buildingIdx);
                return;
            }
            
            const verts = building.vertices;
            
            // Get the vertices of the clicked face
            const vi1 = faceIndex;
            const vi2 = (vi1 + 1) % verts.length;
            
            if (!verts[vi1] || !verts[vi2]) {
                console.error("Invalid vertex indices", vi1, vi2);
                return;
            }
            
            const [x1, y1] = verts[vi1];
            const [x2, y2] = verts[vi2];
            
            // Compute face direction and normal
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return;
            
            // Calculate the normal vector (perpendicular)
            const nx = -dy / len;
            const ny = dx / len;
            
            // Get the mouse position in 3D space
            if (!event || !event.nativeEvent) {
                console.error("Invalid event object");
                return;
            }
            
            const point = getGroundIntersection(event.nativeEvent);
            if (!point || point.length < 2) {
                console.error("Invalid intersection point", point);
                return;
            }
            
            // Start push/pull operation
            setIsPushPulling(true);
            setPushPullData({
                buildingIdx,
                faceIndex,
                startPoint: new THREE.Vector3(point[0], point[1], 0),
                faceNormal: new THREE.Vector3(nx, ny, 0),
                initialVertices: building.vertices.map(v => Array.isArray(v) ? [...v] as [number, number] : [0, 0])
            });
        } else {
            // Normal building selection
            handleBuildingClick(buildingIdx);
        }
    };
    
    // Add this effect in CanvasContent component to disable orbit controls when pushpull is active
    useEffect(() => {
        if (orbitRef.current) {
            // Disable orbit controls when push/pull tool is active
            orbitRef.current.enabled = activeTool !== 'pushpull';
        }
        
        // Re-enable when component unmounts or tool changes
        return () => {
            if (orbitRef.current && activeTool === 'pushpull') {
                orbitRef.current.enabled = true;
            }
        };
    }, [activeTool, orbitRef]);
    
    // Add this useEffect right after the orbit controls useEffect (around line 830):
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isDrawingPolygon) {
                // Handle Enter key to finish polygon
                if (event.key === 'Enter' && polygonPoints.length >= 3) {
                    finishPolygon();
                    event.preventDefault();
                    return;
                }
                
                // Handle Escape key to cancel polygon
                if (event.key === 'Escape') {
                    cancelPolygon();
                    event.preventDefault();
                    return;
                }

                // Handle Backspace to remove last point
                if (event.key === 'Backspace' && polygonPoints.length > 1) {
                    setPolygonPoints(prev => prev.slice(0, -1));
                    event.preventDefault();
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDrawingPolygon, polygonPoints]);
    
    // Add this to your CanvasContent component
    const isShapeInsideMainSite = (shapeVertices: [number, number][]) => {
      const mainBuilding = buildingList.find(b => b.isMain);
      if (!mainBuilding || !mainBuilding.vertices) return false;
      
      // Get the center calculation that is applied
      const { centerX, centerY } = computeSceneCenter(buildingList, roads);
      
      // Check if all points are inside the main site
      for (const [x, y] of shapeVertices) {
        // Convert to original coordinates by adding back the center offset
        const originalX = x + centerX;
        const originalY = y + centerY;
        
        // Check if this point is inside the main polygon
        if (!isPointInPolygon([originalX, originalY], mainBuilding.vertices)) {
          return false; // At least one point is outside
        }
      }
      
      return true; // All points are inside
    };

    // Helper function to check if a point is inside a polygon
    const isPointInPolygon = (point: [number, number], polygon: [number, number][]) => {
      const [x, y] = point;
      let inside = false;
      
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      
      return inside;
    };
    
    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[200, 400, 200]}
                intensity={0.8}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-far={1000}
                shadow-camera-left={-500}
                shadow-camera-right={500}
                shadow-camera-top={500}
                shadow-camera-bottom={-500}
            />
            <OrbitControls
                ref={orbitRef}
                enableDamping
                dampingFactor={0.05}
                minDistance={50}
                maxDistance={1000}
            />
            
            {/* Grid on XY plane */}
            <gridHelper 
                args={[2000, 1000, 0x888888, 0xcccccc]} 
                position={[0, 0, 0.01]} 
                rotation={[Math.PI/2, 0, 0]}
                userData={{ isGrid: true }}
            >
                <meshBasicMaterial attach="material" transparent opacity={0.3} />
            </gridHelper>
            
            {/* Rectangle preview */}
            {isDrawing && startPoint && currentPoint && activeTool === 'rectangle' && (
                <mesh position={[0, 0, 0.05]}>
                    <shapeGeometry args={[(() => {
                        const shape = new THREE.Shape();
                        const minX = Math.min(startPoint[0], currentPoint[0]);
                        const maxX = Math.max(startPoint[0], currentPoint[0]);
                        const minY = Math.min(startPoint[1], currentPoint[1]);
                        const maxY = Math.max(startPoint[1], currentPoint[1]);
                        
                        shape.moveTo(minX, minY);
                        shape.lineTo(maxX, minY);
                        shape.lineTo(maxX, maxY);
                        shape.lineTo(minX, maxY);
                        shape.closePath();
                        return shape;
                    })()]} />
                    <meshBasicMaterial 
                        color="#ff3333" 
                        transparent 
                        opacity={0.4} 
                        side={THREE.DoubleSide} 
                    />
                </mesh>
            )}
            
            {/* Circle preview - ADD THIS NEW SECTION */}
            {isDrawing && startPoint && currentPoint && activeTool === 'circle' && (
                <mesh position={[0, 0, 0.05]}>
                    <shapeGeometry args={[(() => {
                        const radius = Math.sqrt(
                            Math.pow(currentPoint[0] - startPoint[0], 2) + 
                            Math.pow(currentPoint[1] - startPoint[1], 2)
                        );
                        
                        const shape = new THREE.Shape();
                        const segments = 32;
                        
                        // Create circle shape
                        for (let i = 0; i <= segments; i++) {
                            const angle = (i / segments) * Math.PI * 2;
                            const x = startPoint[0] + Math.cos(angle) * radius;
                            const y = startPoint[1] + Math.sin(angle) * radius;
                            
                            if (i === 0) {
                                shape.moveTo(x, y);
                            } else {
                                shape.lineTo(x, y);
                            }
                        }
                        shape.closePath();
                        return shape;
                    })()]} />
                    <meshBasicMaterial 
                        color="#3333ff" 
                        transparent 
                        opacity={0.4} 
                        side={THREE.DoubleSide} 
                    />
                </mesh>
            )}
            
            {/* Add arrow visualization for push/pull operation */}
            {isPushPulling && pushPullData && (
                <group>
                    <arrowHelper 
                        args={[
                            pushPullData.faceNormal,
                            new THREE.Vector3(
                                (pushPullData.initialVertices[pushPullData.faceIndex][0] + 
                                 pushPullData.initialVertices[(pushPullData.faceIndex + 1) % pushPullData.initialVertices.length][0]) / 2,
                                (pushPullData.initialVertices[pushPullData.faceIndex][1] + 
                                 pushPullData.initialVertices[(pushPullData.faceIndex + 1) % pushPullData.initialVertices.length][1]) / 2,
                                0.1
                            ),
                            10,
                            0x00ff00
                        ]}
                    />
                </group>
            )}
            
            {/* Extrusion height indicator with click-to-stop message */}
            {isDraggingExtrude && extrudeData && (
                <group>
                    {/* Height line */}
                    <line>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                args={[
                                    new Float32Array([
                                        0, 0, 0,
                                        0, extrudeData.currentHeight, 0
                                    ]),
                                    3,  // itemSize (x, y, z per vertex)
                                    false  // normalized
                                ]}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial color="#00ff00" linewidth={2} />
                    </line>
                    
                    {/* Height text and instructions */}
                    <Html position={[5, extrudeData.currentHeight / 2, 0]}>
                        <div style={{
                            background: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px'
                        }}>
                            {extrudeData.currentHeight.toFixed(1)}
                            <br />
                            <span style={{ color: '#ffcc00', fontSize: '10px' }}>
                                Click to finish extrusion
                            </span>
                        </div>
                    </Html>
                </group>
            )}
            
            {/* Face Edit Mode Indicator */}
            {faceEditMode && (
                <Html fullscreen>
                    <div style={{
                        position: 'absolute',
                        top: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        zIndex: 100
                    }}>
                        Face Edit Mode - Building {faceEditMode.buildingIdx} 
                        {faceEditMode.selectedFace !== null && ` - Face ${faceEditMode.selectedFace} selected`}
                        <button 
                            style={{
                                marginLeft: '10px',
                                padding: '4px 8px',
                                background: '#ff4444',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white',
                                cursor: 'pointer'
                            }}
                            onClick={() => setFaceEditMode(null)}
                        >
                            Exit
                        </button>
                    </div>
                </Html>
            )}
            
            {/* Polygon drawing visualization */}
            {isDrawingPolygon && polygonPoints.length > 0 && (
                <>
                    {/* Draw existing polygon points */}
                    {polygonPoints.map((point, index) => (
                        <mesh key={index} position={[point[0], point[1], 0.1]}>
                            <sphereGeometry args={[1, 8, 8]} />
                            <meshBasicMaterial color={index === 0 ? "#00ff00" : "#ff0000"} />
                        </mesh>
                    ))}
                    
                    {/* Draw preview point */}
                    {polygonPreviewPoint && (
                        <mesh position={[polygonPreviewPoint[0], polygonPreviewPoint[1], 0.1]}>
                            <sphereGeometry args={[1, 8, 8]} />
                            <meshBasicMaterial color="#00ff00" transparent opacity={0.7} />
                        </mesh>
                    )}
                    
                    {/* Draw lines between points */}
                    {polygonPoints.length > 1 && (
                        <Line
                            points={polygonPoints.map(p => new THREE.Vector3(p[0], p[1], 0.1))}
                            color="#00ff00"
                            lineWidth={3}
                        />
                    )}
                    
                    {/* Draw preview line to current mouse position - CHANGED TO GREEN */}
                    {polygonPoints.length > 0 && polygonPreviewPoint && (
                        <Line
                            points={[
                                new THREE.Vector3(
                                    polygonPoints[polygonPoints.length - 1][0],
                                    polygonPoints[polygonPoints.length - 1][1],
                                    0.1
                                ),
                                new THREE.Vector3(polygonPreviewPoint[0], polygonPreviewPoint[1], 0.1)
                            ]}
                            color="#00ff00"
                            lineWidth={3}
                            transparent
                            opacity={0.8}
                        />
                    )}
                    
                    {/* Draw closing line preview when near first point */}
                    {polygonPoints.length >= 3 && polygonPreviewPoint && (
                        (() => {
                            const firstPoint = polygonPoints[0];
                            const distance = Math.sqrt(
                                Math.pow(polygonPreviewPoint[0] - firstPoint[0], 2) + 
                                Math.pow(polygonPreviewPoint[1] - firstPoint[1], 2)
                            );
                            
                            if (distance < 8) {
                                return (
                                    <>
                                        {/* Closing indicator circle */}
                                        <mesh position={[firstPoint[0], firstPoint[1], 0.2]}>
                                            <ringGeometry args={[6, 10, 16]} />
                                            <meshBasicMaterial color="#00ff00" transparent opacity={0.5} />
                                        </mesh>
                                        {/* Closing line */}
                                        <Line
                                            points={[
                                                new THREE.Vector3(
                                                    polygonPoints[polygonPoints.length - 1][0],
                                                    polygonPoints[polygonPoints.length - 1][1],
                                                    0.1
                                                ),
                                                new THREE.Vector3(firstPoint[0], firstPoint[1], 0.1)
                                            ]}
                                            color="#00ff00"
                                            lineWidth={4}
                                        />
                                    </>
                                );
                            }
                            return null;
                        })()
                    )}
                    
                    {/* Polygon drawing instructions */}
                    <Html fullscreen>
                        <div style={{
                            position: 'absolute',
                            top: '120px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(0, 0, 0, 0.8)',
                            color: 'white',
                            padding: '12px 20px',
                            borderRadius: '6px',
                            fontSize: '14px',
                            zIndex: 100,
                            textAlign: 'center'
                        }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                Drawing Polygon
                            </div>
                            <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                                Click to place points ({polygonPoints.length} placed)<br/>
                                {polygonPoints.length >= 3 && (
                                    <>Click near <span style={{ color: '#00ff00' }}>first point</span> to close<br/></>
                                )}
                                Press <span style={{ color: '#00ff00' }}>Enter</span> to finish<br/>
                                Press <span style={{ color: '#ffaa00' }}>Backspace</span> to undo last point<br/>
                                Press <span style={{ color: '#ff4444' }}>Escape</span> to cancel
                            </div>
                        </div>
                    </Html>
                </>
            )}
            
            <BuildingMeshes
                buildings={buildingList}
                roads={roads}
                onBuildingClick={handleBuildingClick}
                selectedBuilding={selected ?? undefined}
                onFaceDoubleClick={handleFaceClick}
                activeTool={activeTool}
                faceEditMode={faceEditMode}
                setFaceEditMode={setFaceEditMode}
                onFaceClick={handleFaceClick}
            />
        </>
    );
}

/**
 * Converts latitude and longitude to meters using Web Mercator projection.
 * The origin (0,0) will be at the first point passed.
 */
export function latLonToMeters(
    lat: number,
    lon: number,
    originLat: number,
    originLon: number
): [number, number] {
    const R = 6378137; // Earth's radius in meters
    const dLat = (lat - originLat) * Math.PI / 180;
    const dLon = (lon - originLon) * Math.PI / 180;
    const x = dLon * R * Math.cos(originLat * Math.PI / 180);
    const y = dLat * R;
    return [x, y];
}
