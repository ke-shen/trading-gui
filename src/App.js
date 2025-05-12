import React from 'react';
import SpreadsheetGrid from './components/SpreadsheetGrid';
import ValueLogger from './components/ValueLogger';
import './App.css';

function App() {
  return (
    <div className="App">
      <div className="main-content">
        <SpreadsheetGrid />
      </div>
      <div className="logger-panel">
        <ValueLogger />
      </div>
    </div>
  );
}

export default App;
