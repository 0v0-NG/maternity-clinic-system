'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Search,
  User,
  Baby,
  Calendar,
  AlertCircle,
  ArrowLeft,
  CalendarPlus,
  ShieldCheck,
} from 'lucide-react';
import { motherAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errorMessages';
import { formatDate } from '../lib/dateTime';
import Card from './Card';
import Button from './Button';
import Skeleton from './Skeleton';

export default function MotherLookupModal({
  isOpen,
  onClose,
  onBookForMother,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Selected mother full details (via GET /api/mothers/:id)
  const [selectedMotherId, setSelectedMotherId] = useState(null);
  const [motherProfile, setMotherProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
      setHasSearched(false);
      setSearchError('');
      setSelectedMotherId(null);
      setMotherProfile(null);
      setIsLoadingProfile(false);
      setProfileError('');
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen || selectedMotherId) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      setHasSearched(false);
      setSearchError('');
      return;
    }

    setIsSearching(true);
    setSearchError('');

    const timer = setTimeout(async () => {
      try {
        const res = await motherAPI.search(trimmed);
        const data = res?.data?.data || [];
        setSearchResults(data);
        setHasSearched(true);
      } catch (err) {
        setSearchError(getErrorMessage(err, 'Failed to search for patients.'));
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, selectedMotherId]);

  // Fetch full mother profile via GET /api/mothers/:id
  const handleSelectMother = async (id) => {
    setSelectedMotherId(id);
    setIsLoadingProfile(true);
    setProfileError('');
    try {
      const res = await motherAPI.getById(id);
      setMotherProfile(res?.data?.data || null);
    } catch (err) {
      setProfileError(getErrorMessage(err, 'Failed to load mother profile.'));
    } finally {
      setIsLoadingProfile(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-clinic-50 border-b border-border px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
              🔍
            </div>
            <div>
              <h2 className="text-sm font-bold text-body">Look Up Patient Record</h2>
              <p className="text-[11px] text-body-muted">
                {selectedMotherId
                  ? 'Patient profile and registered babies (Read-Only)'
                  : 'Search hospital mother records by name or phone'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-body-muted hover:text-body p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-border transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {!selectedMotherId ? (
            /* Search View */
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-body">
                  Patient Search
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-body-muted"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by mother's name or phone number..."
                    className="w-full text-xs pl-9 pr-4 py-2.5 bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-body-muted">
                  Type at least 3 characters to search.
                </p>
              </div>

              {isSearching ? (
                <div className="space-y-2 py-2">
                  <Skeleton height={56} className="w-full rounded-xl" />
                  <Skeleton height={56} className="w-full rounded-xl" />
                </div>
              ) : searchError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-status-emergency flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{searchError}</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  <p className="text-[11px] font-semibold text-body-muted">
                    Matches ({searchResults.length}):
                  </p>
                  {searchResults.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMother(m.id)}
                      className="p-3 border border-border rounded-xl hover:border-primary-500 hover:bg-primary-50/40 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                          <User size={16} />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-body block">
                            {m.name}
                          </span>
                          <p className="text-[11px] text-body-muted">
                            Phone: <strong>{m.phone}</strong>
                            {m.hospital_id && ` · ID: ${m.hospital_id}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 border border-primary-200 px-2.5 py-1 rounded-lg">
                        {m.babies?.length || 0}{' '}
                        {m.babies?.length === 1 ? 'baby' : 'babies'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : hasSearched && searchQuery.trim().length >= 3 ? (
                <Card className="p-6 text-center text-xs text-body-muted">
                  No patient found matching &ldquo;{searchQuery}&rdquo;.
                </Card>
              ) : null}
            </div>
          ) : (
            /* Profile Detail View */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedMotherId(null);
                  setMotherProfile(null);
                }}
                className="text-xs text-primary-700 font-bold hover:underline flex items-center gap-1"
              >
                <ArrowLeft size={13} /> Back to search results
              </button>

              {isLoadingProfile ? (
                <div className="space-y-3">
                  <Skeleton height={80} className="w-full rounded-xl" />
                  <Skeleton height={120} className="w-full rounded-xl" />
                </div>
              ) : profileError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-status-emergency flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{profileError}</span>
                </div>
              ) : motherProfile ? (
                <div className="space-y-4">
                  {/* Mother Card */}
                  <Card className="p-4 space-y-3 border-primary-200 bg-clinic-50/30">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                          <User size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-body">
                            {motherProfile.name}
                          </h3>
                          <p className="text-xs text-body-muted font-medium">
                            {motherProfile.phone}
                          </p>
                        </div>
                      </div>
                      {motherProfile.registered_by_staff && (
                        <span className="text-[10px] bg-primary-100 text-primary-800 border border-primary-200 px-2 py-0.5 rounded-full font-bold">
                          Desk Registered
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border text-xs">
                      <div>
                        <span className="text-body-muted text-[11px] block">
                          Hospital ID
                        </span>
                        <strong className="text-body">
                          {motherProfile.hospital_id || 'None'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-body-muted text-[11px] block">
                          HMO / NHIA
                        </span>
                        <strong className="text-body">
                          {motherProfile.hmo_number || 'None'}
                        </strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-body-muted text-[11px] block">
                          Registered On
                        </span>
                        <strong className="text-body">
                          {formatDate(motherProfile.created_at)}
                        </strong>
                      </div>
                    </div>
                  </Card>

                  {/* Registered Babies List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-body flex items-center gap-1.5">
                      <Baby size={14} className="text-primary-600" />
                      Registered Babies ({motherProfile.babies?.length || 0})
                    </h4>

                    {motherProfile.babies && motherProfile.babies.length > 0 ? (
                      <div className="space-y-2">
                        {motherProfile.babies.map((baby) => (
                          <div
                            key={baby.id}
                            className="p-3 bg-white border border-border rounded-xl text-xs flex items-center justify-between"
                          >
                            <div className="space-y-0.5">
                              <span className="font-bold text-body block">
                                {baby.name}
                              </span>
                              <span className="text-body-muted text-[11px] capitalize">
                                Gender: {baby.sex}
                              </span>
                            </div>
                            <div className="text-right text-[11px]">
                              <span className="text-body-muted block">Date of Birth</span>
                              <strong className="text-body">
                                {formatDate(baby.date_of_birth)}
                              </strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-body-muted italic p-3 bg-clinic-50 border border-border rounded-xl">
                        No babies registered for this patient yet.
                      </p>
                    )}
                  </div>

                  {/* Book appointment button */}
                  {onBookForMother && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => {
                          onBookForMother(motherProfile);
                          onClose();
                        }}
                        className="w-full text-xs h-9 font-bold gap-1.5"
                      >
                        <CalendarPlus size={15} />
                        Book appointment for {motherProfile.name}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-clinic-50 border-t border-border px-5 py-3 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs h-8 px-4"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
