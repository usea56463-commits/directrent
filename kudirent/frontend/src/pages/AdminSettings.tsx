import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminSettings = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newSetting, setNewSetting] = useState({ key: '', value: '', description: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (setting) => {
    setEditing(setting.key);
    setEditValue(setting.value);
  };

  const handleSave = async (key) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/admin/settings/${key}`, { value: editValue }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditing(null);
      fetchSettings(); // Refresh settings
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  const handleAdd = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/admin/settings', newSetting, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewSetting({ key: '', value: '', description: '' });
      fetchSettings();
    } catch (error) {
      console.error('Error adding setting:', error);
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="admin-settings">
      <h2>Platform Settings Management</h2>
      <p>All API keys and platform configurations are managed here.</p>

      {/* Add New Setting */}
      <div className="add-setting">
        <h3>Add New Setting</h3>
        <input
          type="text"
          placeholder="Setting Key"
          value={newSetting.key}
          onChange={(e) => setNewSetting({...newSetting, key: e.target.value})}
        />
        <input
          type="text"
          placeholder="Value"
          value={newSetting.value}
          onChange={(e) => setNewSetting({...newSetting, value: e.target.value})}
        />
        <input
          type="text"
          placeholder="Description"
          value={newSetting.description}
          onChange={(e) => setNewSetting({...newSetting, description: e.target.value})}
        />
        <button onClick={handleAdd}>Add Setting</button>
      </div>

      {/* Settings List */}
      <div className="settings-list">
        <h3>Current Settings</h3>
        {settings.map((setting) => (
          <div key={setting.key} className="setting-item">
            <div className="setting-info">
              <strong>{setting.key}</strong>
              <p>{setting.description}</p>
            </div>
            <div className="setting-value">
              {editing === setting.key ? (
                <div>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                  <button onClick={() => handleSave(setting.key)}>Save</button>
                  <button onClick={() => setEditing(null)}>Cancel</button>
                </div>
              ) : (
                <div>
                  <span>{setting.value || '(empty)'}</span>
                  <button onClick={() => handleEdit(setting)}>Edit</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .admin-settings {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .add-setting, .settings-list {
          margin-bottom: 30px;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
        }
        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }
        .setting-info {
          flex: 1;
        }
        .setting-value {
          flex: 1;
          text-align: right;
        }
        input {
          padding: 8px;
          margin: 5px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        button {
          padding: 8px 16px;
          margin: 5px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background: #0056b3;
        }
      `}</style>
    </div>
  );
};

export default AdminSettings;