import React from 'react';
import ProjectsGrid from './components/ProjectsTable';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Project Explorer
          </h1>
          <p className="text-gray-600">
            Explore ridership modeling projects from S3 data
          </p>
        </div>
        
        <ProjectsGrid />
      </div>
    </div>
  );
}

export default App;
