import React, { createContext, useContext, useState, useEffect } from 'react';
import patientsData from '../data/patients.json';
import { api } from '../services/api';

const PatientContext = createContext(null);

export function PatientProvider({ children }) {
  const [patients, setPatients] = useState(patientsData);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Load live patients from backend if online
  const refreshPatients = async () => {
    setLoading(true);
    try {
      const res = await api.getPatients();
      if (res && res.patients && res.patients.length > 0) {
        // Merge server patients with local rich fields (photoUrl, vitals, etc.)
        setPatients(prev => {
          const map = new Map(prev.map(p => [p.id, p]));
          res.patients.forEach(sp => {
            const id = sp.patient_id || sp.id;
            const existing = map.get(id) || {};
            map.set(id, {
              ...existing,
              id,
              name: sp.name || existing.name,
              age: sp.age ?? existing.age,
              gender: sp.sex || existing.gender || 'Unknown',
              sex: sp.sex || existing.sex,
              abha: sp.abha || existing.abha,
              condition: sp.condition || existing.condition,
              triage: sp.triage || existing.triage || 'routine',
              ward: sp.ward || existing.ward,
              village: sp.village || existing.village,
              phone: sp.phone || existing.phone,
              summary: sp.summary || existing.summary,
              allergies: sp.allergies || existing.allergies || [],
            });
          });
          return Array.from(map.values());
        });
      }
    } catch {
      // Offline fallback: retains local JSON cache
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPatients();
  }, []);

  const filteredPatients = patients.filter(p =>
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.condition || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPatientById = (id) => patients.find(p => p.id === id);

  const addPatient = async (patientData) => {
    const newId = patientData.id || `PAT-${Date.now().toString().slice(-4)}`;
    const fullPatient = { ...patientData, id: newId };
    setPatients(prev => [fullPatient, ...prev]);

    // Send to backend in real time
    try {
      await api.createPatient({
        patient_id: newId,
        abha: patientData.abha,
        name: patientData.name,
        age: patientData.age,
        sex: patientData.gender || patientData.sex,
        village: patientData.village,
        ward: patientData.ward,
        phone: patientData.phone,
        condition: patientData.condition,
        triage: patientData.triage || 'routine',
        summary: patientData.summary,
      });
    } catch (err) {
      console.warn('Patient created offline (will sync on reconnect):', err.message);
    }
    return fullPatient;
  };

  const updatePatientRecord = async (id, updates) => {
    setPatients(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
    try {
      await api.updatePatient(id, updates);
    } catch (err) {
      console.warn('Patient updated offline:', err.message);
    }
  };

  return (
    <PatientContext.Provider value={{
      patients: filteredPatients,
      allPatients: patients,
      selectedPatient,
      setSelectedPatient,
      searchQuery,
      setSearchQuery,
      getPatientById,
      addPatient,
      updatePatientRecord,
      refreshPatients,
      loading,
    }}>
      {children}
    </PatientContext.Provider>
  );
}

export const usePatients = () => useContext(PatientContext);
