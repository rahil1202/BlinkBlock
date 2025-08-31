import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">EyeCare Focus Extension</h1>
        <p className="text-gray-600 mb-4">
          This is the main React app. The extension uses separate popup and options pages.
        </p>
        <p className="text-sm text-gray-500">
          Click the extension icon in Chrome to access the dashboard.
        </p>
      </div>
    </div>
  );
}

export default App;