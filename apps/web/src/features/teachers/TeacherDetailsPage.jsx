import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '../../lib/api.js';
import { PhoneInput } from '../../components/PhoneInput.jsx';
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown.jsx';

/* ─── Icons ─── */
const Icon = ({ d, size = 16, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const ICONS = {
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  mail: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  briefcase: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M17 11l2 2 4-4',
  calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18',
  clock: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2',
  users: 'M17 21v-2a4 4 0 0 0-3-3.87 M7 21v-2a4 4 0 0 1 3-3.87 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M15 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  chevronLeft: 'M15 18l-6-6 6-6',
  check: 'M20 6L9 17l-5-5'
};

const TAB_OPTIONS = [
  { id: 'profile', label: 'Profile', icon: ICONS.user },
  { id: 'sessions', label: 'Session Logs', icon: ICONS.clock },
  { id: 'availability', label: 'Availability', icon: ICONS.calendar },
  { id: 'students', label: 'Students', icon: ICONS.users }
];

export function TeacherDetailsPage({ teacherProfileId, actorRole, initialTab = 'profile' }) {
  const [teacher, setTeacher] = useState(null);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [allSubjects, setAllSubjects] = useState([]);
  const [allBoards, setAllBoards] = useState([]);
  const [allMediums, setAllMediums] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [allExperienceCategories, setAllExperienceCategories] = useState([]);

  useEffect(() => {
    if (!teacherProfileId) return;
    loadTeacherData();
    // Load master data for dropdowns
    apiFetch('/subjects').then(r => r.ok && setAllSubjects(r.subjects.map(s => s.name))).catch(() => {});
    apiFetch('/boards').then(r => r.ok && setAllBoards(r.boards.map(b => b.name))).catch(() => {});
    apiFetch('/mediums').then(r => r.ok && setAllMediums(r.mediums.map(m => m.name))).catch(() => {});
    apiFetch('/classes').then(r => r.ok && setAllClasses(r.classes.map(c => c.name))).catch(() => {});
    apiFetch('/experience-categories').then(r => r.ok && setAllExperienceCategories(r.categories.map(c => c.name))).catch(() => {});
  }, [teacherProfileId]);

  async function loadTeacherData() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/teachers/${teacherProfileId}`);
      if (!data.ok) throw new Error(data.error || 'Failed to fetch teacher profile');
      setTeacher(data.teacher);
      setFormData({
        full_name: data.teacher.users?.full_name || '',
        phone: data.teacher.users?.phone || '',
        experience_level: data.teacher.experience_level || '',
        experience_remark: data.teacher.experience_remark || '',
        experience_duration: data.teacher.experience_duration || '',
        qualification: data.teacher.qualification || '',
        address: data.teacher.address || '',
        city: data.teacher.city || '',
        place: data.teacher.place || '',
        pincode: data.teacher.pincode || '',
        gender: data.teacher.gender || '',
        dob: data.teacher.dob || '',
        meeting_link: data.teacher.meeting_link || '',
        subjects_taught: data.teacher.subjects_taught || [],
        syllabus: data.teacher.syllabus || [],
        languages: data.teacher.languages || [],
        classes_taught: data.teacher.classes_taught || [],
        per_hour_rate: data.teacher.per_hour_rate || '',
        account_holder_name: data.teacher.account_holder_name || '',
        account_number: data.teacher.account_number || '',
        ifsc_code: data.teacher.ifsc_code || '',
        upi_id: data.teacher.upi_id || '',
        gpay_holder_name: data.teacher.gpay_holder_name || '',
        gpay_number: data.teacher.gpay_number || ''
      });

      // Load session logs via teacher-specific endpoint (avoids role restrictions on /sessions/all)
      if (data.teacher.user_id) {
        const logsData = await apiFetch(`/teachers/${teacherProfileId}/sessions`).catch(() => ({ ok: false }));
        if (logsData.ok) setSessionLogs(logsData.items || []);
        
        // Also load students for this teacher
        const studentsData = await apiFetch(`/teachers/${teacherProfileId}/students`).catch(() => ({ ok: false }));
        if (studentsData.ok) setStudents(studentsData.items || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    try {
        const res = await apiFetch(`/teachers/${teacherProfileId}`, {
            method: 'PATCH',
            body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error(res.error || 'Failed to update profile');
        setTeacher(res.teacher);
        setIsEditing(false);
        alert('Profile updated successfully');
    } catch (err) {
        setError(err.message);
    } finally {
        setSaving(false);
    }
  }

  if (!teacherProfileId) {
    return <section className="panel"><p className="muted">Invalid teacher ID.</p></section>;
  }

  if (loading && !teacher) {
    return <section className="panel"><p className="muted">Loading teacher details...</p></section>;
  }

  const updateField = (field, val) => setFormData(p => ({ ...p, [field]: val }));

  return (
    <section className="panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={() => window.history.back()} 
          className="secondary small" 
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon d={ICONS.chevronLeft} size={14} /> Back to Directory
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
            {activeTab === 'profile' && !isEditing && (
                <button className="primary small" onClick={() => setIsEditing(true)}>
                    <Icon d={ICONS.edit} size={14} style={{ marginRight: '4px' }} /> Edit Profile
                </button>
            )}
            {isEditing && (
                <>
                    <button className="secondary small" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</button>
                    <button className="primary small" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </>
            )}
        </div>
      </div>

      {error ? <p className="error" style={{ marginBottom: '16px' }}>{error}</p> : null}

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #9333ea)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '28px', fontWeight: 700 
        }}>
          {teacher.users?.full_name?.charAt(0) || 'T'}
        </div>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
            {teacher.users?.full_name || 'N/A'}
          </h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '14px', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon d={ICONS.briefcase} size={14} /> {teacher.teacher_code || 'No Code'}
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon d={ICONS.mail} size={14} /> {teacher.users?.email || 'No Email'}
            </span>
          </div>
        </div>
      </div>

      <div className="tabs-row" style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        {TAB_OPTIONS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.id); setIsEditing(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px' }}
          >
            <Icon d={tab.icon} size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content" style={{ animation: 'fadeIn 0.2s ease-out' }}>
        {activeTab === 'profile' && (
          <form className="card" onSubmit={handleSave} style={{ border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div className="form-grid grid-2">
              <div className="section" style={{ gridColumn: '1 / -1', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Personal Information</h4>
              </div>
              
              <label>
                Full Name
                <input 
                  value={formData.full_name} 
                  onChange={e => updateField('full_name', e.target.value)} 
                  disabled={!isEditing} 
                  required
                />
              </label>

              <label>
                Phone Number
                {!isEditing ? (
                  <input value={teacher.users?.phone || ''} disabled />
                ) : (
                  <PhoneInput value={formData.phone} onChange={v => updateField('phone', v)} />
                )}
              </label>

              <label>
                Gender
                <select value={formData.gender} onChange={e => updateField('gender', e.target.value)} disabled={!isEditing}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label>
                Date of Birth
                <input type="date" value={formData.dob} onChange={e => updateField('dob', e.target.value)} disabled={!isEditing} />
              </label>

              <div className="section" style={{ gridColumn: '1 / -1', marginTop: '16px', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Professional Details</h4>
              </div>

              <label>
                Main Qualification
                <input value={formData.qualification} onChange={e => updateField('qualification', e.target.value)} disabled={!isEditing} />
              </label>

              <label>
                Experience Remark
                <select value={formData.experience_remark} onChange={e => updateField('experience_remark', e.target.value)} disabled={!isEditing}>
                  <option value="">Select Level</option>
                  <option value="Fresher">Fresher</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Experienced">Experienced</option>
                </select>
              </label>

              <label>
                Experience Duration
                <input placeholder="e.g. 2 years" value={formData.experience_duration} onChange={e => updateField('experience_duration', e.target.value)} disabled={!isEditing} />
              </label>

              <label style={{ gridColumn: '1 / -1' }}>
                Meeting Link
                <input placeholder="G-Meet or Zoom Link" value={formData.meeting_link} onChange={e => updateField('meeting_link', e.target.value)} disabled={!isEditing} />
              </label>

              <div className="section" style={{ gridColumn: '1 / -1', marginTop: '16px', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Teaching Info</h4>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Experience Level (Internal)</label>
                  {isEditing ? (
                    <select value={formData.experience_level} onChange={e => updateField('experience_level', e.target.value)}>
                      <option value="">Select level</option>
                      {allExperienceCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input value={formData.experience_level || '—'} disabled />
                  )}
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Subjects</label>
                  {isEditing ? (
                    <MultiSelectDropdown
                      value={formData.subjects_taught}
                      onChange={v => updateField('subjects_taught', v)}
                      options={allSubjects}
                      placeholder="Select subjects..."
                    />
                  ) : (
                    <input value={(formData.subjects_taught || []).join(', ') || '—'} disabled />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Languages (Medium)</label>
                  {isEditing ? (
                    <MultiSelectDropdown
                      value={formData.languages}
                      onChange={v => updateField('languages', v)}
                      options={allMediums}
                      placeholder="Select languages..."
                    />
                  ) : (
                    <input value={(formData.languages || []).join(', ') || '—'} disabled />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Syllabus (Board)</label>
                  {isEditing ? (
                    <MultiSelectDropdown
                      value={formData.syllabus}
                      onChange={v => updateField('syllabus', v)}
                      options={allBoards}
                      placeholder="Select boards..."
                    />
                  ) : (
                    <input value={(formData.syllabus || []).join(', ') || '—'} disabled />
                  )}
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px', display: 'block' }}>Classes Taking</label>
                {isEditing ? (
                  <MultiSelectDropdown
                    value={formData.classes_taught}
                    onChange={v => updateField('classes_taught', v)}
                    options={allClasses}
                    placeholder="Select classes..."
                  />
                ) : (
                  <input value={(formData.classes_taught || []).join(', ') || '—'} disabled style={{ width: '100%' }} />
                )}
              </div>

              <div className="section" style={{ gridColumn: '1 / -1', marginTop: '16px', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Address & Location</h4>
              </div>

              <label style={{ gridColumn: '1 / -1' }}>
                Full Address
                <textarea 
                  value={formData.address} 
                  onChange={e => updateField('address', e.target.value)} 
                  disabled={!isEditing}
                  style={{ minHeight: '60px' }}
                />
              </label>

              <label>
                City
                <input value={formData.city} onChange={e => updateField('city', e.target.value)} disabled={!isEditing} />
              </label>

              <label>
                Place / Locality
                <input value={formData.place} onChange={e => updateField('place', e.target.value)} disabled={!isEditing} />
              </label>

              <label>
                Pincode
                <input value={formData.pincode} onChange={e => updateField('pincode', e.target.value)} disabled={!isEditing} />
              </label>

              <div className="section" style={{ gridColumn: '1 / -1', marginTop: '16px', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Bank &amp; Payment Details</h4>
              </div>

              <label>
                Account Holder Name
                <input value={formData.account_holder_name} onChange={e => updateField('account_holder_name', e.target.value)} disabled={!isEditing} />
              </label>

              <label>
                Account Number
                <input value={formData.account_number} onChange={e => updateField('account_number', e.target.value)} disabled={!isEditing} />
              </label>

              <label>
                IFSC Code
                <input value={formData.ifsc_code} onChange={e => updateField('ifsc_code', e.target.value)} disabled={!isEditing} />
              </label>

              <label>
                UPI ID
                <input value={formData.upi_id} onChange={e => updateField('upi_id', e.target.value)} disabled={!isEditing} />
              </label>

              <label>
                GPay Holder Name
                <input value={formData.gpay_holder_name} onChange={e => updateField('gpay_holder_name', e.target.value)} disabled={!isEditing} />
              </label>

              <label>
                GPay Number
                <input value={formData.gpay_number} onChange={e => updateField('gpay_number', e.target.value)} disabled={!isEditing} />
              </label>
            </div>
          </form>
        )}

        {activeTab === 'sessions' && (
          <div className="card" style={{ border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '16px' }}>Session History</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Student</th>
                    <th>Subject</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{log.session_date}</td>
                      <td>{log.started_at ? new Date(log.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td>{log.students?.student_name || 'N/A'}</td>
                      <td>{log.subject || '-'}</td>
                      <td>{log.duration_hours} hr</td>
                      <td><span className={`status-badge ${log.verification_status === 'approved' ? 'green' : 'orange'}`}>{log.verification_status || log.status}</span></td>
                    </tr>
                  ))}
                  {sessionLogs.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>No sessions found for this teacher.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'availability' && (
          <div className="card" style={{ border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '16px' }}>Preferred Availability</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Day of Week</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(teacher.teacher_availability || []).map((slot, i) => (
                    <tr key={i}>
                      <td><strong>{slot.day_of_week}</strong></td>
                      <td>{slot.start_time.slice(0, 5)}</td>
                      <td>{slot.end_time.slice(0, 5)}</td>
                    </tr>
                  ))}
                  {(teacher.teacher_availability || []).length === 0 && (
                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>No availability slots set.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="card" style={{ border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '16px' }}>Assigned Students</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student Code</th>
                    <th>Student Name</th>
                    <th>Subject</th>
                    <th>Class</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id}>
                        <td>{s.student_code}</td>
                        <td style={{ fontWeight: 600, color: '#2563eb' }}>{s.student_name}</td>
                        <td>{s.subject}</td>
                        <td>{s.class_level}</td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>No students currently assigned to this teacher.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
