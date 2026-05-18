import '../styles/global.css';

import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './screens/Dashboard';
import DatabaseSetup from './screens/DatabaseSetup';

export default function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/database-setup" replace />} />
          <Route path="/database-setup" element={<DatabaseSetup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/database-setup" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}