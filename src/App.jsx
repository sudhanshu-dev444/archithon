import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PatientProvider } from './context/PatientContext';
import { SyncProvider } from './context/SyncContext';
import { ToastProvider } from './context/ToastContext';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PatientDirectoryPage from './pages/PatientDirectoryPage';
import PatientDetailPage from './pages/PatientDetailPage';
import ClinicalIntakePage from './pages/ClinicalIntakePage';
import ClinicalReviewPage from './pages/ClinicalReviewPage';
import SyncPage from './pages/SyncPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <PatientProvider>
            <ToastProvider>
              <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Default Redirect to Login */}
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* Main Application Routes */}
                <Route path="/patients" element={<PatientDirectoryPage />} />
                <Route path="/patients/:id" element={<PatientDetailPage />} />
                <Route path="/patients/:id/intake" element={<ClinicalIntakePage />} />
                <Route path="/patients/:id/review" element={<ClinicalReviewPage />} />
                <Route path="/sync" element={<SyncPage />} />

                {/* Reports & Settings */}
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </ToastProvider>
          </PatientProvider>
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
