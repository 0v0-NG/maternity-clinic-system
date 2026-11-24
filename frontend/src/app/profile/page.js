'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Baby,
  Plus,
  Pencil,
  Trash2,
  Building2,
  ChevronRight,
  LogOut,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motherAPI, babyAPI, clearAuthStorage } from '../../lib/api';
import { getErrorMessage } from '../../lib/errorMessages';
import { formatDate, getLagosToday } from '../../lib/dateTime';
import EmergencyNotice from '../../components/clinic/EmergencyNotice';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import MotherBottomNav from '../../components/clinic/MotherBottomNav';

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    hospital_id: '',
    hmo_number: '',
  });
  const [babies, setBabies] = useState([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Add baby mini form state
  const [showAddBaby, setShowAddBaby] = useState(false);
  const [newBabyName, setNewBabyName] = useState('');
  const [newBabyDob, setNewBabyDob] = useState('');
  const [newBabySex, setNewBabySex] = useState('female');
  const [isAddingBaby, setIsAddingBaby] = useState(false);
  const [addBabyError, setAddBabyError] = useState('');

  // Edit baby state
  const [editingBabyId, setEditingBabyId] = useState(null);
  const [editBabyName, setEditBabyName] = useState('');
  const [editBabyDob, setEditBabyDob] = useState('');
  const [editBabySex, setEditBabySex] = useState('female');
  const [isEditingBaby, setIsEditingBaby] = useState(false);
  const [editBabyError, setEditBabyError] = useState('');

  // Delete baby confirmation state
  const [babyToDelete, setBabyToDelete] = useState(null);
  const [isDeletingBaby, setIsDeletingBaby] = useState(false);

  const todayStr = getLagosToday();

  // Access Control: mother only
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored || stored === 'undefined' || stored === 'null') {
      router.push('/login');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (parsed.role === 'admin') {
        router.push('/admin');
        return;
      }
      if (['front_desk', 'midwife', 'doctor'].includes(parsed.role)) {
        router.push('/staff');
        return;
      }
      if (parsed.role !== 'mother') {
        router.push('/login');
        return;
      }
    } catch {
      router.push('/login');
      return;
    }

    loadProfileData();
  }, [router]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const res = await motherAPI.getProfile();
      const data = res?.data?.data;
      if (data) {
        setProfile({
          name: data.name || '',
          phone: data.phone || '',
          hospital_id: data.hospital_id || '',
          hmo_number: data.hmo_number || '',
        });
        setBabies(data.babies || []);
      }
    } catch (err) {
      toast.error('Failed to load profile. Please log in again.');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  // 1. Update Mother Profile
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      toast.error('Please enter your full name.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const payload = {
        name: profile.name.trim(),
        hospital_id: profile.hospital_id.trim() || null,
        hmo_number: profile.hmo_number.trim() || null,
      };

      const res = await motherAPI.updateProfile(payload);
      const updated = res?.data?.data;
      if (updated) {
        setProfile((prev) => ({
          ...prev,
          name: updated.name,
          hospital_id: updated.hospital_id || '',
          hmo_number: updated.hmo_number || '',
        }));

        // Update local user name for greeting consistency
        try {
          const stored = localStorage.getItem('user');
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.name = updated.name;
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        } catch {}
      }
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 2. Add Baby Profile
  const handleSaveNewBaby = async (e) => {
    e.preventDefault();
    if (!newBabyName.trim()) {
      setAddBabyError("Please enter the baby's name.");
      return;
    }
    if (!newBabyDob) {
      setAddBabyError('Please select the date of birth.');
      return;
    }

    setIsAddingBaby(true);
    setAddBabyError('');
    try {
      const res = await babyAPI.add({
        name: newBabyName.trim(),
        date_of_birth: newBabyDob,
        sex: newBabySex,
      });
      const createdBaby = res?.data?.data;
      if (createdBaby) {
        setBabies((prev) => [createdBaby, ...prev]);
        toast.success('Baby profile added!');
      }
      // Reset form
      setNewBabyName('');
      setNewBabyDob('');
      setNewBabySex('female');
      setShowAddBaby(false);
    } catch (err) {
      setAddBabyError(getErrorMessage(err, 'Failed to add baby profile.'));
    } finally {
      setIsAddingBaby(false);
    }
  };

  // 3. Start Editing a Baby
  const handleStartEditBaby = (baby) => {
    setEditingBabyId(baby.id);
    setEditBabyName(baby.name);
    // Format YYYY-MM-DD
    setEditBabyDob(baby.date_of_birth ? baby.date_of_birth.substring(0, 10) : '');
    setEditBabySex(baby.sex || 'female');
    setEditBabyError('');
  };

  // 4. Save Edited Baby
  const handleSaveEditBaby = async (e) => {
    e.preventDefault();
    if (!editBabyName.trim()) {
      setEditBabyError("Please enter the baby's name.");
      return;
    }
    if (!editBabyDob) {
      setEditBabyError('Please select the date of birth.');
      return;
    }

    setIsEditingBaby(true);
    setEditBabyError('');
    try {
      const res = await babyAPI.update(editingBabyId, {
        name: editBabyName.trim(),
        date_of_birth: editBabyDob,
        sex: editBabySex,
      });
      const updated = res?.data?.data;
      if (updated) {
        setBabies((prev) =>
          prev.map((b) => (b.id === editingBabyId ? { ...b, ...updated } : b))
        );
        toast.success('Baby profile updated.');
      }
      setEditingBabyId(null);
    } catch (err) {
      setEditBabyError(getErrorMessage(err, 'Failed to update baby profile.'));
    } finally {
      setIsEditingBaby(false);
    }
  };

  // 5. Confirm Delete Baby Profile
  const handleConfirmDeleteBaby = async () => {
    if (!babyToDelete) return;

    setIsDeletingBaby(true);
    try {
      await babyAPI.remove(babyToDelete.id);
      setBabies((prev) => prev.filter((b) => b.id !== babyToDelete.id));
      toast.success('Baby profile removed.');
      setBabyToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete baby profile.'));
    } finally {
      setIsDeletingBaby(false);
    }
  };

  // 6. Logout
  const handleLogout = () => {
    clearAuthStorage();
    toast.success('Logged out successfully.');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-clinic-50 pb-24">
      {/* Top Emergency Notice */}
      <EmergencyNotice />

      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              aria-label="Back to dashboard"
              className="text-body-muted hover:text-body p-1 -ml-1 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-base font-bold text-body">My Profile</h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            className="text-body-muted hover:text-status-emergency p-1.5 rounded-lg transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-5 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton height={200} className="w-full rounded-xl" />
            <Skeleton height={200} className="w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* ------------------------------------------------------------- */}
            {/* SECTION 1: Mother Details Form                                 */}
            {/* ------------------------------------------------------------- */}
            <Card className="p-5 space-y-4 shadow-sm border-primary-200">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <User size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-clinic-dark">
                    Mother's Information
                  </h2>
                  <p className="text-[11px] text-body-muted">
                    Update your hospital folder details
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-3.5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-body mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                    placeholder="e.g. Amina Bello"
                    className="w-full text-xs px-3.5 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>

                {/* Phone Number (Read Only) */}
                <div>
                  <label className="block text-xs font-semibold text-body mb-1">
                    Phone Number (Verified)
                  </label>
                  <input
                    type="text"
                    value={profile.phone}
                    disabled
                    aria-readonly="true"
                    className="w-full text-xs px-3.5 py-2.5 border border-border rounded-xl bg-clinic-50 text-body-muted cursor-not-allowed"
                  />
                  <span className="text-[10px] text-body-muted mt-1 block">
                    Your registered mobile number is verified for login and SMS reminders.
                  </span>
                </div>

                {/* Hospital ID & HMO/NHIA Number */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-body mb-1">
                      Hospital ID
                    </label>
                    <input
                      type="text"
                      value={profile.hospital_id}
                      onChange={(e) =>
                        setProfile({ ...profile, hospital_id: e.target.value })
                      }
                      placeholder="Folder No. (e.g. HOSP-1234)"
                      className="w-full text-xs px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-body mb-1">
                      HMO / NHIA No.
                    </label>
                    <input
                      type="text"
                      value={profile.hmo_number}
                      onChange={(e) =>
                        setProfile({ ...profile, hmo_number: e.target.value })
                      }
                      placeholder="Optional"
                      className="w-full text-xs px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    />
                  </div>
                </div>

                {/* Save Profile Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSavingProfile}
                    className="w-full text-sm font-semibold"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </form>
            </Card>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 2: Babies Management                                   */}
            {/* ------------------------------------------------------------- */}
            <Card className="p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-clinic-100 text-clinic-700 flex items-center justify-center flex-shrink-0">
                    <Baby size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-clinic-dark">
                      My Babies
                    </h2>
                    <span className="text-[11px] text-body-muted">
                      {babies.length} registered {babies.length === 1 ? 'child' : 'children'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Babies List */}
              {babies.length > 0 && (
                <div className="space-y-3">
                  {babies.map((baby) => {
                    const isEditing = editingBabyId === baby.id;

                    if (isEditing) {
                      return (
                        <div
                          key={baby.id}
                          className="bg-clinic-50 border border-primary-300 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-clinic-dark">
                              Edit Baby Details
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingBabyId(null)}
                              className="text-xs text-body-muted hover:text-body"
                            >
                              Cancel
                            </button>
                          </div>

                          {editBabyError && (
                            <div className="text-[11px] text-status-emergency bg-red-50 border border-red-200 rounded-lg p-2">
                              {editBabyError}
                            </div>
                          )}

                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-body-muted mb-0.5">
                                Baby's Name *
                              </label>
                              <input
                                type="text"
                                value={editBabyName}
                                onChange={(e) => setEditBabyName(e.target.value)}
                                className="w-full text-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                disabled={isEditingBaby}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-semibold text-body-muted mb-0.5">
                                  Date of Birth *
                                </label>
                                <input
                                  type="date"
                                  max={todayStr}
                                  value={editBabyDob}
                                  onChange={(e) => setEditBabyDob(e.target.value)}
                                  className="w-full text-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                  disabled={isEditingBaby}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-body-muted mb-0.5">
                                  Sex *
                                </label>
                                <select
                                  value={editBabySex}
                                  onChange={(e) => setEditBabySex(e.target.value)}
                                  className="w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  disabled={isEditingBaby}
                                >
                                  <option value="female">Female</option>
                                  <option value="male">Male</option>
                                </select>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                              <Button
                                type="button"
                                variant="primary"
                                onClick={handleSaveEditBaby}
                                disabled={isEditingBaby}
                                className="flex-1 h-10 text-xs"
                              >
                                {isEditingBaby ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingBabyId(null)}
                                disabled={isEditingBaby}
                                className="w-24 h-10 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={baby.id}
                        className="bg-white border border-border rounded-xl p-3.5 flex items-center justify-between hover:border-primary-200 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-clinic-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                            <Baby size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-body">{baby.name}</p>
                            <p className="text-[11px] text-body-muted">
                              DOB: {formatDate(baby.date_of_birth)} ·{' '}
                              <span className="capitalize">{baby.sex}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditBaby(baby)}
                            aria-label={`Edit ${baby.name}`}
                            className="p-1.5 text-body-muted hover:text-primary-600 rounded-lg hover:bg-clinic-50 transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setBabyToDelete(baby)}
                            aria-label={`Delete ${baby.name}`}
                            className="p-1.5 text-body-muted hover:text-status-emergency rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Baby Button (when form is closed) */}
              {!showAddBaby && (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddBaby(true);
                      setAddBabyError('');
                    }}
                    className="w-full text-xs gap-1.5 h-11"
                  >
                    <Plus size={15} /> Add another baby
                  </Button>
                </div>
              )}

              {/* Inline Mini Form for Adding Baby */}
              {showAddBaby && (
                <div className="bg-clinic-50 border border-primary-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-clinic-dark">
                      Add Baby Profile
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddBaby(false)}
                      className="text-xs text-body-muted hover:text-body"
                    >
                      Cancel
                    </button>
                  </div>

                  {addBabyError && (
                    <div className="text-[11px] text-status-emergency bg-red-50 border border-red-200 rounded-lg p-2">
                      {addBabyError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-body-muted mb-0.5">
                        Baby's Name *
                      </label>
                      <input
                        type="text"
                        value={newBabyName}
                        onChange={(e) => setNewBabyName(e.target.value)}
                        placeholder="e.g. Fatima Bello"
                        className="w-full text-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        disabled={isAddingBaby}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-body-muted mb-0.5">
                          Date of Birth *
                        </label>
                        <input
                          type="date"
                          max={todayStr}
                          value={newBabyDob}
                          onChange={(e) => setNewBabyDob(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                          disabled={isAddingBaby}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-body-muted mb-0.5">
                          Sex *
                        </label>
                        <select
                          value={newBabySex}
                          onChange={(e) => setNewBabySex(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          disabled={isAddingBaby}
                        >
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleSaveNewBaby}
                        disabled={isAddingBaby}
                        className="flex-1 h-10 text-xs"
                      >
                        {isAddingBaby ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddBaby(false)}
                        disabled={isAddingBaby}
                        className="w-24 h-10 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 3: Clinic Information Link                             */}
            {/* ------------------------------------------------------------- */}
            <Link href="/clinic-info" className="block">
              <Card className="p-4 flex items-center justify-between hover:border-primary-400 hover:shadow-sm transition-all bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-xs text-body block">
                      Hospital & Clinic Information
                    </span>
                    <span className="text-[11px] text-body-muted block">
                      Operating hours, location & emergency triage
                    </span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-body-muted" />
              </Card>
            </Link>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 4: Logout Button                                      */}
            {/* ------------------------------------------------------------- */}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                className="w-full text-status-emergency border-red-200 hover:bg-red-50 text-sm gap-2"
              >
                <LogOut size={16} /> Log Out
              </Button>
            </div>
          </>
        )}
      </main>

      {/* Delete Baby Confirmation Modal */}
      {babyToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-status-emergency flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 id="delete-dialog-title" className="text-base font-bold text-body">
                  Delete Baby Profile?
                </h3>
                <p className="text-xs text-body-muted mt-0.5">
                  Removing {babyToDelete.name}
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-900 leading-relaxed space-y-1">
              <strong className="block font-semibold">Important Notice:</strong>
              Warning: This baby will be removed from your appointment history. Are you sure you want to delete this profile?
            </div>

            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBabyToDelete(null)}
                disabled={isDeletingBaby}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDeleteBaby}
                disabled={isDeletingBaby}
                className="flex-1 text-xs font-bold"
              >
                {isDeletingBaby ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <MotherBottomNav />
    </div>
  );
}
