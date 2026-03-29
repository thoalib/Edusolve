import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api.js';
import { CreatableSelect } from '../../../components/ui/CreatableSelect.jsx';
import { PhoneInput, isValidEmail } from '../../../components/PhoneInput.jsx';

export function AddLeadModal({ onClose, onSuccess }) {
    const [studentName, setStudentName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [classLevel, setClassLevel] = useState('');
    const [subject, setSubject] = useState('');
    const [leadType, setLeadType] = useState('');
    const [email, setEmail] = useState('');
    const [country, setCountry] = useState('India');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [leadTypes, setLeadTypes] = useState([]);
    const [subjects, setSubjects] = useState([]);

    async function fetchLeadTypes() {
        const res = await apiFetch('/leads/types');
        if (res.ok) setLeadTypes(res.types || []);
    }

    async function handleAddType(name) {
        const res = await apiFetch('/leads/types', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            setLeadTypes(prev => [...prev, name].sort());
        } else {
            console.error('Failed to save lead type:', res.error);
        }
    }

    async function handleDeleteType(name) {
        if (!window.confirm(`Are you sure you want to delete the lead type "${name}"? Leads having this type will be updated to have no type.`)) {
            return;
        }
        const res = await apiFetch('/leads/types', {
            method: 'DELETE',
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            setLeadTypes(prev => prev.filter(t => t !== name));
            if (leadType === name) {
                setLeadType('');
            }
        } else {
            alert(res.error || 'Failed to delete lead type');
        }
    }

    async function fetchSubjects() {
        const res = await apiFetch('/subjects');
        if (res.ok) setSubjects(res.subjects ? res.subjects.map(s => s.name).sort() : []);
    }

    async function handleAddSubject(name) {
        const res = await apiFetch('/subjects', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            setSubjects(prev => [...prev, name].sort());
        } else {
            console.error('Failed to save subject:', res.error);
        }
    }

    useEffect(() => {
        fetchLeadTypes();
        fetchSubjects();
    }, []);

    async function onSubmit(e) {
        e.preventDefault();
        setError('');
        setSaving(true);

        const safeStudentName = studentName.trim();
        const safeContact = contactNumber.trim();
        const safeEmail = email.trim();

        if (safeEmail && !isValidEmail(safeEmail)) {
            setError("Please enter a valid email address");
            setSaving(false);
            return;
        }

        try {
            await apiFetch('/leads', {
                method: 'POST',
                body: JSON.stringify({
                    student_name: safeStudentName,
                    contact_number: safeContact,
                    class_level: classLevel,
                    subject,
                    lead_type: leadType,
                    email: safeEmail,
                    country: country
                })
            });
            onSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal card">
                <h3>Add New Lead</h3>
                <form className="form-grid" onSubmit={onSubmit}>
                    <label>
                        Student Name
                        <input value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
                    </label>
                    <label>
                        Contact
                        <PhoneInput value={contactNumber} onChange={setContactNumber} required={true} />
                    </label>
                    <label>
                        Class
                        <input value={classLevel} onChange={(e) => setClassLevel(e.target.value)} />
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <CreatableSelect
                            label="Subject"
                            value={subject}
                            onChange={setSubject}
                            options={subjects}
                            placeholder="Select or Add New"
                            onAdd={handleAddSubject}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <CreatableSelect
                            label="Lead Type"
                            value={leadType}
                            onChange={setLeadType}
                            options={leadTypes}
                            placeholder="Select or Add New"
                            onAdd={handleAddType}
                            onDelete={handleDeleteType}
                        />
                    </div>
                    <label>
                        Email (Optional)
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>
                    <label>
                        Country
                        <select value={country} onChange={(e) => setCountry(e.target.value)} required>
                            <option value="India">India</option>
                            <option value="United Arab Emirates">United Arab Emirates</option>
                            <option value="Saudi Arabia">Saudi Arabia</option>
                            <option value="Qatar">Qatar</option>
                            <option value="Oman">Oman</option>
                            <option value="Kuwait">Kuwait</option>
                            <option value="Bahrain">Bahrain</option>
                            <option value="United States">United States</option>
                            <option value="United Kingdom">United Kingdom</option>
                            <option value="Australia">Australia</option>
                            <option value="Singapore">Singapore</option>
                            <option value="Malaysia">Malaysia</option>
                            <option value="Other">Other</option>
                        </select>
                    </label>

                    {error ? <p className="error">{error}</p> : null}

                    <div className="actions">
                        <button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
                        <button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Lead'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
