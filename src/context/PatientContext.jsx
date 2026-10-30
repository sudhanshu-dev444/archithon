import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import patientsData from '../data/patients.json';
import { api } from '../services/api';

const PatientContext = createContext(null);
const PATIENTS_CACHE_KEY = 'swasthya_patients_cache';

export function PatientProvider({ children }) {
  const [patients, setPatients] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(PATIENTS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {}
    return patientsData;
  });

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Persist patient list to localStorage
  const persistPatientsLocally = useCallback((data) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PATIENTS_CACHE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Could not cache patients to localStorage:', e);
    }
  }, []);

  // Load live patients from backend if online
  const refreshPatients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPatients();
      if (res && res.patients && res.patients.length > 0) {
        setPatients((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          res.patients.forEach((sp) => {
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
              date_of_birth: sp.date_of_birth || existing.date_of_birth,
              address: sp.address || existing.address,
              emergency_contact_name: sp.emergency_contact_name || existing.emergency_contact_name,
              emergency_contact_phone: sp.emergency_contact_phone || existing.emergency_contact_phone,
              photoUrl: sp.photo_url || existing.photoUrl,
              photo_url: sp.photo_url || existing.photo_url,
              allergies: sp.allergies || existing.allergies || [],
            });
          });
          const merged = Array.from(map.values());
          persistPatientsLocally(merged);
          return merged;
        });
      }
    } catch {
      // Offline fallback: retains local JSON / localStorage cache
    } finally {
      setLoading(false);
    }
  }, [persistPatientsLocally]);

  useEffect(() => {
    refreshPatients();
  }, [refreshPatients]);

  const filteredPatients = patients.filter((p) =>
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.condition || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPatientById = (id) => patients.find((p) => p.id === id);

  const addPatient = async (patientData) => {
    const newId = patientData.id || `PAT-${Date.now().toString().slice(-4)}`;
    const fullPatient = {
      ...patientData,
      id: newId,
      photoUrl: patientData.photo_url || patientData.photoUrl,
    };

    // Update state & localStorage immediately
    setPatients((prev) => {
      const updated = [fullPatient, ...prev.filter((p) => p.id !== newId)];
      persistPatientsLocally(updated);
      return updated;
    });

    // Send to backend in real time
    try {
      await api.createPatient({
        patient_id: newId,
        abha: patientData.abha,
        name: patientData.name,
        age: patientData.age,
        sex: patientData.gender || patientData.sex,
        village: patientData.village || 'Ganiyari Outpost Hub',
        ward: patientData.ward,
        phone: patientData.phone,
        condition: patientData.condition,
        triage: patientData.triage || 'routine',
        summary: patientData.summary,
        date_of_birth: patientData.date_of_birth,
        address: patientData.address,
        emergency_contact_name: patientData.emergency_contact_name,
        emergency_contact_phone: patientData.emergency_contact_phone,
        photo_url: patientData.photo_url || patientData.photoUrl,
      });
    } catch (err) {
      console.warn('Patient created offline (cached locally, will sync):', err.message);
    }

    return fullPatient;
  };

  const updatePatientRecord = async (id, updates) => {
    const normalized = {
      ...updates,
      photoUrl: updates.photo_url || updates.photoUrl,
    };

    // Update state & localStorage immediately
    setPatients((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...normalized } : p));
      persistPatientsLocally(updated);
      return updated;
    });

    if (selectedPatient && selectedPatient.id === id) {
      setSelectedPatient((prev) => ({ ...prev, ...normalized }));
    }

    try {
      await api.updatePatient(id, {
        ...updates,
        photo_url: updates.photo_url || updates.photoUrl,
      });
    } catch (err) {
      console.warn('Patient updated offline (cached locally):', err.message);
    }
  };

  return (
    <PatientContext.Provider
      value={{
        patients: filteredPatients,
        allPatients: patients,
        selectedPatient,
        setSelectedPatient,
        searchQuery,
        setSearchQuery,
        getPatientById,
        addPatient,
        updatePatientRecord,
        savePatientRecord: updatePatientRecord,
        refreshPatients,
        loading,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export const usePatients = () => useContext(PatientContext);
