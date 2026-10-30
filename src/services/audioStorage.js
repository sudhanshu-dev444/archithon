// src/services/audioStorage.js
// Client-side IndexedDB persistence for clinical ambient audio recordings.
// Works 100% offline with zero external network dependency.

const DB_NAME = 'swasthya_audio_vault';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

function openAudioDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('patient_id', 'patient_id', { unique: false });
        store.createIndex('encounter_id', 'encounter_id', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists an audio recording blob with comprehensive clinical metadata.
 * @param {Object} recording
 * @param {string} recording.id
 * @param {string} recording.patient_id
 * @param {string} [recording.encounter_id]
 * @param {Blob} recording.blob
 * @param {number} recording.duration
 * @param {string} recording.language
 * @param {string} recording.recorded_by
 * @param {string} [recording.recorded_by_role]
 */
export async function saveAudioRecording({
  id = `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  patient_id,
  encounter_id = `ENC-${Date.now()}`,
  blob,
  duration,
  language = 'hi',
  recorded_by = 'DOC-001',
  recorded_by_role = 'Doctor',
}) {
  if (!patient_id) throw new Error('Patient ID is strictly required to link audio recording');
  if (!blob) throw new Error('Audio data blob is missing');

  try {
    const db = await openAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        id,
        patient_id,
        encounter_id,
        blob,
        duration,
        language,
        recorded_by,
        recorded_by_role,
        created_at: Date.now(),
        size_bytes: blob.size,
        mime_type: blob.type || 'audio/webm',
      };

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = () => {
        if (putReq.error?.name === 'QuotaExceededError') {
          reject(new Error('Device offline storage quota exceeded. Please free up space or export old recordings.'));
        } else {
          reject(putReq.error);
        }
      };
    });
  } catch (err) {
    console.error('Failed to save audio recording:', err);
    throw err;
  }
}

/**
 * Retrieves all saved audio recordings for a specific patient.
 * @param {string} patient_id
 */
export async function getAudioRecordingsByPatient(patient_id) {
  try {
    const db = await openAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('patient_id');
      const req = index.getAll(patient_id);

      req.onsuccess = () => {
        // Return sorted by most recent
        const records = (req.result || []).sort((a, b) => b.created_at - a.created_at);
        resolve(records);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to fetch audio recordings:', err);
    return [];
  }
}

/**
 * Retrieves a single recording by its ID.
 */
export async function getAudioRecordingById(id) {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a recording by its ID.
 */
export async function deleteAudioRecording(id) {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

