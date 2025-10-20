import React from 'react';

const Home: React.FC = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Welcome to Your Electron App!</h1>
      <p className="text-lg">This is the home page for your desktop app. Start building your awesome app here!</p>
      <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Electron Feature Button</button>
    </div>
  );
};

export default Home;