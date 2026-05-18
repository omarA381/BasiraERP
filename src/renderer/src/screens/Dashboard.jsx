import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <LayoutDashboard className="mx-auto h-16 w-16 text-brand-500" />
        <h1 className="text-3xl font-bold text-gray-900">NEXTERP</h1>
        <p className="text-lg text-gray-500">Enterprise Resource Planning System</p>
      </div>
    </div>
  );
}