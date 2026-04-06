import React, { useState } from 'react';
import { apiFetch } from '../../lib/api.js';

export function BulkImportModal({ type, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successCount, setSuccessCount] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  const isStudent = type === 'student';
  
  const headers = isStudent 
    ? ['Student Name', 'Parent Name', 'Phone', 'Class', 'Subject', 'Lead Type', 'Email', 'Country']
    : ['Full Name', 'Email', 'Phone', 'Qualification', 'Subjects', 'Boards', 'Mediums', 'Experience Remark', 'Experience Level', 'Experience Duration', 'Place', 'City', 'Notes'];

  const sampleData = isStudent
    ? [['John Doe', 'Jane Doe', '+911234567890', '10th', 'Math', 'Organic', 'john@example.com', 'USA']]
    : [['Alice Smith', 'alice@example.com', '+919876543210', 'M.Sc Math', 'Math, Science', 'CBSE, ICSE', 'English', 'Experienced', 'Advanced', '5 years', 'Springfield', 'Springfield', 'Interested in evening batches']];

  function downloadSample() {
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', isStudent ? 'student_leads_sample.csv' : 'teacher_leads_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) throw new Error('CSV is empty or missing data rows.');

    const rows = lines.map(line => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });

    const bodyRows = rows.slice(1);
    return bodyRows.map(row => {
      const obj = {};
      headers.forEach((h, idx) => {
        let val = row[idx] || null;
        const key = h.toLowerCase().replace(/ /g, '_');
        
        let mappedKey = key;
        if (isStudent) {
            if (key === 'student_name') mappedKey = 'student_name';
            if (key === 'parent_name') mappedKey = 'parent_name';
            if (key === 'phone') mappedKey = 'contact_number';
            if (key === 'class') mappedKey = 'class_level';
        } else {
            if (key === 'full_name') mappedKey = 'full_name';
            if (['subjects', 'boards', 'mediums'].includes(key)) {
                val = val ? val.split(',').map(s => s.trim()) : [];
            }
        }
        
        obj[mappedKey] = val;
        obj._original = row; // Keep original for display
      });
      return obj;
    });
  }

  function handleFileSelect(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const data = parseCSV(text);
        setPreviewData(data);
      } catch (err) {
        setError(err.message);
        setFile(null);
      }
    };
    reader.readAsText(selectedFile);
  }

  async function confirmImport() {
    setLoading(true);
    setError('');
    try {
      const endpoint = isStudent ? '/leads/bulk' : '/teacher-leads/bulk';
      // Remove display helpers before sending
      const cleanData = previewData.map(({ _original, ...rest }) => rest);
      
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(cleanData)
      });

      if (res.ok) {
        setSuccessCount(res.count);
        setTimeout(() => onDone(), 1500);
      } else {
        setError(res.error || 'Import failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: previewData ? '900px' : '500px', width: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>
            {successCount !== null ? 'Import Complete' : previewData ? 'Preview Leads' : `Bulk Import ${isStudent ? 'Student Leads' : 'Teacher Leads'}`}
          </h3>
          <button onClick={onClose} className="close-btn" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        {successCount !== null ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '64px', color: '#10b981', marginBottom: '16px' }}>✓</div>
            <h4 style={{ margin: '0 0 8px', fontSize: '24px' }}>Success!</h4>
            <p style={{ color: '#6b7280', margin: 0 }}>Successfully imported {successCount} leads.</p>
          </div>
        ) : previewData ? (
          <div>
            <p style={{ marginBottom: '12px', fontSize: '14px', color: '#4b5563' }}>
              Found <strong>{previewData.length}</strong> leads in the file. Please review them below before confirming.
            </p>
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    {headers.map(h => <th key={h} style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      {row._original.map((cell, j) => (
                        <td key={j} style={{ padding: '8px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setPreviewData(null)} className="secondary" disabled={loading}>Back / Re-upload</button>
              <button type="button" onClick={confirmImport} className="primary" disabled={loading}>
                {loading ? 'Importing...' : `Confirm Import (${previewData.length} leads)`}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#4b5563' }}>
                Please use the sample CSV format to ensure your data is imported correctly.
              </p>
              <button 
                type="button" 
                onClick={downloadSample}
                className="secondary" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>📥</span> Download Sample CSV
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
                Select CSV File
              </label>
              <input 
                type="file" 
                accept=".csv"
                onChange={handleFileSelect}
                style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} className="secondary">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
