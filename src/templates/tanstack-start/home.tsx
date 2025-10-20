import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Welcome to Your TanStack Start App!</h1>
      <p className="text-lg">This is the home page. Start building your awesome app here!</p>
    </div>
  );
}