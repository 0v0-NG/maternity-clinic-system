'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Baby, Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { motherAPI, babyAPI } from '../../lib/api';

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: '', phone: '', hospital_id: '', hmo_number: '' });
  const [babies, setBabies] = useState([]);
  const [showAddBaby, setShowAddBaby] = useState(false);
  const [newBaby, setNewBaby] = useState({ name: '', date_of_birth: '', sex: 'female' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await motherAPI.getProfile();
      setProfile({
        name: data.data.name || '',
        phone: data.data.phone || '',
        hospital_id: data.data.hospital_id || '',
        hmo_number: data.data.hmo_number || '',
      });
      setBabies(data.data.babies || []);
    } catch (err) {
      toast.error('Failed to load profile. Please log in.');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await motherAPI.updateProfile({
        name: profile.name,
        hospital_id: profile.hospital_id,
        hmo_number: profile.hmo_number,
      });
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBaby = async (e) => {
    e.preventDefault();
    try {
      const { data } = await babyAPI.add(newBaby);
      setBabies([...babies, data.data]);
      setNewBaby({ name: '', date_of_birth: '', sex: 'female' });
      setShowAddBaby(false);
      toast.success('Baby profile added!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add baby.');
    }
  };

  const handleDeleteBaby = async (id) => {
    if (!confirm('Are you sure you want to remove this baby profile?')) return;
    try {
      await babyAPI.remove(id);
      setBabies(babies.filter((b) => b.id !== id));
      toast.success('Baby profile removed.');
    } catch (err) {
      toast.error('Failed to remove baby.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">My Profile & Babies</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Mother Details */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-primary-600" size={20} />
            <h2 className="text-lg font-bold">Mother's Information</h2>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Full Name</label>
              <input
                type="text"
                className="input-field"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Phone Number (Verified)</label>
              <input type="text" className="input-field bg-gray-100" value={profile.phone} disabled />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Hospital ID (Folder No.)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. HOSP-12345"
                  value={profile.hospital_id}
                  onChange={(e) => setProfile({ ...profile, hospital_id: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">NHIA / HMO Number</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Optional"
                  value={profile.hmo_number}
                  onChange={(e) => setProfile({ ...profile, hmo_number: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
              <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Baby Profiles */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Baby className="text-primary-600" size={20} />
              <h2 className="text-lg font-bold">Baby Profiles ({babies.length})</h2>
            </div>
            <button
              onClick={() => setShowAddBaby(!showAddBaby)}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <Plus size={16} /> Add Baby
            </button>
          </div>

          {showAddBaby && (
            <form onSubmit={handleAddBaby} className="bg-primary-50 p-4 rounded-lg mb-4 space-y-3 border border-primary-200">
              <h3 className="font-semibold text-primary-900 text-sm">New Baby Details</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Baby's Name</label>
                <input
                  type="text"
                  className="input-field bg-white"
                  placeholder="e.g. Baby John"
                  value={newBaby.name}
                  onChange={(e) => setNewBaby({ ...newBaby, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    className="input-field bg-white"
                    value={newBaby.date_of_birth}
                    onChange={(e) => setNewBaby({ ...newBaby, date_of_birth: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sex</label>
                  <select
                    className="input-field bg-white"
                    value={newBaby.sex}
                    onChange={(e) => setNewBaby({ ...newBaby, sex: e.target.value })}
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-sm !py-2 flex-1">
                  Save Baby
                </button>
                <button type="button" onClick={() => setShowAddBaby(false)} className="btn-secondary text-sm !py-2">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {babies.length === 0 ? (
            <p className="text-sm text-gray-500 py-3 text-center">No baby profiles added yet. Click &quot;Add Baby&quot; to link your child for postnatal appointments.</p>
          ) : (
            <div className="divide-y">
              {babies.map((baby) => (
                <div key={baby.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{baby.name}</p>
                    <p className="text-xs text-gray-500">
                      DOB: {baby.date_of_birth} · <span className="capitalize">{baby.sex}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteBaby(baby.id)}
                    className="text-gray-400 hover:text-red-500 p-2"
                    title="Remove Baby"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
