import React, { createContext, useContext, useState } from 'react';
import patientsData from '../data/patients.json';

const PatientContext = createContext(null);

export function PatientProvider({ children }) {
  const [patients, setPatients] = useState(patientsData);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.condition || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPatientById = (id) => patients.find(p => p.id === id);

  return (
    <PatientContext.Provider value={{
      patients: filteredPatients,
      allPatients: patients,
      selectedPatient,
      setSelectedPatient,
      searchQuery,
      setSearchQuery,
      getPatientById,
    }}>
      {children}
    </PatientContext.Provider>
  );
}

export const usePatients = () => useContext(PatientContext);
