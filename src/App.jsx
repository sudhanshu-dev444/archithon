import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PatientProvider } from './context/PatientContext';
import { SyncProvider } from './context/SyncContext';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PatientDirectoryPage from './pages/PatientDirectoryPage';
import PatientDetailPage from './pages/PatientDetailPage';
import ClinicalIntakePage from './pages/ClinicalIntakePage';
import ClinicalReviewPage from './pages/ClinicalReviewPage';
import SyncPage from './pages/SyncPage';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Simple placeholder page for secondary nav items (Reports / Settings)
function PlaceholderPage({ title, icon, description }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center antialiased">
      <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary mb-3">
        <span className="material-symbols-outlined text-[36px]">{icon}</span>
      </div>
      <h2 className="text-headline-md font-bold text-primary">{title}</h2>
      <p className="text-body-md text-on-surface-variant max-w-sm mt-1 mb-6">{description}</p>
      <a
        href="/patients"
        className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors shadow-sm"
      >
        Return to Patient Directory
      </a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <PatientProvider>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Default Redirect to Login */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Main Application Routes (Accessible for demo / authenticated) */}
              <Route path="/patients" element={<PatientDirectoryPage />} />
              <Route path="/patients/:id" element={<PatientDetailPage />} />
              <Route path="/patients/:id/intake" element={<ClinicalIntakePage />} />
              <Route path="/patients/:id/review" element={<ClinicalReviewPage />} />
              <Route path="/sync" element={<SyncPage />} />

              {/* Auxiliary Tabs */}
              <Route
                path="/reports"
                element={
                  <PlaceholderPage
                    title="Epidemiological Reports & Outbreak Surveillance"
                    icon="bar_chart"
                    description="Offline vector aggregation module for syndromic surveillance (Malaria/Dengue cluster detection) in Ganiyari Outpost."
                  />
                }
              />
              <Route
                path="/settings"
                element={
                  <PlaceholderPage
                    title="Station Hardware & Key Store Settings"
                    icon="settings"
                    description="SQLite database configuration, AES-256 local vault parameters, and FHIR credential synchronization settings."
                  />
                }
              />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </PatientProvider>
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}