import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api.js';
import { CreatableSelect } from '../../components/ui/CreatableSelect.jsx';

const overlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '500px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #ced4da' };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' };
const inputStyle = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' };
const btnPrimary = { padding: '8px 16px', background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' };
const btnSecondary = { padding: '8px 16px', background: 'transparent', border: '1px solid #d1d5db', color: '#374151', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' };

export function AdSetupPage() {
  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [keyword, setKeyword] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [leadType, setLeadType] = useState('');
  const [category, setCategory] = useState('');
  
  const [leadTypes, setLeadTypes] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [setupRes, typesRes] = await Promise.all([
        apiFetch('/ad-setups'),
        apiFetch('/leads/types')
      ]);

      if (setupRes.ok) setSetups(setupRes.items || []);
      else setError(setupRes.error || 'Failed to fetch setups');

      if (typesRes.ok) setLeadTypes(typesRes.types ? typesRes.types.sort() : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddType(name) {
    const res = await apiFetch('/leads/types', {
        method: 'POST',
        body: JSON.stringify({ name })
    });
    if (res.ok) {
        setLeadTypes(prev => [...prev, name].sort());
    } else {
        alert('Failed to save lead type: ' + res.error);
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

  function openAddModal() {
    setEditingId(null);
    setKeyword('');
    setCampaignName('');
    setLeadType('');
    setCategory('');
    setError(null);
    setIsModalOpen(true);
  }

  function openEditModal(setup) {
    setEditingId(setup.id);
    setKeyword(setup.keyword || '');
    setCampaignName(setup.campaign_name || '');
    setLeadType(setup.lead_type || '');
    setCategory(setup.category || '');
    setError(null);
    setIsModalOpen(true);
  }

  async function handleAdd(e) {
    e.preventDefault();

    if (!keyword || !leadType || !category) {
      setError('Keyword, Category, and Lead Type are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = { keyword, campaign_name: campaignName, lead_type: leadType, category };
      
      let res;
      if (editingId) {
        res = await apiFetch(`/ad-setups/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/ad-setups', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setIsModalOpen(false);
        await fetchData();
      } else {
        setError(res.error || `Failed to ${editingId ? 'update' : 'add'} setup`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this campaign setup?')) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/ad-setups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      } else {
        setError(res.error || 'Failed to delete setup');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="card filters-bar" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#10233f' }}>Campaign Setup</h2>
        <button
          onClick={openAddModal}
          className="primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Add Campaign
        </button>
      </div>
      
      {error && !isModalOpen && (
        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {isModalOpen && (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <h3 style={{ marginBottom: 16 }}>{editingId ? 'Edit Campaign Mapping' : 'New Campaign Mapping'}</h3>
                {error && (
                    <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, fontSize: '14px' }}>
                        {error}
                    </div>
                )}
                <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={labelStyle}>
                        Campaign Name
                        <input
                            type="text"
                            value={campaignName}
                            onChange={e => setCampaignName(e.target.value)}
                            style={inputStyle}
                            placeholder="e.g. Spring Ad"
                        />
                        </label>
                    </div>

                    <div>
                        <label style={labelStyle}>
                        Keyword (from N8N) *
                        <input
                            type="text"
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            style={inputStyle}
                            placeholder="e.g. fb_promo"
                            required
                        />
                        </label>
                    </div>

                    <div>
                        <label style={labelStyle}>
                        Category *
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            style={inputStyle}
                            required
                        >
                            <option value="">Select Category</option>
                            <option value="Student">Student</option>
                            <option value="Teacher">Teacher</option>
                        </select>
                        </label>
                    </div>

                    <div style={{ zIndex: 10 }}>
                        <CreatableSelect
                            label="Lead Type *"
                            value={leadType}
                            onChange={setLeadType}
                            options={leadTypes}
                            placeholder="Select or Add New"
                            onAdd={handleAddType}
                            onDelete={handleDeleteType}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', margin: '32px 0 0 0' }}>
                        <button type="button" onClick={() => setIsModalOpen(false)} style={btnSecondary}>
                        Cancel
                        </button>
                        <button type="submit" disabled={saving || !keyword || !category || !leadType} style={btnPrimary}>
                        {saving ? 'Saving...' : (editingId ? 'Update Campaign' : 'Save Campaign')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Keyword</th>
                <th>Category</th>
                <th>Assigned Lead Type</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && setups.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>Loading campaigns...</td>
                </tr>
              ) : setups.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
                    <p style={{ margin: 0 }}>No campaigns configured yet.</p>
                  </td>
                </tr>
              ) : (
                setups.map(setup => (
                  <tr key={setup.id}>
                    <td>{setup.campaign_name || '—'}</td>
                    <td style={{ fontWeight: 'bold' }}>
                      <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{setup.keyword}</span>
                    </td>
                    <td>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, background: '#f3f4f6', color: '#374151' }}>
                        {setup.category || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, background: '#eff6ff', color: '#1d4ed8' }}>
                        {setup.lead_type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => openEditModal(setup)}
                          className="secondary small"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(setup.id)}
                          className="secondary small"
                          style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
