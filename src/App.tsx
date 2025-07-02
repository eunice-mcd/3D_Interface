import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
// import SketchUp3D from './Phase2_3D'
import PolygonCreation from './Polygon'
import Base64BuildingEditor from './objcreation';
import BuildingVisualizer from './objcreation';
import GenerateBuildings from './generatebuildings';

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Remove or comment out this route if it exists */}
        {/* <Route path="/phase2" element={<SketchUp3D />} /> */}
        <Route path="/" element={<PolygonCreation />} />
              <Route path="/buildings" element={<GenerateBuildings />} />


        {/* <Route path="/obj" element={<BuildingVisualizer />} /> */}

      </Routes>
    </Router>
  );
}

export default App