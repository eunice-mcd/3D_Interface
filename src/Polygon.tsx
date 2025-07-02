import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Pencil, Square, Circle, RotateCcw, Trash2, Move3D, MousePointer, Pentagon, Move, Hand, Code, Box, Building, Download } from 'lucide-react';
import { createFalse } from 'typescript';

// Update BuildingData interface (keep the same structure)
interface BuildingData {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  color: string;
  type: string;
}

// Make sure your NeighborhoodData interface is correct:
interface NeighborhoodData {
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

// Dummy neighborhood data - 5 buildings arranged around central space
const createDummyNeighborhood = (): NeighborhoodData => {
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

// Encode/decode functions for base64 data
const encodeNeighborhoodToBase64 = (data: NeighborhoodData): string => {
  const jsonString = JSON.stringify(data, null, 2);
  return btoa(jsonString);
};

const decodeNeighborhoodFromBase64 = (base64: string): NeighborhoodData => {
  try {
    const decoded = atob(base64);
    return JSON.parse(decoded) as NeighborhoodData;
  } catch (error) {
    throw new Error('Invalid base64 neighborhood data format');
  }
};

const PolygonCreation = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const mouseRef = useRef(new THREE.Vector2());
  
  // Change the default tool from 'select' to 'rectangle'
  const [currentTool, setCurrentTool] = useState('rectangle');
  const [extrudeHeight, setExtrudeHeight] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<THREE.Vector3[]>([]);
  const [objects, setObjects] = useState<THREE.Object3D[]>([]);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [coordinateInput, setCoordinateInput] = useState('');
  const [showCoordinatePanel, setShowCoordinatePanel] = useState(false);
  
  // Neighborhood data state
  const [neighborhoodData, setNeighborhoodData] = useState<NeighborhoodData | null>(null);
  const [base64Data, setBase64Data] = useState<string>('');
  const [showDataPanel, setShowDataPanel] = useState(false);

  // Simplified state for seamless move tool
  const [isMovingObject, setIsMovingObject] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState({ x: 0, y: 0 });
  const [dragStartPoint, setDragStartPoint] = useState<THREE.Vector3 | null>(null);
  const [dragOffset, setDragOffset] = useState<THREE.Vector3 | null>(null);

  const [numberOfFloors, setNumberOfFloors] = useState(1);
  const [floorHeight, setFloorHeight] = useState(3);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(1);
  const [showAlignmentGuides, setShowAlignmentGuides] = useState(true);

  // Add the missing disposeObject function
  const disposeObject = useCallback((obj: THREE.Object3D) => {
    if (obj instanceof THREE.Mesh) {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(material => material.dispose());
        } else {
          obj.material.dispose();
        }
      }
    } else if (obj instanceof THREE.Line) {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(material => material.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
  }, []);

  // Function to create 3D shapes from Face-based vertex arrays
  const create3DFromCoordinates = useCallback((coordinatesStr: string) => {
    try {
      console.log('Input coordinates:', coordinatesStr);
      
      let faceBasedData: any;
      
      // Parse the input
      if (coordinatesStr.trim().startsWith('{') || coordinatesStr.trim().startsWith('[')) {
        faceBasedData = JSON.parse(coordinatesStr);
        console.log('Parsed data:', faceBasedData);
      } else {
        alert('Please provide coordinates in Face-based vertex arrays format (JSON)');
        return;
      }

      // Handle different face-based formats
      let faces: any[] = [];
      
      if (Array.isArray(faceBasedData)) {
        // Direct array of faces
        faces = faceBasedData;
        console.log('Using direct array format, faces:', faces.length);
      } else if (faceBasedData.faces) {
        // Object with faces property
        faces = faceBasedData.faces;
        console.log('Using faces property format, faces:', faces.length);
      } else if (faceBasedData.geometry && faceBasedData.geometry.faces) {
        // Nested geometry object
        faces = faceBasedData.geometry.faces;
        console.log('Using nested geometry format, faces:', faces.length);
      } else {
        console.error('Invalid format detected:', faceBasedData);
        alert('Invalid face-based format. Please provide faces array.');
        return;
      }

      if (!Array.isArray(faces) || faces.length === 0) {
        console.error('No faces found:', faces);
        alert('No faces found in the input data');
        return;
      }

      let successCount = 0;

      faces.forEach((face, faceIndex) => {
        console.log(`Processing face ${faceIndex}:`, face);
        
        let vertices: number[][] = [];
        
        // Parse different face formats
        if (face.vertices) {
          // Format: { vertices: [[x,y,z], [x,y,z], ...] }
          vertices = face.vertices;
          console.log(`Face ${faceIndex} using vertices property:`, vertices);
        } else if (Array.isArray(face)) {
          // Format: [[x,y,z], [x,y,z], ...]
          vertices = face;
          console.log(`Face ${faceIndex} using direct array:`, vertices);
        } else if (face.points) {
          // Format: { points: [[x,y,z], [x,y,z], ...] }
          vertices = face.points;
          console.log(`Face ${faceIndex} using points property:`, vertices);
        } else {
          console.warn(`Skipping face ${faceIndex}: invalid format`, face);
          return;
        }

        if (!Array.isArray(vertices) || vertices.length < 3) {
          console.warn(`Skipping face ${faceIndex}: needs at least 3 vertices, got ${vertices.length}`);
          return;
        }

        // Convert 3D vertices to 2D points for shape creation (using X,Z coordinates)
        const points: [number, number][] = [];
        
        vertices.forEach((vertex, vertexIndex) => {
          if (Array.isArray(vertex) && vertex.length >= 3) {
            const [x, y, z] = vertex;
            const xNum = parseFloat(String(x));
            const zNum = parseFloat(String(z));
            if (!isNaN(xNum) && !isNaN(zNum)) {
              points.push([xNum, zNum]);
              console.log(`Vertex ${vertexIndex}: [${xNum}, ${zNum}]`);
            }
          } else if (Array.isArray(vertex) && vertex.length >= 2) {
            // Handle 2D vertices
            const [x, z] = vertex;
            const xNum = parseFloat(String(x));
            const zNum = parseFloat(String(z));
            if (!isNaN(xNum) && !isNaN(zNum)) {
              points.push([xNum, zNum]);
              console.log(`2D Vertex ${vertexIndex}: [${xNum}, ${zNum}]`);
            }
          } else {
            console.warn(`Skipping vertex ${vertexIndex} in face ${faceIndex}: invalid format`, vertex);
          }
        });

        console.log(`Face ${faceIndex} extracted points:`, points);

        if (points.length < 3) {
          console.warn(`Skipping face ${faceIndex}: not enough valid vertices, got ${points.length}`);
          return;
        }

        // Remove duplicate consecutive points
        const uniquePoints: [number, number][] = [];
        for (let i = 0; i < points.length; i++) {
          const current = points[i];
          const next = points[(i + 1) % points.length];
          if (Math.abs(current[0] - next[0]) > 0.001 || Math.abs(current[1] - next[1]) > 0.001) {
            uniquePoints.push(current);
          }
        }

        console.log(`Face ${faceIndex} unique points:`, uniquePoints);

        if (uniquePoints.length < 3) {
          console.warn(`Skipping face ${faceIndex}: not enough unique vertices after filtering, got ${uniquePoints.length}`);
          return;
        }

        // Create 3D shape from vertices
        try {
          // Create base shape from 2D projection
          const shape = new THREE.Shape();
          shape.moveTo(uniquePoints[0][0], uniquePoints[0][1]);
          
          for (let i = 1; i < uniquePoints.length; i++) {
            shape.lineTo(uniquePoints[i][0], uniquePoints[i][1]);
          }
          shape.lineTo(uniquePoints[0][0], uniquePoints[0][1]); // Close the shape

          console.log(`Created shape for face ${faceIndex}`);

          // Get Y-height from original vertices (if available)
          let shapeHeight = extrudeHeight;
          if (vertices.length > 0 && Array.isArray(vertices[0]) && vertices[0].length >= 3) {
            const yValues = vertices
              .filter(v => Array.isArray(v) && v.length >= 3)
              .map(v => parseFloat(String(v[1])))
              .filter(y => !isNaN(y));
            if (yValues.length > 0) {
              const maxY = Math.max(...yValues);
              const minY = Math.min(...yValues);
              const calculatedHeight = Math.abs(maxY - minY);
              shapeHeight = calculatedHeight > 0.1 ? calculatedHeight : extrudeHeight;
              console.log(`Face ${faceIndex} calculated height: ${shapeHeight} (Y range: ${minY} to ${maxY})`);
            }
          }

          // Create 3D extruded geometry
          const extrudeSettings = {
            depth: shapeHeight,
            bevelEnabled: false
          };
          
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const material = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
             transparent: false,
            opacity: 1
          });
          
          const mesh = new THREE.Mesh(geometry, material);
          
          // Position the mesh
          mesh.rotation.x = -Math.PI / 2;
          const xOffset = faceIndex * 6;
          mesh.position.set(xOffset, 0, 0);
          
          console.log(`Face ${faceIndex} positioned at (${xOffset}, 0, 0) with height ${shapeHeight}`);
          
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData = { 
            type: 'extruded3D', 
            originalType: 'face-based',
            vertices: vertices,
            points: uniquePoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
            shape: shape,
            faceIndex: faceIndex,
            height: shapeHeight,
            id: Date.now() + Math.random() + faceIndex
          };

          if (sceneRef.current) {
            sceneRef.current.add(mesh);
            console.log(`Added mesh to scene for face ${faceIndex}`);
            successCount++;
          } else {
            console.error('Scene reference is null!');
          }
          
          setObjects(prev => {
            const newObjects = [...prev, mesh];
            console.log(`Total objects in state: ${newObjects.length}`);
            return newObjects;
          });

          console.log(`✅ Successfully created 3D shape from face ${faceIndex + 1} with ${uniquePoints.length} vertices (height: ${shapeHeight})`);
          
        } catch (shapeError) {
          console.error(`❌ Error creating shape from face ${faceIndex}:`, shapeError);
        }
      });

      console.log(`🎉 Processing complete! Successfully created ${successCount} out of ${faces.length} faces`);

      // Clear the input
      setCoordinateInput('');
      setShowCoordinatePanel(false);
      
      if (successCount === 0) {
        alert('No valid 3D shapes could be created from the input data. Check console for details.');
      } else {
        alert(`Successfully created ${successCount} 3D shape(s)!`);
      }
      
    } catch (error) {
      console.error('❌ Error parsing face-based coordinates:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Invalid face-based format: ${errorMessage}`);
    }
  }, [extrudeHeight]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    if (!neighborhoodData || !neighborhoodData.buildings) return;
    
    const buildingData = neighborhoodData;
    const scene = new THREE.Scene();

    // Light blue sky background like in the image
    scene.background = new THREE.Color('white'); // Sky blue
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(100, 80, 100);
    camera.lookAt(0, 20, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false,
      premultipliedAlpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffffff, 1.0); // Sky blue clear color
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 300;
    directionalLight.shadow.camera.left = -150;
    directionalLight.shadow.camera.right = 150;
    directionalLight.shadow.camera.top = 150;
    directionalLight.shadow.camera.bottom = -150;
    scene.add(directionalLight);

    // White ground plane instead of green
    const largeGroundGeometry = new THREE.PlaneGeometry(800, 800);
    const largeGroundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xffffff, // White color (#ffffff)
    });
    const largeGround = new THREE.Mesh(largeGroundGeometry, largeGroundMaterial);
    largeGround.rotation.x = -Math.PI / 2;
    largeGround.position.y = -0.5;
    largeGround.receiveShadow = true;
    scene.add(largeGround);

    // Light gray grid lines for visibility on white ground
    const gridHelper = new THREE.GridHelper(
      neighborhoodData.centerSpace.dimensions.width, 
      neighborhoodData.centerSpace.dimensions.width / gridSize, 
      0xd0d0d0, // Light gray for main grid lines
      0xe0e0e0  // Very light gray for subdivision lines
    );
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Interaction plane
    const groundGeometry = new THREE.PlaneGeometry(40, 40);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Raycaster for mouse interaction
    raycasterRef.current = new THREE.Raycaster();

    // Simple orbit controls implementation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 2) { // Right mouse button for orbit
        isDragging = true;
        previousMousePosition = { x: event.clientX, y: event.clientY };
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (isDragging) {
        const deltaMove = {
          x: event.clientX - previousMousePosition.x,
          y: event.clientY - previousMousePosition.y
        };

        const spherical = new THREE.Spherical();
        spherical.setFromVector3(camera.position);
        
        spherical.theta -= deltaMove.x * 0.01;
        spherical.phi += deltaMove.y * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

        camera.position.setFromSpherical(spherical);
        camera.lookAt(0, 0, 0);

        previousMousePosition = { x: event.clientX, y: event.clientY };
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (event: WheelEvent) => {
      const scale = event.deltaY > 0 ? 1.1 : 0.9;
      camera.position.multiplyScalar(scale);
      camera.position.clampLength(5, 100);
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [neighborhoodData, gridSize]);

  const getMousePosition = useCallback((event: MouseEvent): THREE.Vector3 | null => {
    if (!rendererRef.current) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    if (!raycasterRef.current || !cameraRef.current) return null;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    if (!sceneRef.current) return null;
    
    const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
    
    // Find intersection with ground plane
    const groundIntersect = intersects.find(intersect => 
      intersect.object instanceof THREE.Mesh &&
      intersect.object.geometry instanceof THREE.PlaneGeometry &&
      !intersect.object.userData?.type // Exclude user-created planes
    );
    
    if (groundIntersect) {
      return groundIntersect.point;
    }
    
    // Fallback to y=0 plane
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    raycasterRef.current.ray.intersectPlane(plane, point);
    return point;
  }, []);

  // Updated finishPolygon function with red color and opacity
const finishPolygon = useCallback(() => {
  if (drawingPoints.length < 3) {
    alert('Need at least 3 points for a polygon');
    return;
  }

  const shape = new THREE.Shape();
  
  const minX = Math.min(...drawingPoints.map(p => p.x));
  const minZ = Math.min(...drawingPoints.map(p => p.z));
  
  const relativePoints = drawingPoints.map(p => ({
    x: p.x - minX,
    z: -(p.z - minZ)
  }));
  
  shape.moveTo(relativePoints[0].x, relativePoints[0].z);
  for (let i = 1; i < relativePoints.length; i++) {
    shape.lineTo(relativePoints[i].x, relativePoints[i].z);
  }
  shape.lineTo(relativePoints[0].x, relativePoints[0].z);

  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshLambertMaterial({
    color: 0xff0000, // Red color
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.4 // Lower opacity
  });
  const polygon = new THREE.Mesh(geometry, material);
  
  polygon.rotation.x = -Math.PI / 2;
  polygon.position.set(minX, 0.01, minZ);
  
  polygon.userData = { 
    type: 'polygon', 
    points: [...drawingPoints],
    shape: shape,
    id: Date.now() + Math.random()
  };

  if (sceneRef.current) {
    sceneRef.current.add(polygon);
    
    const previewLines = sceneRef.current.children.filter(child => 
      child.userData && child.userData.isPreview
    );
    previewLines.forEach(line => {
      disposeObject(line);
      sceneRef.current!.remove(line);
    });
  }
  
  setObjects(prev => [...prev, polygon]);
  setIsDrawing(false);
  setDrawingPoints([]);
}, [drawingPoints, disposeObject]);

  // Enhanced handleCanvasClick with seamless move tool
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return; // Only handle left click
    
    const point = getMousePosition(event);
    if (!point) return;

    switch (currentTool) {
      case 'move':
        if (raycasterRef.current && cameraRef.current) {
          const rect = rendererRef.current?.domElement.getBoundingClientRect();
          if (rect) {
            mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          }
          
          raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

          const selectableObjects = objects.filter(obj => 
            obj.userData && 
            obj.userData.type && 
            obj.userData.id &&
            (obj.userData.type === 'line' || obj.userData.type === 'rectangle' || obj.userData.type === 'circle' || obj.userData.type === 'polygon' || obj.userData.type === 'extruded' || obj.userData.type === 'extruded3D')
          );
          
          const intersects = raycasterRef.current.intersectObjects(selectableObjects, false);

          if (intersects.length > 0) {
            const selected = intersects[0].object;
            setSelectedObject(selected);

            // Highlight selected object
            objects.forEach(obj => {
              if (obj instanceof THREE.Mesh && obj.material && 'emissive' in obj.material) {
                const material = obj.material as THREE.MeshLambertMaterial;
                material.emissive.set(0x000000);
              }
            });

            if (selected instanceof THREE.Mesh && selected.material && 'emissive' in selected.material) {
              const material = selected.material as THREE.MeshLambertMaterial;
              material.emissive.set(0x444444);
            }
          } else {
            // Clicked on empty space, clear selection
            setSelectedObject(null);
            objects.forEach(obj => {
              if (obj instanceof THREE.Mesh && obj.material && 'emissive' in obj.material) {
                const material = obj.material as THREE.MeshLambertMaterial;
                material.emissive.set(0x000000);
              }
            });
          }
        }
        break;

      case 'polygon':
        if (!isDrawing) {
          setIsDrawing(true);
          setDrawingPoints([point]);
        } else {
          const newPoints = [...drawingPoints, point];
          setDrawingPoints(newPoints);
          
          // Create preview lines with red color
          if (sceneRef.current && newPoints.length > 1) {
            // Remove previous preview lines
            const previewLines = sceneRef.current.children.filter(child => 
              child.userData && child.userData.isPreview
            );
            previewLines.forEach(line => {
              disposeObject(line);
              sceneRef.current!.remove(line);
            });
            
            // Add new preview lines with red color
            for (let i = 0; i < newPoints.length - 1; i++) {
              const lineGeometry = new THREE.BufferGeometry().setFromPoints([newPoints[i], newPoints[i + 1]]);
              const lineMaterial = new THREE.LineBasicMaterial({ 
                color: 0xff0000, // Red color
                opacity: 0.6, 
                transparent: true
              });
              const line = new THREE.Line(lineGeometry, lineMaterial);
              line.userData = { isPreview: true };
              sceneRef.current.add(line);
            }
            
            // Add closing line preview with red color
            if (newPoints.length > 2) {
              const closingGeometry = new THREE.BufferGeometry().setFromPoints([newPoints[newPoints.length - 1], newPoints[0]]);
              const closingMaterial = new THREE.LineDashedMaterial({ 
                color: 0xff0000, // Red color
                opacity: 0.6,
                transparent: true, 
                dashSize: 0.1, 
                gapSize: 0.1 
              });
              const closingLine = new THREE.Line(closingGeometry, closingMaterial);
              closingLine.computeLineDistances();
              closingLine.userData = { isPreview: true };
              sceneRef.current.add(closingLine);
            }
          }
        }
        break;

      case 'line':
        if (!isDrawing) {
          setIsDrawing(true);
          setDrawingPoints([point]);
        } else {
          const newPoints = [...drawingPoints, point];
          
          // Create line geometry with red color and opacity
          const geometry = new THREE.BufferGeometry().setFromPoints(newPoints);
          const material = new THREE.LineBasicMaterial({
            color: 0xff0000, // Red color
            transparent: true,
            opacity: 0.4 // Lower opacity
          });
          const line = new THREE.Line(geometry, material);
          line.userData = { 
            type: 'line', 
            points: newPoints,
            id: Date.now() + Math.random()
          };
          
          if (sceneRef.current) {
            sceneRef.current.add(line);
          }
          setObjects(prev => [...prev, line]);
          setIsDrawing(false);
          setDrawingPoints([]);
        }
        break;

      case 'rectangle':
        if (!isDrawing) {
          setIsDrawing(true);
          setDrawingPoints([point]);
        } else if (drawingPoints.length >= 1) {
          const start = drawingPoints[0];
          
          const width = Math.abs(point.x - start.x);
          const height = Math.abs(point.z - start.z);

          if (width < 0.01 || height < 0.01) {
            setIsDrawing(false);
            setDrawingPoints([]);
            break;
          }
          
          const geometry = new THREE.PlaneGeometry(width, height);
          const material = new THREE.MeshLambertMaterial({
            color: 0xff0000, // Red color
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.4 // Lower opacity
          });
          const rectangle = new THREE.Mesh(geometry, material);
          rectangle.rotation.x = -Math.PI / 2;
          rectangle.position.set(
            (start.x + point.x) / 2,
            0.01,
            (start.z + point.z) / 2
          );
          rectangle.userData = { 
            type: 'rectangle', 
            width, 
            height,
            id: Date.now() + Math.random()
          };
          
          if (sceneRef.current) {
            sceneRef.current.add(rectangle);
          }
          setObjects(prev => [...prev, rectangle]);
          setIsDrawing(false);
          setDrawingPoints([]);
        }
        break;

      case 'circle':
        if (!isDrawing) {
          setIsDrawing(true);
          setDrawingPoints([point]);
        } else if (drawingPoints.length === 1) {
          const center = drawingPoints[0];
          if (!center) {
            setIsDrawing(false);
            setDrawingPoints([]);
            break;
          }
          
          const radius = center.distanceTo(point);

          if (radius < 0.01) {
            setIsDrawing(false);
            setDrawingPoints([]);
            break;
          }
          
          const geometry = new THREE.CircleGeometry(radius, 32);
          const material = new THREE.MeshLambertMaterial({
            color: 0xff0000, // Red color
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.4 // Lower opacity
          });
          const circle = new THREE.Mesh(geometry, material);
          circle.rotation.x = -Math.PI / 2;
          circle.position.set(center.x, 0.01, center.z);
          circle.userData = { 
            type: 'circle', 
            radius,
            id: Date.now() + Math.random()
          };
          
          if (sceneRef.current) {
            sceneRef.current.add(circle);
          }
          setObjects(prev => [...prev, circle]);
          setIsDrawing(false);
          setDrawingPoints([]);
        }
        break;

      case 'select':
        if (raycasterRef.current && cameraRef.current) {
          const rect = rendererRef.current?.domElement.getBoundingClientRect();
          if (rect) {
            mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          }
          
          raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
          
          const selectableObjects = objects.filter(obj => 
            obj.userData && 
            obj.userData.type && 
            obj.userData.id &&
            (obj.userData.type === 'line' || obj.userData.type === 'rectangle' || obj.userData.type === 'circle' || obj.userData.type === 'polygon' || obj.userData.type === 'extruded' || obj.userData.type === 'extruded3D')
          );
          
          const intersects = raycasterRef.current.intersectObjects(selectableObjects, false);

          if (intersects.length > 0) {
            const selected = intersects[0].object;
            setSelectedObject(selected);

            objects.forEach(obj => {
              if (obj instanceof THREE.Mesh && obj.material && 'emissive' in obj.material) {
                const material = obj.material as THREE.MeshLambertMaterial;
                material.emissive.set(0x000000);
              }
            });

            if (selected instanceof THREE.Mesh && selected.material && 'emissive' in selected.material) {
              const material = selected.material as THREE.MeshLambertMaterial;
              material.emissive.set(0x444444);
            }
          } else {
            setSelectedObject(null);
            objects.forEach(obj => {
              if (obj instanceof THREE.Mesh && obj.material && 'emissive' in obj.material) {
                const material = obj.material as THREE.MeshLambertMaterial;
                material.emissive.set(0x000000);
              }
            });
          }
        }
        break;
    }
  }, [currentTool, isDrawing, drawingPoints, objects, getMousePosition, disposeObject]);

  // Handle mouse events with seamless dragging
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;

    const rect = rendererRef.current?.domElement.getBoundingClientRect();
    if (!rect) return;

    setLastMousePosition({ x: event.clientX, y: event.clientY });

    if (currentTool === 'hand') {
      setIsPanning(true);
      if (rendererRef.current) {
        rendererRef.current.domElement.style.cursor = 'grabbing';
      }
    } else if (currentTool === 'move' && selectedObject && raycasterRef.current && cameraRef.current) {
      // Check if clicking on the selected object to start dragging
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects([selectedObject], false);

      if (intersects.length > 0) {
        // Start dragging
        setIsMovingObject(true);
        const clickPoint = intersects[0].point;
        setDragStartPoint(clickPoint);
        
        // Calculate offset from click point to object center
        const offset = selectedObject.position.clone().sub(clickPoint);
        setDragOffset(offset);
        
        if (rendererRef.current) {
          rendererRef.current.domElement.style.cursor = 'grabbing';
        }
      }
    }
  }, [currentTool, selectedObject]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    // Only handle move if we're actively moving an object
    if (currentTool === 'move' && isMovingObject && selectedObject && dragOffset) {
      const currentPoint = getMousePosition(event);
      if (currentPoint) {
        const snappedPoint = snapPositionToGrid(currentPoint);
        selectedObject.position.copy(snappedPoint.add(dragOffset));
      }
    }
  }, [currentTool, isMovingObject, selectedObject, dragOffset, getMousePosition]);

  const handleMouseUp = useCallback(() => {
    if (currentTool === 'hand' && isPanning) {
      setIsPanning(false);
      if (rendererRef.current) {
        rendererRef.current.domElement.style.cursor = 'grab';
      }
    } else if (currentTool === 'move' && isMovingObject) {
      setIsMovingObject(false);
      setDragStartPoint(null);
      setDragOffset(null);
      
      // Clear alignment guides
      if (sceneRef.current) {
        const guides = sceneRef.current.children.filter(child => 
          child.userData?.isAlignmentGuide
        );
        guides.forEach(guide => {
          sceneRef.current!.remove(guide);
          if (guide instanceof THREE.Line && guide.geometry) {
            guide.geometry.dispose();
          }
        });
      }
      
      if (rendererRef.current) {
        rendererRef.current.domElement.style.cursor = 'default';
      }
    }
  }, [currentTool, isPanning, isMovingObject]);

  // Update cursor based on current tool and state
  useEffect(() => {
    if (rendererRef.current) {
      switch (currentTool) {
        case 'hand':
          rendererRef.current.domElement.style.cursor = isPanning ? 'grabbing' : 'grab';
          break;
        case 'move':
          if (isMovingObject) {
            rendererRef.current.domElement.style.cursor = 'grabbing';
          } else {
            rendererRef.current.domElement.style.cursor = 'default';
          }
          break;
        default:
          rendererRef.current.domElement.style.cursor = 'default';
      }
    }
  }, [currentTool, isPanning, isMovingObject]);

  const extrudeSelected = useCallback(() => {
    if (!selectedObject || !selectedObject.userData) return;

    const { type } = selectedObject.userData;
    let extrudedGeometry;
    
    switch (type) {
      case 'rectangle':
        const { width, height } = selectedObject.userData;
        extrudedGeometry = new THREE.BoxGeometry(width, extrudeHeight, height);
        break;
        
      case 'circle':
        const { radius } = selectedObject.userData;
        extrudedGeometry = new THREE.CylinderGeometry(radius, radius, extrudeHeight, 32);
        break;

      case 'polygon':
        const { shape } = selectedObject.userData;
        if (shape) {
          const extrudeSettings = {
            depth: extrudeHeight,
            bevelEnabled: false
          };
          extrudedGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        }
        break;
        
      default:
        return;
    }

    if (!extrudedGeometry) return;

    // replace random color with white
    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: false,
      opacity: 0.9
    });
    const extrudedMesh = new THREE.Mesh(extrudedGeometry, material);
    extrudedMesh.position.copy(selectedObject.position);
    
    if (type === 'polygon') {
      extrudedMesh.rotation.x = -Math.PI / 2;
      extrudedMesh.position.y = 0;
    } else {
      extrudedMesh.position.y = extrudeHeight / 2;
    }
    
    extrudedMesh.castShadow = true;
    extrudedMesh.receiveShadow = true;
    extrudedMesh.userData = { 
      type: 'extruded', 
      originalType: type,
      id: Date.now() + Math.random()
    };

    if (sceneRef.current) {
      sceneRef.current.add(extrudedMesh);
      disposeObject(selectedObject);
      sceneRef.current.remove(selectedObject);
    }
    
    setObjects(prev => [...prev.filter(obj => obj !== selectedObject), extrudedMesh]);
    setSelectedObject(extrudedMesh);
  }, [selectedObject, extrudeHeight, disposeObject]);

  const deleteSelected = useCallback(() => {
    if (!selectedObject || !sceneRef.current) return;
    
    disposeObject(selectedObject);
    sceneRef.current.remove(selectedObject);
    setObjects(prev => prev.filter(obj => obj !== selectedObject));
    setSelectedObject(null);
  }, [selectedObject, disposeObject]);

  const clearAll = useCallback(() => {
    if (!sceneRef.current) return;
    
    objects.forEach(obj => {
      disposeObject(obj);
      sceneRef.current!.remove(obj);
    });
    
    // Also clear preview lines
    const previewLines = sceneRef.current.children.filter(child => 
      child.userData && child.userData.isPreview
    );
    previewLines.forEach(line => {
      disposeObject(line);
      sceneRef.current!.remove(line);
    });
    
    setObjects([]);
    setSelectedObject(null);
    setIsDrawing(false);
    setDrawingPoints([]);
  }, [objects, disposeObject]);

  // Handle keyboard events for polygon completion
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        if (currentTool === 'polygon' && isDrawing && drawingPoints.length >= 3) {
          finishPolygon();
        }
      }
      if (event.key === 'Escape') {
        if (isDrawing) {
          setIsDrawing(false);
          setDrawingPoints([]);
          
          // Clear preview lines
          if (sceneRef.current) {
            const previewLines = sceneRef.current.children.filter(child => 
              child.userData && child.userData.isPreview
            );
            previewLines.forEach(line => {
              disposeObject(line);
              sceneRef.current!.remove(line);
            });
          }
          
          setCurrentTool('select');
        } else if (currentTool !== 'select') {
          setCurrentTool('select');
        }
      }
      
      // Delete key functionality
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedObject && !isDrawing) {
          deleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, currentTool, drawingPoints, finishPolygon, disposeObject, selectedObject, deleteSelected]);

  // Reset states when tool changes
  useEffect(() => {
    if (currentTool !== 'line' && currentTool !== 'rectangle' && currentTool !== 'circle' && currentTool !== 'polygon') {
      setIsDrawing(false);
      setDrawingPoints([]);
      // Clear preview lines
      if (sceneRef.current) {
        const previewLines = sceneRef.current.children.filter(child => 
          child.userData && child.userData.isPreview
        );
        previewLines.forEach(line => {
          disposeObject(line);
          sceneRef.current!.remove(line);
        });
      }
    }
    
    // Reset move and pan states when changing tools
    if (currentTool !== 'move') {
      setIsMovingObject(false);
      setDragStartPoint(null);
      setDragOffset(null);
    }
    
    if (currentTool !== 'hand') {
      setIsPanning(false);
    }
  }, [currentTool, disposeObject]);

  // Add event listeners for mouse events
  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (canvas) {
      canvas.addEventListener('click', handleCanvasClick);
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        canvas.removeEventListener('click', handleCanvasClick);
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [handleCanvasClick, handleMouseDown, handleMouseMove, handleMouseUp]);

  // Add this after the neighborhoodData initialization in useEffect
  useEffect(() => {
    const dummyData = createDummyNeighborhood();
    const encoded = encodeNeighborhoodToBase64(dummyData);
    setNeighborhoodData(dummyData);
    setBase64Data(encoded);
    
    // ADD THIS DEBUG CODE
    console.log('Dummy neighborhood data:', dummyData);
    console.log('Base64 encoded:', encoded);
  }, []);

  // Remove the ground plane creation in the building section
  console.log('Creating buildings...');
  if (neighborhoodData) {
    // REMOVE THIS SECTION - it was creating the green ground plane
    // const groundGeometry = new THREE.PlaneGeometry(
    //   neighborhoodData.centerSpace.dimensions.width,
    //   neighborhoodData.centerSpace.dimensions.depth
    // );
    // const groundMaterial = new THREE.MeshBasicMaterial({ 
    //   color: '#8BC34A', 
    //   side: THREE.DoubleSide,
    //   transparent: true,
    //   opacity: 0.3
    // });
    // const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    // groundMesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    // groundMesh.position.set(0, 0, 0); // At ground level
    // sceneRef.current?.add(groundMesh);

    // Create buildings with their original colors
    neighborhoodData.buildings.forEach((building: BuildingData, index: number) => {
      console.log(`Creating building ${index + 1}:`, building);
      
      // Ensure building is not below ground (y position should be at least height/2)
      const minY = building.dimensions.height / 2;
      const adjustedY = Math.max(building.position.y, minY);
      
      const geometry = new THREE.BoxGeometry(
        building.dimensions.width,
        building.dimensions.height,
        building.dimensions.depth
      );
      
      const material = new THREE.MeshBasicMaterial({ 
        color: building.color, // Keep original building colors
        wireframe: false
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(building.position.x, adjustedY, building.position.z);
      
      // Add building label (optional)
      mesh.name = building.id;
      
      sceneRef.current?.add(mesh);
      console.log(`Added building ${building.name} to scene at:`, mesh.position);
    });
    
    console.log('Total scene children:', sceneRef.current?.children.length);
  } else {
    console.log('No neighborhood data available');
  }

function snapPositionToGrid(position: THREE.Vector3): THREE.Vector3 {
  if (!snapToGrid) return position;
  const snappedX = Math.round(position.x / gridSize) * gridSize;
  const snappedZ = Math.round(position.z / gridSize) * gridSize;
  return new THREE.Vector3(snappedX, position.y, snappedZ);
}


  const showAlignmentGuidesForObject = useCallback((movingObject: THREE.Object3D) => {
    if (!sceneRef.current) return;
    
    // Remove existing guides
    const existingGuides = sceneRef.current.children.filter(child => 
      child.userData?.isAlignmentGuide
    );
    existingGuides.forEach(guide => {
      sceneRef.current!.remove(guide);
      if (guide instanceof THREE.Line && guide.geometry) {
        guide.geometry.dispose();
      }
    });
    
    const threshold = 0.5;
    const movingPos = movingObject.position;
    
    // Check alignment with other objects
    objects.forEach(obj => {
      if (obj === movingObject || !obj.position) return;
      
      const objPos = obj.position;
      
      // Vertical alignment (X-axis)
      if (Math.abs(movingPos.x - objPos.x) < threshold) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(objPos.x, 0, -20),
          new THREE.Vector3(objPos.x, 0, 20)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: 0xff0000, 
          opacity: 0.9, 
          transparent: false
        });
        const guideLine = new THREE.Line(lineGeometry, lineMaterial);
        guideLine.userData = { isAlignmentGuide: true };
        sceneRef.current!.add(guideLine);
      }
      
      // Horizontal alignment (Z-axis)
      if (Math.abs(movingPos.z - objPos.z) < threshold) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-20, 0, objPos.z),
          new THREE.Vector3(20, 0, objPos.z)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: 0x00ff00, 
          opacity: 0.9, 
           transparent: false 
        });
        const guideLine = new THREE.Line(lineGeometry, lineMaterial);
        guideLine.userData = { isAlignmentGuide: true };
        sceneRef.current!.add(guideLine);
      }
    });
  }, [objects]);

  const createFloorStack = useCallback(() => {
    if (!selectedObject || !sceneRef.current) {
      alert('Please select a shape to stack floors');
      return;
    }

    if (numberOfFloors < 2) {
      alert('Number of floors must be at least 2');
      return;
    }

    try {
      const baseObject = selectedObject;
      const floors: THREE.Object3D[] = [];
      
      // Create floor copies
      for (let i = 1; i < numberOfFloors; i++) {
        const floorObject = baseObject.clone();
        
        // Clone geometry and material
        if (floorObject instanceof THREE.Mesh && baseObject instanceof THREE.Mesh) {
          floorObject.geometry = baseObject.geometry.clone();
          if (baseObject.material instanceof THREE.Material) {
            floorObject.material = baseObject.material.clone();
            // Vary color slightly for each floor
            if (floorObject.material instanceof THREE.MeshLambertMaterial) {
              const hue = (Math.random() * 0.1) + (i * 0.05); // Slight color variation
              floorObject.material.color.setHSL(hue, 0.7, 0.6);
            }
          }
        }
        
        // Position floor above the previous one
        floorObject.position.copy(baseObject.position);
        floorObject.position.y = baseObject.position.y + (i * floorHeight);
        
        // Update userData
        floorObject.userData = {
          ...baseObject.userData,
          id: Date.now() + Math.random() + i,
          isFloor: true,
          floorNumber: i + 1,
          baseObjectId: baseObject.userData?.id,
          floorHeight: floorHeight
        };
        
        floorObject.castShadow = true;
        floorObject.receiveShadow = true;
        
        sceneRef.current.add(floorObject);
        floors.push(floorObject);
      }
      
      // Update base object userData
      baseObject.userData = {
        ...baseObject.userData,
        isFloor: true,
        floorNumber: 1,
        totalFloors: numberOfFloors,
        floorHeight: floorHeight
      };
      
      // Add all floors to objects array
      setObjects(prev => [...prev, ...floors]);
      
      console.log(`Created ${numberOfFloors} floors`);
      
    } catch (error) {
      console.error('Error creating floor stack:', error);
      alert('Failed to create floor stack');
    }
  }, [selectedObject, numberOfFloors, floorHeight]);

  return (
    <div className="w-full h-screen relative">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Toolbar */}
      <div  style={{ position:"absolute",top:30}}>
        <div className="text-sm font-semibold mb-2">Tools</div>
        
        <button
          onClick={() => setCurrentTool('select')}
          className={`p-2 rounded flex items-center gap-2 ${currentTool === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        >
          <MousePointer size={16} />
          Select
        </button>

        <button
          onClick={() => setCurrentTool('move')}
          className={`p-2 rounded flex items-center gap-2 ${currentTool === 'move' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        >
          <Move size={16} />
          Move
        </button>

        <button
          onClick={() => setCurrentTool('hand')}
          className={`p-2 rounded flex items-center gap-2 ${currentTool === 'hand' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        >
          <Hand size={16} />
          Pan
        </button>
        
        <button
          onClick={() => setCurrentTool('line')}
          className={`p-2 rounded flex items-center gap-2 ${currentTool === 'line' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        >
          <Pencil size={16} />
          Line
        </button>
        
        <button
          onClick={() => setCurrentTool('rectangle')}
          className={`p-2 rounded flex items-center gap-2 ${currentTool === 'rectangle' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        >
          <Square size={16} />
          Rectangle
        </button>
        
        <button
          onClick={() => setCurrentTool('circle')}
          className={`p-2 rounded flex items-center gap-2 ${currentTool === 'circle' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        >
          <Circle size={16} />
          Circle
        </button>

        <button
          onClick={() => setCurrentTool('polygon')}
          className={`p-2 rounded flex items-center gap-2 ${currentTool === 'polygon' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        >
          <Pentagon size={16} />
          Polygon
        </button>

        <button
          onClick={() => setShowCoordinatePanel(!showCoordinatePanel)}
          className={`p-2 rounded flex items-center gap-2 ${showCoordinatePanel ? 'bg-purple-500 text-white' : 'bg-gray-100'}`}
        >
          <Code size={16} />
          3D Generator
        </button>

        <button
          onClick={createFloorStack}
          disabled={!selectedObject}
          className={`p-2 rounded ${
            currentTool === 'floors' 
              ? 'bg-purple-500 text-white' 
              : 'bg-gray-100 hover:bg-gray-200'
          } disabled:bg-gray-200 disabled:text-gray-400`}
          title="Create Floor Stack"
        >
          <Box size={16} />
        </button>

        <button
          onClick={() => setShowDataPanel(!showDataPanel)}
          className={`p-2 rounded flex items-center gap-2 ${showDataPanel ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
          title="View Neighborhood Data"
        >
          <Download size={16} />
          Data
        </button>
      </div>

      {/* 3D Coordinate Input Panel */}
      {showCoordinatePanel && (
        <div className="absolute top-4 left-64 bg-white rounded-lg shadow-lg p-4 w-96">
          <div className="text-sm font-semibold mb-3">3D Shape Generator</div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1">
                Enter coordinate arrays (JSON format)
              </label>
              <textarea
                value={coordinateInput}
                onChange={(e) => setCoordinateInput(e.target.value)}
                className="w-full p-2 border rounded text-sm h-32 resize-none font-mono"
                placeholder={`[
  ["0,0", "3,0", "3,3", "0,3"],
  ["0,0", "3,0", "3,3", "0,3"]
]`}

              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => create3DFromCoordinates(coordinateInput)}
                className="flex-1 p-2 bg-purple-500 text-white rounded text-sm"
              >
                Generate 3D Shapes
              </button>
              <button
                onClick={() => {
                  setCoordinateInput(`[

  ["0,0", "3,0", "3,0", "0,0"],
  ["0,3", "3,3", "3,3", "0,3"],
  ["0,0", "3,0", "3,3", "0,3"],
  ["0,0", "3,0", "3,3", "0,3"],
  ["0,0", "0,0", "0,3", "0,3"],
  ["3,0", "3,0", "3,3", "3,3"]
]`);
                }}
                className="px-3 py-2 bg-gray-500 text-white rounded text-sm"
              >
                Example
              </button>
            </div>
            <div className="text-xs text-gray-600">
              <div className="font-medium mb-1">Instructions:</div>
              <div>• Each array represents one 3D shape</div>
              <div>• Each coordinate is "x,z" format</div>
              <div>• Shapes will be positioned side by side</div>
              <div>• Duplicate points are automatically filtered</div>
              <div>• Height is controlled by "Extrude Height" setting</div>
            </div>
          </div>
        </div>
      )}

      {/* Properties Panel */}
      <div  style={{ position:"absolute",top:100}}>
        <div className="text-sm font-semibold mb-4">Properties</div>
        
        <div className="space-y-3" style={{ display: "flex", flexDirection:"column", flexWrap: "wrap",gap:"10px" }}>
          <div style={{display: "flex", flexDirection: "column", width: "200px"}}>
            <label className="block text-sm mb-1">Extrude Height</label>
            <input
              type="number"
              value={extrudeHeight}
              onChange={(e) => setExtrudeHeight(parseFloat(e.target.value) || 1)}
              className="w-full p-2 border rounded text-sm"
              min="0.1"
              step="0.1"
            />
          </div>
          
          {/* ADD THIS FLOOR CONTROLS SECTION */}
          <div className="border-t pt-3">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Building size={16} />
              Floor Controls
            </div>
            
            <div className="space-y-2">
              <div>
                <label className="block text-xs mb-1">Number of Floors</label>
                <input
                  type="number"
                  value={numberOfFloors}
                  onChange={(e) => setNumberOfFloors(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full p-2 border rounded text-sm"
                  min="1"
                  max="50"
                />
              </div>
              
              <div>
                <label className="block text-xs mb-1">Floor Height</label>
                <input
                  min="1"
                  max="50"
                />
              </div>
              
              <div>
                <label className="block text-xs mb-1">Floor Height</label>
                <input
                  type="number"
                  value={floorHeight}
                  onChange={(e) => setFloorHeight(parseFloat(e.target.value) || 3)}
                  className="w-full p-2 border rounded text-sm"
                  min="0.5"
                  step="0.1"
                />
              </div>
              
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                Total Height: {(numberOfFloors * floorHeight).toFixed(1)} units
              </div>
              
              <button
                onClick={createFloorStack}
                disabled={!selectedObject || numberOfFloors < 2}
                className="w-full p-2 bg-purple-500 text-white rounded disabled:bg-gray-300 text-xs"
              >
                Create {numberOfFloors} Floors
              </button>
            </div>
          </div>

         

          <button
            onClick={extrudeSelected}
            disabled={!selectedObject || selectedObject.userData?.type === 'extruded3D'}
            className="w-full p-2 bg-green-500 text-white rounded disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            <Move3D size={16} />
            Extrude
          </button>
          
          <button
            onClick={deleteSelected}
            disabled={!selectedObject}
            className="w-full p-2 bg-red-500 text-white rounded disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            Delete
          </button>

          {/* 3D Generator info */}
          {showCoordinatePanel && (
            <div className="mt-4 p-3 bg-purple-50 rounded border-l-4 border-purple-500">
              <div className="text-sm font-medium text-purple-800 mb-2">
                3D Generator Active
              </div>
              <div className="text-xs text-purple-600 space-y-1">
                <div>• Input coordinate arrays in JSON format</div>
                <div>• Each array creates one 3D shape</div>
                <div>• Shapes are automatically extruded</div>
                <div>• Click "Example" for sample data</div>
              </div>
            </div>
          )}

          {/* Move tool info */}
          {currentTool === 'move' && (
            <div className="mt-4 p-3 bg-green-50 rounded border-l-4 border-green-500">
              <div className="text-sm font-medium text-green-800 mb-2">
                Seamless Move Tool
              </div>
              <div className="text-xs text-green-600 space-y-1">
                {!selectedObject && <div>1. Click on an object to select it</div>}
                {selectedObject && !isMovingObject && (
                  <>
                    <div>2. Click and drag the selected object to move it</div>
                    <div>• Selected object is highlighted</div>
                  </>
                )}
                {isMovingObject && (
                  <>
                    <div>Moving object... Release to place</div>
                    <div>Press Escape to cancel</div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Hand tool info */}
          {currentTool === 'hand' && (
            <div className="mt-4 p-3 bg-blue-50 rounded border-l-4 border-blue-500">
              <div className="text-sm font-medium text-blue-800 mb-2">
                Pan Tool Active
              </div>
              <div className="text-xs text-blue-600 space-y-1">
                <div>Click and drag to pan the view</div>
                <div>Use right-click + drag for orbit</div>
                <div>Mouse wheel to zoom</div>
              </div>
            </div>
          )}

          {/* Polygon specific controls */}
          {currentTool === 'polygon' && isDrawing && (
            <div className="mt-4 p-3 bg-blue-50 rounded border-l-4 border-blue-500">
              <div className="text-sm font-medium mb-2">
                Polygon Mode
              </div>
              <div className="text-xs text-blue-600 space-y-1">
                <div>Points: {drawingPoints.length}</div>
                <div>Press Enter to finish</div>
                <div>Press Escape to cancel</div>
                <button
                  onClick={finishPolygon}
                  disabled={drawingPoints.length < 3}
                  className="w-full mt-2 p-1 bg-blue-500 text-white rounded text-xs disabled:bg-gray-300"
                >
                  Finish Polygon
                </button>
              </div>
            </div>
          )}

          {/* Selection info */}
          {selectedObject && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <div className="text-sm font-medium mb-1">Selected Object</div>
              <div className="text-xs text-gray-600">
                Type: {selectedObject.userData?.type || 'Unknown'}
                {selectedObject.userData?.type === 'polygon' && (
                  <div>Points: {selectedObject.userData?.points?.length || 0}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded-lg text-sm max-w-md">
        <div className="font-semibold mb-2">Instructions:</div>
        <ul className="space-y-1 text-xs">
          <li>• <strong>Rectangle/Circle:</strong> Click start → Click end</li>
          <li>• <strong>Polygon:</strong> Click points → Double-click to finish</li>
          <li>• <strong>Selection:</strong> Click any shape to select it</li>
          <li>• <strong>Move:</strong> Select move tool → Click and drag shapes</li>
          <li>• <strong>Extrude:</strong> Select shape → Set height → Extrude</li>
        </ul>
      </div>

      {/* Data Panel */}
      {showDataPanel && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-96 max-h-80 overflow-y-auto">
          <div className="text-sm font-semibold mb-3">Neighborhood Base64 Data</div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1">Base64 Encoded Building Data</label>
              <textarea
                value={base64Data}
                readOnly
                className="w-full p-2 border rounded text-xs font-mono bg-gray-50 h-32 resize-none"
                placeholder="Base64 data will appear here..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(base64Data);
                  alert('Base64 data copied to clipboard!');
                }}
                className="flex-1 p-2 bg-blue-500 text-white rounded text-sm"
              >
                Copy Base64
              </button>
              <button
                onClick={() => setShowDataPanel(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolygonCreation;