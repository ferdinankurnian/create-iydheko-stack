import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({
  component: About,
});

function About() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">About Your Electron App</h1>
      <p className="text-lg">Learn more about our desktop project and what we're building.</p>
    </div>
  );
}