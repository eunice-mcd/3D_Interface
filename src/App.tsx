import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom'
// import SketchUp3D from './Phase2_3D'
import PolygonCreation from './Polygon'
import Base64BuildingEditor from './objcreation';
import BuildingVisualizer from './objcreation';
import GenerateBuildings from './generatebuildings';
import UserChoice from './Userchoice';

// Create a wrapper component for UserChoice that has access to navigate
const UserChoiceWrapper = () => {
  const navigate = useNavigate();

  const handleOptionSelect = (option: 'create' | 'nash' | 'fetch') => {
    switch (option) {
      case 'create':
        navigate('/buildings'); // Navigate to building creation
        break;
      case 'nash':
        // Navigate to NASH model page when you create it
        console.log('NASH model selected - implement navigation');
        break;
      case 'fetch':
        // Navigate to fetch model page when you create it
        console.log('Fetch model selected - implement navigation');
        break;
      default:
        break;
    }
  };

  return <UserChoice onOptionSelect={handleOptionSelect} />;
};

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Remove or comment out this route if it exists */}
        {/* <Route path="/phase2" element={<SketchUp3D />} /> */}
        <Route path="/" element={<PolygonCreation />} />
        <Route path="/buildings" element={<GenerateBuildings />} />
        <Route path="/userStory" element={<UserChoiceWrapper />} />
        {/* <Route path="/obj" element={<BuildingVisualizer />} /> */}
      </Routes>
    </Router>
  );
}

export default App