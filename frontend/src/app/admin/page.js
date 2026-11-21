'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  CalendarX,
  AlertTriangle,
  FileText,
  Shield,
  LogOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
  UserX,
  Calendar,
  Percent,
  Menu,
  X,
  Lock,
  Unlock,
  Info,
  Clock,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI, clinicAPI, appointmentAPI, clearAuthStorage } from '../../lib/api';
import { getErrorMessage } from '../../lib/errorMessages';
import {
  formatDate,
  formatDateTime,
  getLagosToday,
  getLagosDaysAgo,
} from '../../lib/dateTime';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

// Helper to mask sensitive fields (passwords, tokens, OTPs) from audit log details
function maskSensitiveDetails(data) {
  if (!data) return data;
  if (typeof data === 'string') {
    // Check if string looks like a JWT token
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(data)) {
      return '••••••••';
    }
    // Check if string is a JSON representation
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === 'object' && parsed !== null) {
        return maskSensitiveDetails(parsed);
      }
    } catch {
      return data;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveDetails(item));
  }

  if (typeof data === 'object') {
    const masked = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('pin') ||
        (lowerKey.includes('otp') && !lowerKey.includes('phone'))
      ) {
        masked[key] = '••••••';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = maskSensitiveDetails(value);
      } else if (
        typeof value === 'string' &&
        /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)
      ) {
        masked[key] = '••••••••';
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  return data;
}

export default function AdminPortalPage() {
  const router = useRouter();

  // Auth & General State
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'block_dates' | 'cancel_session' | 'audit_log'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clinics, setClinics] = useState([]);

  // ==========================================
  // 1. Role Verification & Initial Clinics
  // ==========================================
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored || stored === 'undefined' || stored === 'null') {
        router.push('/login');
        return;
      }
      const parsed = JSON.parse(stored);
      if (!parsed || parsed.role !== 'admin') {
        if (parsed?.role === 'mother') router.push('/dashboard');
        else if (['front_desk', 'midwife', 'doctor'].includes(parsed?.role)) router.push('/staff');
        else router.push('/login');
        return;
      }
      setCurrentUser(parsed);
      setAuthChecked(true);
    } catch {
      router.push('/login');
    }
  }, [router]);

  // Load Clinics for selectors
  useEffect(() => {
    if (!authChecked) return;
    async function loadClinics() {
      try {
        const res = await clinicAPI.list();
        const list = res?.data?.data || [];
        setClinics(list);
        if (list.length > 0) {
          setBlockForm((prev) => ({ ...prev, clinic_id: prev.clinic_id || list[0].id }));
          setUnblockForm((prev) => ({ ...prev, clinic_id: prev.clinic_id || list[0].id }));
          setCancelForm((prev) => ({ ...prev, clinic_id: prev.clinic_id || list[0].id }));
        }
      } catch (err) {
        toast.error('Failed to load clinic list.');
      }
    }
    loadClinics();
  }, [authChecked]);

  const handleLogout = () => {
    clearAuthStorage();
    toast.success('Logged out successfully.');
    router.push('/login');
  };

  // ==========================================
  // 2. DASHBOARD (Reports) State & Logic
  // ==========================================
  const lagosToday = useMemo(() => getLagosToday(), []);
  const lagosSevenDaysAgo = useMemo(() => getLagosDaysAgo(6), []);

  const [dateFilter, setDateFilter] = useState({
    from: lagosSevenDaysAgo,
    to: lagosToday,
    preset: '7d', // 'today' | '7d' | '30d' | 'custom'
  });

  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(null);
  const [summaryData, setSummaryData] = useState({
    total: 0,
    completed: 0,
    cancelled: 0,
    noShows: 0,
    noShowRate: 0,
  });
  const [clinicAppts, setClinicAppts] = useState([]);
  const [clinicLoads, setClinicLoads] = useState([]);

  const handlePresetChange = (preset) => {
    if (preset === 'today') {
      setDateFilter({ from: lagosToday, to: lagosToday, preset: 'today' });
    } else if (preset === '7d') {
      setDateFilter({ from: getLagosDaysAgo(6), to: lagosToday, preset: '7d' });
    } else if (preset === '30d') {
      setDateFilter({ from: getLagosDaysAgo(29), to: lagosToday, preset: '30d' });
    }
  };

  const loadReports = useCallback(async () => {
    if (!authChecked) return;
    setReportsLoading(true);
    setReportsError(null);

    try {
      const from = dateFilter.from || lagosToday;
      const to = dateFilter.to || lagosToday;

      // 1. Fetch No-shows report for date range
      // 2. Fetch Clinic load report for the target date
      // 3. Fetch Appointments report
      const isSingleDay = from === to;
      const promises = [
        adminAPI.getNoShowReport({ from, to }),
        adminAPI.getClinicLoad({ date: to }),
      ];

      if (isSingleDay) {
        promises.push(adminAPI.getAppointmentReport({ date: to, period: 'daily' }));
      } else {
        // Query daily reports for each date in range (up to 31 days) to aggregate exact completed/cancelled counts
        const fromDateObj = new Date(from + 'T00:00:00Z');
        const toDateObj = new Date(to + 'T00:00:00Z');
        const diffDays = Math.min(
          Math.max(Math.round((toDateObj - fromDateObj) / (1000 * 60 * 60 * 24)) + 1, 1),
          31
        );

        const dateList = [];
        for (let i = 0; i < diffDays; i++) {
          const d = new Date(fromDateObj);
          d.setUTCDate(d.getUTCDate() + i);
          dateList.push(d.toISOString().split('T')[0]);
        }
        promises.push(
          Promise.all(dateList.map((d) => adminAPI.getAppointmentReport({ date: d, period: 'daily' })))
        );
      }

      const [noShowsRes, loadRes, apptsRes] = await Promise.all(promises);

      const noShowsList = noShowsRes?.data?.data || [];
      const loadsList = loadRes?.data?.data?.clinics || [];

      // Calculate aggregated metrics from real responses
      let totalAppts = 0;
      let totalNoShows = 0;
      for (const item of noShowsList) {
        totalAppts += Number(item.total_appointments || 0);
        totalNoShows += Number(item.no_shows || 0);
      }
      const calculatedNoShowRate =
        totalAppts > 0 ? Number(((totalNoShows / totalAppts) * 100).toFixed(1)) : 0;

      // Aggregate appointments breakdown (completed, cancelled, upcoming)
      const clinicBreakdownMap = {};
      let totalCompleted = 0;
      let totalCancelled = 0;

      const processClinicAppts = (clinicsArr) => {
        if (!Array.isArray(clinicsArr)) return;
        for (const item of clinicsArr) {
          const name = item.clinic_name || 'Clinic';
          if (!clinicBreakdownMap[name]) {
            clinicBreakdownMap[name] = {
              clinic_name: name,
              total_appointments: 0,
              completed: 0,
              cancelled: 0,
              no_shows: 0,
              upcoming: 0,
            };
          }
          const c = Number(item.completed || 0);
          const can = Number(item.cancelled || 0);
          const ns = Number(item.no_shows || 0);
          const up = Number(item.upcoming || 0);
          const tot = Number(item.total_appointments || 0);

          clinicBreakdownMap[name].completed += c;
          clinicBreakdownMap[name].cancelled += can;
          clinicBreakdownMap[name].no_shows += ns;
          clinicBreakdownMap[name].upcoming += up;
          clinicBreakdownMap[name].total_appointments += tot;

          totalCompleted += c;
          totalCancelled += can;
        }
      };

      if (isSingleDay) {
        processClinicAppts(apptsRes?.data?.data?.clinics);
      } else {
        // apptsRes is an array of responses
        for (const resItem of apptsRes) {
          processClinicAppts(resItem?.data?.data?.clinics);
        }
      }

      // If no appointments were found in appointments report but no-shows had totals, merge them
      for (const ns of noShowsList) {
        const name = ns.clinic_name;
        if (!clinicBreakdownMap[name]) {
          clinicBreakdownMap[name] = {
            clinic_name: name,
            total_appointments: Number(ns.total_appointments || 0),
            completed: 0,
            cancelled: 0,
            no_shows: Number(ns.no_shows || 0),
            upcoming: 0,
          };
        } else {
          clinicBreakdownMap[name].no_shows = Number(ns.no_shows || 0);
        }
      }

      setSummaryData({
        total: totalAppts,
        completed: totalCompleted,
        cancelled: totalCancelled,
        noShows: totalNoShows,
        noShowRate: calculatedNoShowRate,
      });

      setClinicAppts(Object.values(clinicBreakdownMap));
      setClinicLoads(loadsList);
    } catch (err) {
      setReportsError(getErrorMessage(err, 'Failed to load report metrics.'));
    } finally {
      setReportsLoading(false);
    }
  }, [authChecked, dateFilter.from, dateFilter.to, lagosToday]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadReports();
    }
  }, [activeTab, loadReports]);

  // ==========================================
  // 3. BLOCK DATES State & Logic
  // ==========================================
  const [blockForm, setBlockForm] = useState({
    clinic_id: '',
    date: lagosToday,
    reason: '',
  });
  const [unblockForm, setUnblockForm] = useState({
    clinic_id: '',
    date: lagosToday,
  });

  const [existingBookingsCount, setExistingBookingsCount] = useState(null);
  const [checkingBookings, setCheckingBookings] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [submittingBlock, setSubmittingBlock] = useState(false);

  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [submittingUnblock, setSubmittingUnblock] = useState(false);

  // Read-only check for existing bookings whenever clinic or date changes in Block form
  useEffect(() => {
    if (!authChecked || !blockForm.clinic_id || !blockForm.date) return;
    let isCancelled = false;
    async function checkBookings() {
      setCheckingBookings(true);
      try {
        const res = await appointmentAPI.list({
          clinic_id: blockForm.clinic_id,
          date: blockForm.date,
          status: 'booked',
        });
        if (!isCancelled) {
          const list = res?.data?.data || [];
          setExistingBookingsCount(list.length);
        }
      } catch {
        if (!isCancelled) setExistingBookingsCount(null);
      } finally {
        if (!isCancelled) setCheckingBookings(false);
      }
    }
    checkBookings();
    return () => {
      isCancelled = true;
    };
  }, [authChecked, blockForm.clinic_id, blockForm.date]);

  const handleOpenBlockConfirm = (e) => {
    e.preventDefault();
    if (!blockForm.clinic_id || !blockForm.date) {
      toast.error('Please select both a clinic and a date.');
      return;
    }
    setShowBlockModal(true);
  };

  const handleConfirmBlock = async () => {
    setSubmittingBlock(true);
    try {
      const payload = {
        clinic_id: blockForm.clinic_id,
        date: blockForm.date,
        reason: blockForm.reason.trim() || undefined,
      };
      const res = await adminAPI.blockDate(payload);
      toast.success(res?.data?.message || 'Date blocked successfully.');
      setShowBlockModal(false);
      setBlockForm((prev) => ({ ...prev, reason: '' }));
      // Refresh check
      const recheck = await appointmentAPI.list({
        clinic_id: blockForm.clinic_id,
        date: blockForm.date,
        status: 'booked',
      });
      setExistingBookingsCount((recheck?.data?.data || []).length);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to block date.'));
    } finally {
      setSubmittingBlock(false);
    }
  };

  const handleConfirmUnblock = async () => {
    if (!unblockForm.clinic_id || !unblockForm.date) {
      toast.error('Please select clinic and date to unblock.');
      return;
    }
    setSubmittingUnblock(true);
    try {
      const res = await adminAPI.unblockDate(unblockForm.clinic_id, unblockForm.date);
      toast.success(res?.data?.message || 'Date unblocked successfully.');
      setShowUnblockModal(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to unblock date.'));
    } finally {
      setSubmittingUnblock(false);
    }
  };

  // ==========================================
  // 4. CANCEL SESSION State & Logic
  // ==========================================
  const [cancelForm, setCancelForm] = useState({
    clinic_id: '',
    date: lagosToday,
    reason: '',
  });
  const [affectedCount, setAffectedCount] = useState(null);
  const [checkingAffected, setCheckingAffected] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [cancelResult, setCancelResult] = useState(null);

  // Read-only check for affected active bookings
  useEffect(() => {
    if (!authChecked || !cancelForm.clinic_id || !cancelForm.date) return;
    let isCancelled = false;
    async function checkAffected() {
      setCheckingAffected(true);
      try {
        const res = await appointmentAPI.list({
          clinic_id: cancelForm.clinic_id,
          date: cancelForm.date,
          status: 'booked',
        });
        if (!isCancelled) {
          const list = res?.data?.data || [];
          setAffectedCount(list.length);
        }
      } catch {
        if (!isCancelled) setAffectedCount(null);
      } finally {
        if (!isCancelled) setCheckingAffected(false);
      }
    }
    checkAffected();
    return () => {
      isCancelled = true;
    };
  }, [authChecked, cancelForm.clinic_id, cancelForm.date]);

  const handleOpenCancelConfirm = (e) => {
    e.preventDefault();
    if (!cancelForm.clinic_id || !cancelForm.date) {
      toast.error('Please select a clinic and date.');
      return;
    }
    if (!cancelForm.reason.trim()) {
      toast.error('A cancellation reason is required for patient SMS notices.');
      return;
    }
    setShowCancelModal(true);
  };

  const handleConfirmCancelSession = async () => {
    setSubmittingCancel(true);
    try {
      const payload = {
        clinic_id: cancelForm.clinic_id,
        date: cancelForm.date,
        reason: cancelForm.reason.trim(),
      };
      const res = await adminAPI.cancelSession(payload);
      const resData = res?.data;
      setCancelResult({
        message: resData?.message || 'Session cancelled successfully.',
        cancelledCount: resData?.data?.cancelledCount ?? resData?.data?.cancelled_appointments ?? 0,
        clinicId: cancelForm.clinic_id,
        date: cancelForm.date,
      });
      toast.success(resData?.message || 'Session cancelled and patients notified.');
      setShowCancelModal(false);
      setCancelForm((prev) => ({ ...prev, reason: '' }));
      setAffectedCount(0);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel clinic session.'));
    } finally {
      setSubmittingCancel(false);
    }
  };

  // ==========================================
  // 5. AUDIT LOG State & Logic
  // ==========================================
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    user_id: '',
    date: '',
  });
  const [auditOffset, setAuditOffset] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const [auditError, setAuditError] = useState(null);

  const AUDIT_LIMIT = 50;

  const loadAuditLogs = useCallback(
    async (offset = 0, append = false) => {
      if (!authChecked) return;
      if (append) setLoadingMoreLogs(true);
      else setLoadingLogs(true);
      setAuditError(null);

      try {
        const params = {
          limit: AUDIT_LIMIT,
          offset,
        };
        if (auditFilters.action) params.action = auditFilters.action;
        if (auditFilters.user_id) params.user_id = auditFilters.user_id.trim();

        const res = await adminAPI.getAuditLogs(params);
        const list = res?.data?.data || [];

        if (append) {
          setAuditLogs((prev) => [...prev, ...list]);
        } else {
          setAuditLogs(list);
        }

        setHasMoreLogs(list.length === AUDIT_LIMIT);
        setAuditOffset(offset);
      } catch (err) {
        setAuditError(getErrorMessage(err, 'Failed to load audit logs.'));
      } finally {
        setLoadingLogs(false);
        setLoadingMoreLogs(false);
      }
    },
    [authChecked, auditFilters.action, auditFilters.user_id]
  );

  useEffect(() => {
    if (activeTab === 'audit_log') {
      loadAuditLogs(0, false);
    }
  }, [activeTab, loadAuditLogs]);

  const handleAuditFilterSubmit = (e) => {
    e.preventDefault();
    loadAuditLogs(0, false);
  };

  const handleLoadMoreLogs = () => {
    if (loadingMoreLogs || !hasMoreLogs) return;
    loadAuditLogs(auditOffset + AUDIT_LIMIT, true);
  };

  // Filter logs by date client-side if a specific date filter is selected
  const filteredAuditLogs = useMemo(() => {
    if (!auditFilters.date) return auditLogs;
    return auditLogs.filter((log) => {
      if (!log.created_at) return false;
      return log.created_at.startsWith(auditFilters.date);
    });
  }, [auditLogs, auditFilters.date]);

  // Selected clinic helpers
  const getClinicName = (id) => {
    const found = clinics.find((c) => c.id === id);
    return found ? found.name : 'Selected Clinic';
  };

  return (
    <div className="min-h-screen bg-clinic-50 flex flex-col">
      {/* ==================================================== */}
      {/* Top Header Bar */}
      {/* ==================================================== */}
      <header className="bg-white border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-body-muted hover:text-body hover:bg-clinic-50"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-500 font-bold">
              <Shield size={22} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-body leading-tight">Admin Portal</h1>
              <p className="text-xs text-body-muted">Antenatal & Postnatal Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-body">{currentUser?.name || 'Admin User'}</span>
              <span className="text-xs font-bold text-primary-700 uppercase tracking-wide">
                System Administrator
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-body-muted hover:text-status-emergency hover:bg-red-50 border border-border transition-colors"
              aria-label="Log out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-1">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left ${
                activeTab === 'dashboard'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-body-muted hover:bg-clinic-50'
              }`}
            >
              <BarChart3 size={18} /> Dashboard
            </button>
            <button
              onClick={() => {
                setActiveTab('block_dates');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left ${
                activeTab === 'block_dates'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-body-muted hover:bg-clinic-50'
              }`}
            >
              <CalendarX size={18} /> Block dates
            </button>
            <button
              onClick={() => {
                setActiveTab('cancel_session');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left ${
                activeTab === 'cancel_session'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-body-muted hover:bg-clinic-50'
              }`}
            >
              <AlertTriangle size={18} /> Cancel session
            </button>
            <button
              onClick={() => {
                setActiveTab('audit_log');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left ${
                activeTab === 'audit_log'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-body-muted hover:bg-clinic-50'
              }`}
            >
              <FileText size={18} /> Audit log
            </button>
          </div>
        )}
      </header>

      {/* ==================================================== */}
      {/* Main Content Area with Desktop Sidebar */}
      {/* ==================================================== */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Left Sidebar */}
        <aside className="hidden md:flex flex-col w-64 border-r border-border bg-white p-4 space-y-1.5 flex-shrink-0">
          <p className="px-3 py-2 text-xs font-bold text-body-muted uppercase tracking-wider">
            Navigation
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors text-left ${
              activeTab === 'dashboard'
                ? 'bg-primary-50 text-primary-700 font-bold'
                : 'text-body-muted hover:bg-clinic-50 hover:text-body'
            }`}
          >
            <BarChart3 size={18} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('block_dates')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors text-left ${
              activeTab === 'block_dates'
                ? 'bg-primary-50 text-primary-700 font-bold'
                : 'text-body-muted hover:bg-clinic-50 hover:text-body'
            }`}
          >
            <CalendarX size={18} />
            <span>Block dates</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cancel_session')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors text-left ${
              activeTab === 'cancel_session'
                ? 'bg-primary-50 text-primary-700 font-bold'
                : 'text-body-muted hover:bg-clinic-50 hover:text-body'
            }`}
          >
            <AlertTriangle size={18} />
            <span>Cancel session</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit_log')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors text-left ${
              activeTab === 'audit_log'
                ? 'bg-primary-50 text-primary-700 font-bold'
                : 'text-body-muted hover:bg-clinic-50 hover:text-body'
            }`}
          >
            <FileText size={18} />
            <span>Audit log</span>
          </button>
        </aside>

        {/* Dynamic View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {/* ==================================================== */}
          {/* TAB 1: DASHBOARD (Reports) */}
          {/* ==================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Header and Filter Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-body">Clinic Reports & Operational Metrics</h2>
                  <p className="text-sm text-body-muted">
                    Attendance, no-show rates and capacity load in Lagos time.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-xl border border-border p-1 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => handlePresetChange('today')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        dateFilter.preset === 'today'
                          ? 'bg-primary-500 text-white'
                          : 'text-body-muted hover:text-body'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetChange('7d')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        dateFilter.preset === '7d'
                          ? 'bg-primary-500 text-white'
                          : 'text-body-muted hover:text-body'
                      }`}
                    >
                      Last 7 days
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetChange('30d')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        dateFilter.preset === '30d'
                          ? 'bg-primary-500 text-white'
                          : 'text-body-muted hover:text-body'
                      }`}
                    >
                      Last 30 days
                    </button>
                  </div>

                  {/* Date Pickers */}
                  <div className="flex items-center gap-1.5 bg-white border border-border px-3 py-1.5 rounded-xl text-xs shadow-sm">
                    <span className="text-body-muted">From:</span>
                    <input
                      type="date"
                      value={dateFilter.from}
                      onChange={(e) =>
                        setDateFilter((prev) => ({
                          ...prev,
                          from: e.target.value,
                          preset: 'custom',
                        }))
                      }
                      className="text-xs bg-transparent focus:outline-none"
                    />
                    <span className="text-body-muted ml-1">To:</span>
                    <input
                      type="date"
                      value={dateFilter.to}
                      onChange={(e) =>
                        setDateFilter((prev) => ({
                          ...prev,
                          to: e.target.value,
                          preset: 'custom',
                        }))
                      }
                      className="text-xs bg-transparent focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={loadReports}
                    disabled={reportsLoading}
                    className="p-2.5 rounded-xl border border-border bg-white text-body-muted hover:text-primary-700 shadow-sm transition-colors"
                    title="Refresh reports"
                  >
                    <RefreshCw size={16} className={reportsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Reports Error State */}
              {reportsError && (
                <Card className="p-5 border-red-200 bg-red-50 text-red-900 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
                    <p className="text-sm font-medium">{reportsError}</p>
                  </div>
                  <Button variant="outline" onClick={loadReports} className="h-9 px-4 text-xs font-semibold">
                    Retry
                  </Button>
                </Card>
              )}

              {/* Reports Loading Skeletons */}
              {reportsLoading ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Card key={i} className="p-4 space-y-2">
                        <Skeleton height={14} className="w-1/2" />
                        <Skeleton height={28} className="w-3/4" />
                      </Card>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-5 space-y-4">
                      <Skeleton height={20} className="w-1/3" />
                      <Skeleton height={120} className="w-full" />
                    </Card>
                    <Card className="p-5 space-y-4">
                      <Skeleton height={20} className="w-1/3" />
                      <Skeleton height={120} className="w-full" />
                    </Card>
                  </div>
                </div>
              ) : summaryData.total === 0 && clinicLoads.length === 0 ? (
                <Card className="p-8">
                  <EmptyState
                    icon={BarChart3}
                    title="No appointment data available"
                    description={`No appointments or slots were recorded between ${formatDate(
                      dateFilter.from
                    )} and ${formatDate(dateFilter.to)}.`}
                    action={
                      <Button
                        variant="secondary"
                        onClick={() => handlePresetChange('30d')}
                        className="px-5 text-sm h-10"
                      >
                        Check last 30 days
                      </Button>
                    }
                  />
                </Card>
              ) : (
                <>
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-body-muted uppercase">Total Visits</span>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Calendar size={16} />
                        </div>
                      </div>
                      <p className="text-2xl sm:text-3xl font-extrabold text-body mt-2">
                        {summaryData.total}
                      </p>
                      <p className="text-xs text-body-muted mt-0.5">Across all clinics</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-body-muted uppercase">Completed</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <CheckCircle2 size={16} />
                        </div>
                      </div>
                      <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-2">
                        {summaryData.completed}
                      </p>
                      <p className="text-xs text-body-muted mt-0.5">Consultations finished</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-body-muted uppercase">Cancelled</span>
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-status-emergency flex items-center justify-center">
                          <XCircle size={16} />
                        </div>
                      </div>
                      <p className="text-2xl sm:text-3xl font-extrabold text-status-emergency mt-2">
                        {summaryData.cancelled}
                      </p>
                      <p className="text-xs text-body-muted mt-0.5">By patient or admin</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-body-muted uppercase">No-Shows</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                          <UserX size={16} />
                        </div>
                      </div>
                      <p className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-2">
                        {summaryData.noShows}
                      </p>
                      <p className="text-xs text-body-muted mt-0.5">Missed appointments</p>
                    </Card>

                    <Card className="p-4 col-span-2 sm:col-span-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-body-muted uppercase">No-Show Rate</span>
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                          <Percent size={16} />
                        </div>
                      </div>
                      <p className="text-2xl sm:text-3xl font-extrabold text-purple-700 mt-2">
                        {summaryData.noShowRate}%
                      </p>
                      <p className="text-xs text-body-muted mt-0.5">Of scheduled visits</p>
                    </Card>
                  </div>

                  {/* Visual CSS / SVG Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Chart 1: Appointments per Clinic */}
                    <Card className="p-5">
                      <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                        <div>
                          <h3 className="text-base font-bold text-body">Appointments by Clinic</h3>
                          <p className="text-xs text-body-muted">Status breakdown per specialty</p>
                        </div>
                        <span className="text-xs bg-clinic-50 border border-border px-2.5 py-1 rounded-full text-body-muted font-medium">
                          {formatDate(dateFilter.from)} – {formatDate(dateFilter.to)}
                        </span>
                      </div>

                      {clinicAppts.length === 0 ? (
                        <p className="text-center py-8 text-sm text-body-muted">
                          No clinic appointment breakdown available for this range.
                        </p>
                      ) : (
                        <div className="space-y-5">
                          {clinicAppts.map((c, i) => {
                            const tot = Math.max(c.total_appointments || 0, 1);
                            const compPct = ((c.completed || 0) / tot) * 100;
                            const canPct = ((c.cancelled || 0) / tot) * 100;
                            const nsPct = ((c.no_shows || 0) / tot) * 100;
                            const upPct = ((c.upcoming || 0) / tot) * 100;

                            return (
                              <div key={i} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-semibold text-body">
                                  <span>{c.clinic_name}</span>
                                  <span>{c.total_appointments} total visits</span>
                                </div>

                                {/* Stacked Bar */}
                                <div className="h-6 w-full rounded-lg bg-gray-100 flex overflow-hidden">
                                  {compPct > 0 && (
                                    <div
                                      style={{ width: `${compPct}%` }}
                                      className="bg-primary-500 h-full flex items-center justify-center text-[10px] text-white font-bold"
                                      title={`Completed: ${c.completed}`}
                                    >
                                      {c.completed > 0 ? c.completed : ''}
                                    </div>
                                  )}
                                  {canPct > 0 && (
                                    <div
                                      style={{ width: `${canPct}%` }}
                                      className="bg-status-emergency h-full flex items-center justify-center text-[10px] text-white font-bold"
                                      title={`Cancelled: ${c.cancelled}`}
                                    >
                                      {c.cancelled > 0 ? c.cancelled : ''}
                                    </div>
                                  )}
                                  {nsPct > 0 && (
                                    <div
                                      style={{ width: `${nsPct}%` }}
                                      className="bg-amber-500 h-full flex items-center justify-center text-[10px] text-white font-bold"
                                      title={`No-shows: ${c.no_shows}`}
                                    >
                                      {c.no_shows > 0 ? c.no_shows : ''}
                                    </div>
                                  )}
                                  {upPct > 0 && (
                                    <div
                                      style={{ width: `${upPct}%` }}
                                      className="bg-sky-500 h-full flex items-center justify-center text-[10px] text-white font-bold"
                                      title={`Upcoming: ${c.upcoming}`}
                                    >
                                      {c.upcoming > 0 ? c.upcoming : ''}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-body-muted pt-0.5">
                                  <span>✓ {c.completed || 0} completed</span>
                                  <span>✕ {c.cancelled || 0} cancelled</span>
                                  <span>! {c.no_shows || 0} no-shows</span>
                                  <span>⏳ {c.upcoming || 0} upcoming</span>
                                </div>
                              </div>
                            );
                          })}

                          {/* Legend */}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-body-muted pt-3 border-t border-border">
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded bg-primary-500 inline-block"></span>
                              <span>Completed</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded bg-status-emergency inline-block"></span>
                              <span>Cancelled</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
                              <span>No-show</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded bg-sky-500 inline-block"></span>
                              <span>Upcoming</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>

                    {/* Chart 2: Clinic Load & Capacity */}
                    <Card className="p-5">
                      <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                        <div>
                          <h3 className="text-base font-bold text-body">Clinic Capacity & Load</h3>
                          <p className="text-xs text-body-muted">Booked vs total slots for {formatDate(dateFilter.to)}</p>
                        </div>
                        <span className="text-xs bg-clinic-50 border border-border px-2.5 py-1 rounded-full text-body-muted font-medium">
                          Occupancy Rate
                        </span>
                      </div>

                      {clinicLoads.length === 0 ? (
                        <p className="text-center py-8 text-sm text-body-muted">
                          No slot schedules found for {formatDate(dateFilter.to)}.
                        </p>
                      ) : (
                        <div className="space-y-5">
                          {clinicLoads.map((c, i) => {
                            const occ = Number(c.occupancy_pct || 0);
                            return (
                              <div key={i} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-semibold text-body">
                                  <span>{c.clinic_name}</span>
                                  <span className="text-primary-700 font-bold">{occ}% occupancy</span>
                                </div>

                                {/* Capacity Bar */}
                                <div className="h-6 w-full rounded-lg bg-gray-100 overflow-hidden flex">
                                  <div
                                    style={{ width: `${Math.min(occ, 100)}%` }}
                                    className="bg-primary-500 h-full flex items-center justify-end px-2 text-[10px] text-white font-bold transition-all"
                                  >
                                    {c.booked_slots > 0 ? `${c.booked_slots} booked` : ''}
                                  </div>
                                  <div className="flex-1 flex items-center justify-center text-[10px] text-body-muted font-medium px-2">
                                    {c.available_slots} available
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-body-muted pt-0.5">
                                  <span>Total Slots: {c.total_slots}</span>
                                  <span>Booked: {c.booked_slots}</span>
                                  <span>Remaining: {c.available_slots}</span>
                                </div>
                              </div>
                            );
                          })}

                          <div className="flex items-center gap-2 p-3 bg-clinic-50 rounded-xl border border-border text-xs text-body-muted mt-4">
                            <Info size={16} className="text-primary-600 flex-shrink-0" />
                            <span>
                              Capacity shows booked appointments against total configured slots for{' '}
                              <strong>{formatDate(dateFilter.to)}</strong>.
                            </span>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: BLOCK DATES */}
          {/* ==================================================== */}
          {activeTab === 'block_dates' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl font-bold text-body">Block & Unblock Clinic Dates</h2>
                <p className="text-sm text-body-muted">
                  Prevent patients from booking appointment slots on holidays or doctor leave dates.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Block Date Form */}
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Lock size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-body">Block Clinic Date</h3>
                      <p className="text-xs text-body-muted">Disables future bookings for this date</p>
                    </div>
                  </div>

                  <form onSubmit={handleOpenBlockConfirm} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-body mb-1" htmlFor="block-clinic">
                        Select Clinic
                      </label>
                      <select
                        id="block-clinic"
                        className="input-field text-sm"
                        value={blockForm.clinic_id}
                        onChange={(e) => setBlockForm({ ...blockForm, clinic_id: e.target.value })}
                        required
                      >
                        {clinics.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-body mb-1" htmlFor="block-date">
                        Date to Block
                      </label>
                      <input
                        id="block-date"
                        type="date"
                        className="input-field text-sm"
                        value={blockForm.date}
                        onChange={(e) => setBlockForm({ ...blockForm, date: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-body mb-1" htmlFor="block-reason">
                        Reason (Optional)
                      </label>
                      <input
                        id="block-reason"
                        type="text"
                        placeholder="e.g. Public Holiday, Staff Training"
                        className="input-field text-sm"
                        value={blockForm.reason}
                        onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                      />
                    </div>

                    {/* Live Warning for Existing Bookings */}
                    {checkingBookings ? (
                      <div className="p-3 bg-gray-50 rounded-xl border border-border text-xs text-body-muted flex items-center gap-2">
                        <RefreshCw size={14} className="animate-spin text-primary-600" />
                        <span>Checking existing bookings for this date...</span>
                      </div>
                    ) : existingBookingsCount !== null && existingBookingsCount > 0 ? (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800">
                          <AlertTriangle size={15} />
                          <span>Existing Bookings Warning</span>
                        </div>
                        <p>
                          There are <strong>{existingBookingsCount} active booking(s)</strong> on this date.
                          Blocking this date prevents future bookings but does <em>NOT</em> cancel existing
                          appointments or notify mothers.
                        </p>
                        <p className="text-[11px] text-amber-700">
                          To cancel existing bookings and notify mothers by SMS, please use <strong>Cancel session</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                        <span>No active bookings found on this date.</span>
                      </div>
                    )}

                    <Button type="submit" variant="secondary" className="w-full text-sm font-semibold h-11">
                      Block date
                    </Button>
                  </form>
                </Card>

                {/* 2. Unblock Date Form */}
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Unlock size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-body">Unblock Clinic Date</h3>
                      <p className="text-xs text-body-muted">Re-opens slots for patient booking</p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setShowUnblockModal(true);
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-body mb-1" htmlFor="unblock-clinic">
                        Select Clinic
                      </label>
                      <select
                        id="unblock-clinic"
                        className="input-field text-sm"
                        value={unblockForm.clinic_id}
                        onChange={(e) => setUnblockForm({ ...unblockForm, clinic_id: e.target.value })}
                        required
                      >
                        {clinics.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-body mb-1" htmlFor="unblock-date">
                        Date to Unblock
                      </label>
                      <input
                        id="unblock-date"
                        type="date"
                        className="input-field text-sm"
                        value={unblockForm.date}
                        onChange={(e) => setUnblockForm({ ...unblockForm, date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="p-3 bg-clinic-50 rounded-xl border border-border text-xs text-body-muted">
                      <p>
                        Unblocking marks all slots on this date as unblocked (<code>is_blocked = false</code>).
                        Available slots immediately become bookable again by mothers.
                      </p>
                    </div>

                    <Button type="submit" variant="outline" className="w-full text-sm font-semibold h-11">
                      Unblock date
                    </Button>
                  </form>
                </Card>
              </div>

              {/* Informational Contract Note */}
              <div className="p-4 bg-white rounded-xl border border-border text-xs text-body-muted flex items-start gap-2.5">
                <Info size={18} className="text-primary-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-body">Listing Blocked Dates Notice</p>
                  <p className="mt-0.5">
                    The backend API applies date blocks directly to clinic schedule slots. A dedicated listing endpoint
                    to query all previously blocked dates is currently pending (documented in{' '}
                    <code>BACKEND_REQUESTS.md</code>). Use the Unblock form above whenever a blocked date needs to be
                    reopened.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: CANCEL SESSION */}
          {/* ==================================================== */}
          {activeTab === 'cancel_session' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h2 className="text-xl font-bold text-body">Cancel Clinic Session & Bulk SMS</h2>
                <p className="text-sm text-body-muted">
                  Cancels all booked appointments for an entire session and dispatches automated SMS cancellation alerts.
                </p>
              </div>

              {/* Success Result Banner */}
              {cancelResult && (
                <Card className="p-5 border-emerald-200 bg-emerald-50 text-emerald-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-emerald-800 text-base">
                      <CheckCircle2 size={20} className="text-emerald-600" />
                      <span>{cancelResult.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCancelResult(null)}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-xs text-emerald-800">
                    Clinic: <strong>{getClinicName(cancelResult.clinicId)}</strong> · Date:{' '}
                    <strong>{formatDate(cancelResult.date)}</strong> · Cancelled appointments:{' '}
                    <strong>{cancelResult.cancelledCount}</strong>.
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Automated SMS rebooking notices were dispatched to all affected patients.
                  </p>
                </Card>
              )}

              <Card className="p-6 border-red-200 bg-red-50/15">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-status-emergency flex items-center justify-center">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-body">Emergency Session Cancellation</h3>
                    <p className="text-xs text-body-muted">
                      Cancels bookings, blocks the date, and sends Termii SMS notices
                    </p>
                  </div>
                </div>

                <form onSubmit={handleOpenCancelConfirm} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-body mb-1" htmlFor="cancel-clinic">
                      Clinic
                    </label>
                    <select
                      id="cancel-clinic"
                      className="input-field bg-white text-sm"
                      value={cancelForm.clinic_id}
                      onChange={(e) => setCancelForm({ ...cancelForm, clinic_id: e.target.value })}
                      required
                    >
                      {clinics.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-body mb-1" htmlFor="cancel-date">
                      Session Date
                    </label>
                    <input
                      id="cancel-date"
                      type="date"
                      className="input-field bg-white text-sm"
                      value={cancelForm.date}
                      onChange={(e) => setCancelForm({ ...cancelForm, date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-body mb-1" htmlFor="cancel-reason">
                      Cancellation Reason (Required - Sent via SMS)
                    </label>
                    <input
                      id="cancel-reason"
                      type="text"
                      placeholder="e.g. Doctor emergency leave / Facility maintenance"
                      className="input-field bg-white text-sm"
                      value={cancelForm.reason}
                      onChange={(e) => setCancelForm({ ...cancelForm, reason: e.target.value })}
                      required
                    />
                  </div>

                  {/* Active Bookings Impact Summary */}
                  {checkingAffected ? (
                    <div className="p-3 bg-gray-50 rounded-xl border border-border text-xs text-body-muted flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-primary-600" />
                      <span>Checking affected bookings...</span>
                    </div>
                  ) : affectedCount !== null ? (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle size={15} className="text-status-emergency" />
                        <span>
                          {affectedCount === 0
                            ? '0 active bookings found on this date.'
                            : `${affectedCount} active booking(s) will be cancelled and notified via SMS.`}
                        </span>
                      </div>
                      <p className="text-[11px] text-red-800">
                        Affected mothers will immediately receive an SMS advising them that the clinic is cancelled and
                        providing instructions to rebook.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl border border-border text-xs text-body-muted">
                      <span>All active bookings for that clinic and date will be cancelled.</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="danger"
                    disabled={submittingCancel}
                    className="w-full text-sm font-semibold h-11"
                  >
                    Cancel session and notify
                  </Button>
                </form>
              </Card>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: AUDIT LOG */}
          {/* ==================================================== */}
          {activeTab === 'audit_log' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-body">System Audit Log</h2>
                  <p className="text-sm text-body-muted">
                    Traceability of all administrative and clinic actions. Secrets & passwords are masked.
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => loadAuditLogs(0, false)}
                  disabled={loadingLogs}
                  className="h-9 px-3.5 text-xs font-semibold self-start sm:self-auto"
                >
                  <RefreshCw size={14} className={`mr-1.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {/* Filters Form */}
              <Card className="p-4">
                <form onSubmit={handleAuditFilterSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-body mb-1" htmlFor="audit-action">
                      Filter Action
                    </label>
                    <select
                      id="audit-action"
                      className="input-field text-xs h-9"
                      value={auditFilters.action}
                      onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                    >
                      <option value="">All Actions</option>
                      <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
                      <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
                      <option value="BLOCK_DATE">BLOCK_DATE</option>
                      <option value="CANCEL_SESSION">CANCEL_SESSION</option>
                      <option value="BOOK_APPOINTMENT">BOOK_APPOINTMENT</option>
                      <option value="CHECK_IN">CHECK_IN</option>
                      <option value="STATUS_UPDATE">STATUS_UPDATE</option>
                      <option value="CREATE_MOTHER_BY_STAFF">CREATE_MOTHER_BY_STAFF</option>
                      <option value="GENERATE_SLOTS">GENERATE_SLOTS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-body mb-1" htmlFor="audit-user">
                      User ID (UUID)
                    </label>
                    <input
                      id="audit-user"
                      type="text"
                      placeholder="Optional User UUID"
                      className="input-field text-xs h-9"
                      value={auditFilters.user_id}
                      onChange={(e) => setAuditFilters({ ...auditFilters, user_id: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-body mb-1" htmlFor="audit-date">
                      Filter Date
                    </label>
                    <input
                      id="audit-date"
                      type="date"
                      className="input-field text-xs h-9"
                      value={auditFilters.date}
                      onChange={(e) => setAuditFilters({ ...auditFilters, date: e.target.value })}
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <Button type="submit" className="h-9 px-4 text-xs font-semibold flex-1">
                      Apply
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuditFilters({ action: '', user_id: '', date: '' });
                        loadAuditLogs(0, false);
                      }}
                      className="h-9 px-3 text-xs text-body-muted hover:text-body border border-border rounded-xl"
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </Card>

              {/* Logs Error */}
              {auditError && (
                <div className="p-4 bg-red-50 text-red-900 rounded-xl border border-red-200 text-xs flex items-center justify-between">
                  <span>{auditError}</span>
                  <button
                    type="button"
                    onClick={() => loadAuditLogs(0, false)}
                    className="font-bold underline text-xs"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Logs Table / Cards */}
              {loadingLogs ? (
                <Card className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} height={40} className="w-full" />
                  ))}
                </Card>
              ) : filteredAuditLogs.length === 0 ? (
                <Card className="p-8">
                  <EmptyState
                    icon={FileText}
                    title="No audit log entries found"
                    description="No system operations matched the specified filters."
                    action={
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setAuditFilters({ action: '', user_id: '', date: '' });
                          loadAuditLogs(0, false);
                        }}
                        className="px-4 text-xs h-9"
                      >
                        Clear filters
                      </Button>
                    }
                  />
                </Card>
              ) : (
                <Card className="!p-0 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-clinic-50 border-b border-border text-body-muted font-bold uppercase text-[11px]">
                        <tr>
                          <th className="p-3.5">Timestamp (Lagos)</th>
                          <th className="p-3.5">Action</th>
                          <th className="p-3.5">User</th>
                          <th className="p-3.5">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredAuditLogs.map((log) => {
                          const masked = maskSensitiveDetails(log.details);
                          const isSuccess = log.action?.includes('SUCCESS') || log.action?.includes('CREATE');
                          const isDanger = log.action?.includes('FAILURE') || log.action?.includes('CANCEL');
                          const isWarn = log.action?.includes('BLOCK');

                          return (
                            <tr key={log.id} className="hover:bg-clinic-50/50 transition-colors">
                              <td className="p-3.5 text-body font-medium whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Clock size={13} className="text-body-muted" />
                                  <span>{formatDateTime(log.created_at)}</span>
                                </div>
                              </td>

                              <td className="p-3.5 whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                    isSuccess
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : isDanger
                                      ? 'bg-red-50 text-red-800 border border-red-200'
                                      : isWarn
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                                  }`}
                                >
                                  {log.action}
                                </span>
                              </td>

                              <td className="p-3.5 font-mono text-[11px] text-body-muted whitespace-nowrap">
                                {log.user_id ? (
                                  <span title={log.user_id} className="flex items-center gap-1">
                                    <User size={12} />
                                    {log.user_id.slice(0, 8)}…
                                  </span>
                                ) : (
                                  'System'
                                )}
                              </td>

                              <td className="p-3.5 font-mono text-[11px] text-body max-w-md">
                                {typeof masked === 'object' && masked !== null ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(masked).map(([k, v]) => (
                                      <span
                                        key={k}
                                        className="inline-flex items-center bg-gray-50 border border-border px-2 py-0.5 rounded text-[10px]"
                                      >
                                        <strong className="text-body-muted mr-1">{k}:</strong>
                                        <span className="font-semibold text-body">
                                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span>{String(masked)}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination / Load More Button */}
                  {hasMoreLogs && (
                    <div className="p-4 border-t border-border flex justify-center bg-clinic-50/30">
                      <Button
                        variant="secondary"
                        onClick={handleLoadMoreLogs}
                        disabled={loadingMoreLogs}
                        className="px-6 text-xs h-10 font-semibold"
                      >
                        {loadingMoreLogs ? 'Loading more...' : 'Load more logs'}
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ==================================================== */}
      {/* Confirmation Modal: BLOCK DATE */}
      {/* ==================================================== */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <CalendarX size={22} className="text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-body">Confirm Block Date</h3>
            </div>

            <div className="space-y-2 text-sm text-body">
              <p>
                You are about to block <strong>{getClinicName(blockForm.clinic_id)}</strong> on{' '}
                <strong>{formatDate(blockForm.date)}</strong>.
              </p>
              {blockForm.reason && (
                <p className="text-xs text-body-muted">
                  Reason: <em>{blockForm.reason}</em>
                </p>
              )}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <strong>What happens:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>All schedule slots on this date become blocked (<code>is_blocked = true</code>).</li>
                  <li>No new appointments can be booked on this date.</li>
                  <li>
                    {existingBookingsCount > 0 ? (
                      <span className="text-red-700 font-semibold">
                        {existingBookingsCount} existing appointment(s) remain booked (not cancelled).
                      </span>
                    ) : (
                      'Existing bookings are not cancelled.'
                    )}
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowBlockModal(false)}
                disabled={submittingBlock}
                className="h-10 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmBlock}
                disabled={submittingBlock}
                className="h-10 px-5 text-xs font-semibold"
              >
                {submittingBlock ? 'Blocking...' : 'Confirm block'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================== */}
      {/* Confirmation Modal: UNBLOCK DATE */}
      {/* ==================================================== */}
      {showUnblockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Unlock size={22} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-body">Confirm Unblock Date</h3>
            </div>

            <p className="text-sm text-body">
              Unblock <strong>{getClinicName(unblockForm.clinic_id)}</strong> on{' '}
              <strong>{formatDate(unblockForm.date)}</strong>? This will re-open any unbooked slots on this day for
              patient bookings.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowUnblockModal(false)}
                disabled={submittingUnblock}
                className="h-10 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmUnblock}
                disabled={submittingUnblock}
                className="h-10 px-5 text-xs font-semibold"
              >
                {submittingUnblock ? 'Unblocking...' : 'Confirm unblock'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================== */}
      {/* Confirmation Modal: CANCEL SESSION */}
      {/* ==================================================== */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-status-emergency">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} className="text-status-emergency" />
              </div>
              <h3 className="text-lg font-bold text-body">Cancel Session & Alert Patients</h3>
            </div>

            <div className="space-y-2 text-sm text-body">
              <p>
                Are you sure you want to cancel the entire session for{' '}
                <strong>{getClinicName(cancelForm.clinic_id)}</strong> on{' '}
                <strong>{formatDate(cancelForm.date)}</strong>?
              </p>
              <p className="text-xs text-body-muted">
                Reason sent to mothers: <em>{cancelForm.reason}</em>
              </p>

              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1">
                <p className="font-bold">Immediate consequences:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>
                    All <strong>{affectedCount ?? 'active'} booked appointment(s)</strong> will be marked as{' '}
                    <code>CANCELLED</code>.
                  </li>
                  <li>All slots on this date will be marked as blocked.</li>
                  <li>
                    Automated SMS notifications with your reason will be sent immediately to every affected patient&apos;s
                    phone.
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCancelModal(false)}
                disabled={submittingCancel}
                className="h-10 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmCancelSession}
                disabled={submittingCancel}
                className="h-10 px-5 text-xs font-semibold"
              >
                {submittingCancel ? 'Cancelling...' : 'Cancel session and notify'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
