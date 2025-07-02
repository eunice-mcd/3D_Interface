import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

// ===================== INTERFACES =====================
interface BuildingData {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  color: string;
  type: 'residential' | 'commercial' | 'industrial' | 'mixed';
}

interface BuildingScene {
  buildings: BuildingData[];
  metadata: {
    version: string;
    created: string;
    description: string;
  };
}

// ===================== DUMMY DATA GENERATOR =====================
const createDummyBuildingScene = (): BuildingScene => {
  const buildings: BuildingData[] = [
    // North Building - Office Tower
    {
      id: 'building-north',
      name: 'North Office Tower',
      position: { x: 0, y: 0, z: -80 },
      dimensions: { width: 25, height: 80, depth: 20 },
      color: '#2c3e50',
      type: 'commercial'
    },
    
    // South Building - Shopping Complex
    {
      id: 'building-south',
      name: 'South Shopping Complex',
      position: { x: 0, y: 0, z: 80 },
      dimensions: { width: 40, height: 25, depth: 30 },
      color: '#e74c3c',
      type: 'commercial'
    },
    
    // East Building - Residential Tower
    {
      id: 'building-east',
      name: 'East Residential Tower',
      position: { x: 70, y: 0, z: 0 },
      dimensions: { width: 20, height: 60, depth: 25 },
      color: '#27ae60',
      type: 'residential'
    },
    
    // West Building - Mixed Use Complex
    {
      id: 'building-west',
      name: 'West Mixed Use Complex',
      position: { x: -70, y: 0, z: 0 },
      dimensions: { width: 30, height: 45, depth: 22 },
      color: '#f39c12',
      type: 'mixed'
    },
    
    // Northeast Building - Industrial Facility
    {
      id: 'building-northeast',
      name: 'Northeast Industrial Facility',
      position: { x: 50, y: 0, z: -50 },
      dimensions: { width: 35, height: 20, depth: 40 },
      color: '#95a5a6',
      type: 'industrial'
    }
  ];

  return {
    buildings,
    metadata: {
      version: '1.0.0',
      created: new Date().toISOString(),
      description: 'Dummy city layout with central plaza - 5 buildings arranged around a central space'
    }
  };
};

// ===================== UTILITY FUNCTIONS =====================
const encodeBuildingDataToBase64 = (data: BuildingScene): string => {
  const jsonString = JSON.stringify(data, null, 2);
  return btoa(jsonString);
};

const decodeBuildingDataFromBase64 = (base64: string): BuildingScene => {
  try {
    const decoded = atob(base64);
    return JSON.parse(decoded) as BuildingScene;
  } catch (error) {
    throw new Error('Invalid base64 data format');
  }
};

// ===================== MAIN COMPONENT =====================
const BuildingVisualizer: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationIdRef = useRef<number | null>(null);
  
  const [buildingScene, setBuildingScene] = useState<BuildingScene | null>(null);
  const [base64Data, setBase64Data] = useState<string>('');

  // Generate dummy data and base64 on component mount
  useEffect(() => {
    const dummyScene = createDummyBuildingScene();
    const encoded = encodeBuildingDataToBase64(dummyScene);
    setBuildingScene(dummyScene);
    setBase64Data(encoded);
  }, []);

  // Three.js scene setup
  useEffect(() => {
    if (!mountRef.current || !buildingScene) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.set(150, 120, 150);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x87CEEB, 1.0);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(100, 150, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -150;
    directionalLight.shadow.camera.right = 150;
    directionalLight.shadow.camera.top = 150;
    directionalLight.shadow.camera.bottom = -150;
    scene.add(directionalLight);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(300, 300);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x90EE90,
      transparent: true,
      opacity: 0.8 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.1;
    scene.add(ground);

    // Central plaza (different colored ground)
    const plazaGeometry = new THREE.PlaneGeometry(60, 60);
    const plazaMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xF5DEB3, // Wheat color for plaza
      transparent: true,
      opacity: 0.9 
    });
    const plaza = new THREE.Mesh(plazaGeometry, plazaMaterial);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0;
    scene.add(plaza);

    // Add plaza border
    const borderGeometry = new THREE.RingGeometry(30, 32, 32);
    const borderMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.1;
    scene.add(border);

    // Grid helper
    const gridHelper = new THREE.GridHelper(300, 30, 0x444444, 0x666666);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    // Create buildings
    buildingScene.buildings.forEach(building => {
      const geometry = new THREE.BoxGeometry(
        building.dimensions.width,
        building.dimensions.height,
        building.dimensions.depth
      );
      
      const material = new THREE.MeshPhongMaterial({
        color: building.color,
        transparent: true,
        opacity: 0.85,
        shininess: 30
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        building.position.x,
        building.dimensions.height / 2,
        building.position.z
      );
      
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { buildingId: building.id, buildingData: building };
      
      scene.add(mesh);
    });

    // Mouse controls
    let isMouseDown = false;
    let mouseX = 0, mouseY = 0;

    const onMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseUp = (event: MouseEvent) => {
      event.preventDefault();
      isMouseDown = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isMouseDown || !camera) return;

      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      const spherical = new THREE.Spherical();
      spherical.setFromVector3(camera.position);
      spherical.theta -= deltaX * 0.01;
      spherical.phi += deltaY * 0.01;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

      camera.position.setFromSpherical(spherical);
      camera.lookAt(0, 0, 0);

      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaY > 0 ? 1.1 : 0.9;
      camera.position.multiplyScalar(scale);
      
      const distance = camera.position.length();
      if (distance < 50) {
        camera.position.normalize().multiplyScalar(50);
      } else if (distance > 500) {
        camera.position.normalize().multiplyScalar(500);
      }
    };

    // Handle window resize
    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    // Event listeners
    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel);
    window.addEventListener('resize', onWindowResize);

    mountRef.current.appendChild(renderer.domElement);

    // Animation loop (static rendering)
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onWindowResize);
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      
      renderer.dispose();
    };
  }, [buildingScene]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(base64Data);
    alert('Base64 data copied to clipboard!');
  };

  return (
    <div style={styles.container}>
      {/* Base64 Data Display - Top overlay */}
      <div style={styles.dataOverlay}>
        <textarea
          value={base64Data}
          readOnly
          style={styles.textarea}
          rows={4}
        />
        <button style={styles.button} onClick={copyToClipboard}>
          Copy Base64 Data
        </button>
      </div>

      {/* 3D Viewport - Full Screen */}
      <div ref={mountRef} style={styles.viewport} />
    </div>
  );
};

// ===================== STYLES =====================
const styles = {
  container: {
    position: 'relative' as const,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  } as React.CSSProperties,

  dataOverlay: {
    position: 'absolute' as const,
    top: '20px',
    right: '20px',
    width: '300px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '15px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px'
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    height: '80px',
    padding: '8px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    fontSize: '9px',
    resize: 'none' as const,
    backgroundColor: '#f8f9fa',
    boxSizing: 'border-box' as const
  } as React.CSSProperties,

  button: {
    padding: '8px 12px',
    border: 'none',
    backgroundColor: '#007bff',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500' as const,
    transition: 'background-color 0.2s ease'
  } as React.CSSProperties,

  viewport: {
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  } as React.CSSProperties
};

export default BuildingVisualizer;