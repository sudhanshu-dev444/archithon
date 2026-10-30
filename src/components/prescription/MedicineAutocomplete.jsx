// src/components/prescription/MedicineAutocomplete.jsx
// Searchable medicine formulary autocomplete component with generic search,
// dosage presets, and instant allergy warning flags.

import React, { useState, useEffect, useRef } from 'react';
import formularyData from '../../data/medicines.json';

export default function MedicineAutocomplete({
  value,
  onChange,
  onSelectMedicine,
  patientAllergies = [],
  placeholder = 'Search medicines by brand, generic, or category (e.g. Paracetamol, Azithromycin)...',
}) {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef(null);

  const medicines = formularyData.medicines || [];

  // Check if patient has penicillin/beta-lactam allergy
  const hasPenicillinAllergy = patientAllergies.some((a) => {
    const text = `${a.name || ''} ${a.reaction || ''} ${JSON.stringify(a.crossReactivity || '')}`.toLowerCase();
    return text.includes('penicillin') || text.includes('amoxicillin') || text.includes('beta-lactam');
  });

  useEffect(() => {
    if (!query.trim()) {
      setFiltered([]);
      setIsOpen(false);
      return;
    }

    const q = query.toLowerCase();
    const matches = medicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.generic.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    ).slice(0, 8);

    setFiltered(matches);
    setIsOpen(matches.length > 0);
    setHighlightIdx(-1);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (med) => {
    const fullName = `${med.name} ${med.strength} (${med.form})`;
    setQuery(fullName);
    if (onChange) onChange(fullName);
    if (onSelectMedicine) onSelectMedicine(med);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && filtered[highlightIdx]) {
        handleSelect(filtered[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <span className="material-symbols-outlined absolute left-3.5 text-secondary text-[20px] pointer-events-none">
          medication
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (onChange) onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (filtered.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full h-12 pl-11 pr-10 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              if (onChange) onChange('');
              setFiltered([]);
              setIsOpen(false);
            }}
            className="absolute right-3 p-1 rounded-full text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <ul className="absolute top-full left-0 right-0 mt-1.5 bg-surface-container-lowest rounded-xl shadow-2xl border border-surface-container z-50 max-h-72 overflow-y-auto divide-y divide-surface-container">
          {filtered.map((med, idx) => {
            const isContraindicated = hasPenicillinAllergy && !med.safeForPenicillinAllergy;
            const isHighlighted = idx === highlightIdx;

            return (
              <li
                key={med.id}
                onClick={() => handleSelect(med)}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`p-3 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                  isHighlighted ? 'bg-surface-container' : 'hover:bg-surface-container-low'
                } ${isContraindicated ? 'bg-error-container/20' : ''}`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-body-md font-bold text-on-surface">
                      {med.name}
                    </span>
                    <span className="px-2 py-0.2 rounded-full bg-surface-container-high text-primary font-mono text-[11px] font-semibold">
                      {med.strength} • {med.form}
                    </span>
                    {isContraindicated && (
                      <span className="px-2 py-0.2 rounded-full bg-error text-on-error font-bold text-[10px] uppercase flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">warning</span>
                        <span>Allergy Conflict</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[12px] text-on-surface-variant font-medium">
                    Generic: <span className="text-secondary font-semibold">{med.generic}</span> • {med.category}
                  </span>
                  <span className="text-[11px] text-outline mt-0.5">
                    Std Dosage: {med.dosage}
                  </span>
                </div>

                <div className="flex items-center text-primary font-bold text-[12px] shrink-0 mt-1">
                  <span>Select</span>
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

