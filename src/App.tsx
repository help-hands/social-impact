import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  FileText,
  HandCoins,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';

type ViewKey = 'dashboard' | 'my-donations' | 'public-donations' | 'donations-out' | 'admin-out';
type AuthMode = 'sign-in' | 'sign-up';
type OnboardingStep = 'required' | 'optional' | null;
type ToastState = { type: 'success' | 'error'; message: string } | null;
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

type Profile = {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  username: string;
  nic: string | null;
  mobile: string;
  profile_image_url: string | null;
  reference_id: string;
  role_id: number;
};

type PublicDonationIn = {
  id: string;
  donated_at: string;
  amount: number;
  reference_id: string;
  status: 'pending' | 'success' | 'failed';
  donor_username: string;
};

type DonationOut = {
  id: string;
  donee_name: string;
  address?: string | null;
  donated_at: string;
  amount: number;
  reference_id: string;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
  updated_at: string;
  notes?: string | null;
  document_id?: string;
};

type DonationIn = {
  id: string;
  user_id: string;
  donated_at: string;
  amount: number;
  reference_id: string;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
  updated_at: string;
  notes: string | null;
  document_id: string;
  donor_username?: string;
  donor_reference_id?: string;
};

type DonationForm = {
  donated_at: string;
  amount: string;
  reference_id: string;
  notes: string;
  file: File | null;
};

type DonationOutForm = DonationForm & {
  donee_name: string;
  address: string;
};

type SortKey = 'created_at' | 'updated_at' | 'donated_at';

type FieldErrors = Record<string, string>;

type UploadedDocument = {
  id: string;
  url: string;
  file_name: string;
  mime_type: string;
};

const navItems: Array<{ key: ViewKey; label: string; icon: typeof BadgeDollarSign }> = [
  { key: 'dashboard', label: 'Dashboard', icon: BadgeDollarSign },
  { key: 'my-donations', label: 'Mine', icon: HandCoins },
  { key: 'public-donations', label: 'Community', icon: UserRound },
  { key: 'donations-out', label: 'Out', icon: FileText },
];

const emptyDonationForm: DonationForm = {
  donated_at: '',
  amount: '',
  reference_id: '',
  notes: '',
  file: null,
};

const emptyDonationOutForm: DonationOutForm = {
  ...emptyDonationForm,
  donee_name: '',
  address: '',
};

const currency = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-LK', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function StatusPill({ status }: { status: 'pending' | 'success' | 'failed' }) {
  return <span className={`status status-${status}`}>{status}</span>;
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty-state">
      <FileText aria-hidden="true" />
      <p>{title}</p>
    </div>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;

  return <div className={`toast toast-${toast.type}`}>{toast.message}</div>;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>('dashboard');
  const [publicDonations, setPublicDonations] = useState<DonationIn[]>([]);
  const [myDonations, setMyDonations] = useState<DonationIn[]>([]);
  const [donationsOut, setDonationsOut] = useState<DonationOut[]>([]);
  const [selectedDonationIn, setSelectedDonationIn] = useState<DonationIn | null>(null);
  const [selectedDonationOut, setSelectedDonationOut] = useState<DonationOut | null>(null);
  const [pendingDonationCount, setPendingDonationCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingDonation, setSavingDonation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    nic: '',
    mobile: '',
  });
  const [donationForm, setDonationForm] = useState<DonationForm>(emptyDonationForm);
  const [donationOutForm, setDonationOutForm] = useState<DonationOutForm>(emptyDonationOutForm);
  const [donationDocument, setDonationDocument] = useState<UploadedDocument | null>(null);
  const [donationOutDocument, setDonationOutDocument] = useState<UploadedDocument | null>(null);
  const [donationUploadStatus, setDonationUploadStatus] = useState<UploadStatus>('idle');
  const [donationOutUploadStatus, setDonationOutUploadStatus] = useState<UploadStatus>('idle');
  const [donationErrors, setDonationErrors] = useState<FieldErrors>({});
  const [donationOutErrors, setDonationOutErrors] = useState<FieldErrors>({});
  const [communitySearch, setCommunitySearch] = useState('');
  const [communitySort, setCommunitySort] = useState<SortKey>('created_at');
  const [outSearch, setOutSearch] = useState('');
  const [outSort, setOutSort] = useState<SortKey>('created_at');

  const userEmail = session?.user.email ?? '';
  const emailVerified = session ? isEmailVerified(session) : false;
  const needsOnboarding = Boolean(session && emailVerified && (!profile || !isProfileComplete(profile)));
  const activeOnboardingStep = needsOnboarding ? 'required' : onboardingStep;
  const isAdmin = profile?.role_id === 1;
  const visibleNavItems = useMemo(
    () => (isAdmin ? [...navItems, { key: 'admin-out' as ViewKey, label: 'Admin', icon: Plus }] : navItems),
    [isAdmin],
  );

  const filteredCommunityDonations = useMemo(
    () => filterAndSortIncoming(publicDonations, communitySearch, communitySort),
    [communitySearch, communitySort, publicDonations],
  );

  const filteredDonationsOut = useMemo(
    () => filterAndSortOutgoing(donationsOut, outSearch, outSort),
    [donationsOut, outSearch, outSort],
  );

  const totals = useMemo(() => {
    const incomingTotal = publicDonations.reduce((sum, donation) => sum + Number(donation.amount), 0);
    const outgoingTotal = donationsOut.reduce((sum, donation) => sum + Number(donation.amount), 0);

    return {
      incomingTotal,
      outgoingTotal,
      incomingCount: publicDonations.length,
      outgoingCount: donationsOut.length,
    };
  }, [donationsOut, publicDonations]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setOnboardingStep(null);
      setToast(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null);
      return;
    }

    if (!isEmailVerified(session)) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    async function loadProfile() {
      setProfileLoading(true);
      setError(null);

      const { data, error: profileError } = await supabase!
        .from('profiles')
        .select('id, name, first_name, last_name, username, nic, mobile, profile_image_url, reference_id, role_id')
        .eq('id', session!.user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
      } else {
        setProfile(data as Profile | null);
      }

      setProfileLoading(false);
    }

    loadProfile();
  }, [session]);

  useEffect(() => {
    if (!session || !emailVerified || !needsOnboarding) return;

    setProfileForm((current) => ({
      ...current,
      first_name: current.first_name || profile?.first_name || getDefaultFirstName(session),
      last_name: current.last_name || profile?.last_name || getDefaultLastName(session),
      username: current.username || profile?.username || getDefaultUsername(session),
      nic: current.nic || profile?.nic || '',
      mobile: current.mobile || profile?.mobile || '',
    }));
  }, [emailVerified, needsOnboarding, profile, session]);

  useEffect(() => {
    if (!supabase || !session || !emailVerified || !needsOnboarding) return;

    const username = profileForm.username.trim().toLowerCase();

    if (!username) {
      setUsernameStatus('idle');
      return;
    }

    if (!isValidUsername(username)) {
      setUsernameStatus('invalid');
      return;
    }

    if (profile && profile.username.toLowerCase() === username) {
      setUsernameStatus('available');
      return;
    }

    setUsernameStatus('checking');
    const timeout = window.setTimeout(async () => {
      const { data, error: usernameError } = await supabase!.rpc('is_username_available', {
        candidate_username: username,
      });

      if (usernameError) {
        setError(usernameError.message);
        setUsernameStatus('idle');
      } else {
        setUsernameStatus(data ? 'available' : 'taken');
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [emailVerified, needsOnboarding, profile, profileForm.username, session]);

  useEffect(() => {
    if (!supabase || !session || !profile || !emailVerified || needsOnboarding) return;

    async function loadRecords() {
      setLoading(true);
      setError(null);

      const [incomingResult, myIncomingResult, outgoingResult, pendingResult] = await Promise.all([
        supabase!
          .from('community_donations_in')
          .select('id, user_id, donated_at, amount, reference_id, status, created_at, updated_at, donor_username, donor_reference_id')
          .order('donated_at', { ascending: false })
          .limit(100),
        supabase!
          .from('donations_in')
          .select('id, user_id, donated_at, amount, reference_id, status, created_at, updated_at, notes, document_id')
          .order('created_at', { ascending: false }),
        supabase!
          .from('community_donations_out')
          .select('id, donee_name, donated_at, amount, reference_id, status, created_at, updated_at')
          .order('donated_at', { ascending: false })
          .limit(100),
        isAdmin
          ? supabase!.from('donations_in').select('id', { count: 'exact', head: true }).eq('status', 'pending')
          : Promise.resolve({ count: 0, error: null }),
      ]);

      if (incomingResult.error || myIncomingResult.error || outgoingResult.error || pendingResult.error) {
        setError(
          incomingResult.error?.message ??
            myIncomingResult.error?.message ??
            outgoingResult.error?.message ??
            pendingResult.error?.message ??
            'Unable to load records.',
        );
      } else {
        setPublicDonations((incomingResult.data ?? []) as DonationIn[]);
        setMyDonations((myIncomingResult.data ?? []) as DonationIn[]);
        setDonationsOut((outgoingResult.data ?? []) as DonationOut[]);
        setPendingDonationCount(pendingResult.count ?? 0);
      }

      setLoading(false);
    }

    loadRecords();
  }, [emailVerified, isAdmin, needsOnboarding, profile, session]);

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setAuthLoading(true);
    setError(null);
    setAuthNotice(null);

    if (authMode === 'sign-in') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(
          signInError.message.toLowerCase().includes('email not confirmed')
            ? 'You need to verify your email before proceeding.'
            : signInError.message,
        );
      }
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else if (!data.session) {
        setAuthNotice('Check your email and verify your account before signing in.');
      } else {
        setAuthNotice('Account created.');
      }
    }

    setAuthLoading(false);
  }

  async function handleGoogleAuth() {
    if (!supabase) return;
    setAuthLoading(true);
    setError(null);

    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });

    if (googleError) setError(googleError.message);
    setAuthLoading(false);
  }

  async function handleResendVerification() {
    if (!supabase || !userEmail) return;

    setAuthLoading(true);
    setError(null);
    setAuthNotice(null);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: userEmail,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setAuthNotice('Verification email sent.');
    }

    setAuthLoading(false);
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setOnboardingStep(null);
    setToast(null);
    setPublicDonations([]);
    setMyDonations([]);
    setDonationsOut([]);
    setPendingDonationCount(0);
  }

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3600);
  }

  async function handleRequiredOnboardingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;

    setProfileLoading(true);
    setError(null);
    setToast(null);

    const username = profileForm.username.trim().toLowerCase();
    const mobile = profileForm.mobile.trim();
    const firstName = profileForm.first_name.trim();

    if (!isValidUsername(username)) {
      showToast('error', 'Username must be 3-24 characters and use only lowercase letters, numbers, or underscores.');
      setUsernameStatus('invalid');
      setProfileLoading(false);
      return;
    }

    if (!mobile) {
      showToast('error', 'Mobile number is required.');
      setProfileLoading(false);
      return;
    }

    if (!firstName) {
      showToast('error', 'First name is required.');
      setProfileLoading(false);
      return;
    }

    let usernameAvailable = profile?.username.toLowerCase() === username;
    let usernameError: { message: string } | null = null;

    if (!usernameAvailable) {
      const result = await supabase.rpc('is_username_available', {
        candidate_username: username,
      });

      usernameAvailable = Boolean(result.data);
      usernameError = result.error;
    }

    if (usernameError || !usernameAvailable) {
      showToast('error', usernameError?.message ?? 'Username is already taken.');
      setUsernameStatus(usernameError ? 'idle' : 'taken');
      setProfileLoading(false);
      return;
    }

    const nextProfile = {
      id: session.user.id,
      name: getDisplayName(firstName, profile?.last_name ?? ''),
      first_name: firstName,
      last_name: profile?.last_name ?? null,
      username,
      nic: profile?.nic ?? null,
      mobile,
      profile_image_url: profile?.profile_image_url ?? getDefaultProfileImageUrl(session),
      reference_id: profile?.reference_id ?? createReferenceId(session.user.id),
      role_id: profile?.role_id ?? 2,
    };

    const query = profile
      ? supabase.from('profiles').update(nextProfile).eq('id', session.user.id)
      : supabase.from('profiles').insert(nextProfile);

    const { data, error: saveError } = await query
      .select('id, name, first_name, last_name, username, nic, mobile, profile_image_url, reference_id, role_id')
      .single();

    if (saveError) {
      showToast('error', saveError.message);
    } else {
      setProfile(data as Profile);
      setOnboardingStep('optional');
      showToast('success', 'Profile basics saved.');
    }

    setProfileLoading(false);
  }

  async function handleOptionalOnboardingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session || !profile) return;

    setProfileLoading(true);
    setError(null);
    setToast(null);

    const lastName = profileForm.last_name.trim();
    const nic = profileForm.nic.trim();
    const firstName = profile.first_name || profileForm.first_name.trim();

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({
        last_name: lastName || null,
        nic: nic || null,
        name: getDisplayName(firstName, lastName),
      })
      .eq('id', session.user.id)
      .select('id, name, first_name, last_name, username, nic, mobile, profile_image_url, reference_id, role_id')
      .single();

    if (updateError) {
      showToast('error', updateError.message);
    } else {
      setProfile(data as Profile);
      setOnboardingStep(null);
      showToast('success', 'Onboarding complete.');
    }

    setProfileLoading(false);
  }

  function handleSkipOptionalOnboarding() {
    setOnboardingStep(null);
    showToast('success', 'Onboarding complete.');
  }

  function updateDonationForm(nextForm: DonationForm) {
    if (nextForm.donated_at !== donationForm.donated_at) {
      setDonationDocument(null);
      setDonationUploadStatus('idle');
    }

    setDonationForm(nextForm);
  }

  function updateDonationOutForm(nextForm: DonationOutForm) {
    if (nextForm.donated_at !== donationOutForm.donated_at) {
      setDonationOutDocument(null);
      setDonationOutUploadStatus('idle');
    }

    setDonationOutForm(nextForm);
  }

  async function handleDonationFileChange(file: File | null, type: 'in' | 'out') {
    if (type === 'in') {
      const nextForm = { ...donationForm, file };
      setDonationForm(nextForm);
      setDonationDocument(null);
      setDonationErrors((current) => ({ ...current, file: '' }));

      if (!file) {
        setDonationUploadStatus('idle');
        return;
      }

      if (!nextForm.donated_at) {
        setDonationUploadStatus('error');
        setDonationErrors((current) => ({ ...current, donated_at: 'Select donated date before uploading a document.' }));
        showToast('error', 'Select donated date before uploading a document.');
        return;
      }

      setDonationUploadStatus('uploading');
      const uploadedDocument = await uploadDonationDocument(nextForm, 'donation_in');
      if (uploadedDocument) {
        setDonationDocument(uploadedDocument);
        setDonationUploadStatus('uploaded');
      } else {
        setDonationUploadStatus('error');
      }
    } else {
      const nextForm = { ...donationOutForm, file };
      setDonationOutForm(nextForm);
      setDonationOutDocument(null);
      setDonationOutErrors((current) => ({ ...current, file: '' }));

      if (!file) {
        setDonationOutUploadStatus('idle');
        return;
      }

      if (!nextForm.donated_at) {
        setDonationOutUploadStatus('error');
        setDonationOutErrors((current) => ({ ...current, donated_at: 'Select donated date before uploading a document.' }));
        showToast('error', 'Select donated date before uploading a document.');
        return;
      }

      setDonationOutUploadStatus('uploading');
      const uploadedDocument = await uploadDonationDocument(nextForm, 'donation_out');
      if (uploadedDocument) {
        setDonationOutDocument(uploadedDocument);
        setDonationOutUploadStatus('uploaded');
      } else {
        setDonationOutUploadStatus('error');
      }
    }
  }

  async function handleDonationInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;

    const validationErrors = validateDonationForm(donationForm, donationDocument, donationUploadStatus);
    setDonationErrors(validationErrors);

    if (Object.keys(validationErrors).length) {
      showToast('error', 'Please complete the required donation fields.');
      return;
    }

    if (!donationDocument) return;

    setSavingDonation(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('donations_in')
      .insert({
        donated_at: new Date(donationForm.donated_at).toISOString(),
        amount: Number(donationForm.amount),
        reference_id: donationForm.reference_id.trim(),
        notes: donationForm.notes.trim() || null,
        document_id: donationDocument.id,
        status: 'pending',
      })
      .select('id, user_id, donated_at, amount, reference_id, status, created_at, updated_at, notes, document_id')
      .single();

    if (insertError) {
      showToast('error', insertError.message);
    } else {
      const createdDonation = data as DonationIn;
      setMyDonations((current) => [createdDonation, ...current]);
      setPublicDonations((current) => [
        {
          ...createdDonation,
          donor_username: profile?.username,
          donor_reference_id: profile?.reference_id,
        },
        ...current,
      ]);
      setDonationForm(emptyDonationForm);
      setDonationDocument(null);
      setDonationUploadStatus('idle');
      setDonationErrors({});
      showToast('success', 'Donation submitted for admin review.');
    }

    setSavingDonation(false);
  }

  async function handleDonationOutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;

    const validationErrors = validateDonationOutForm(donationOutForm, donationOutDocument, donationOutUploadStatus);
    setDonationOutErrors(validationErrors);

    if (Object.keys(validationErrors).length) {
      showToast('error', 'Please complete the required donation-out fields.');
      return;
    }

    if (!donationOutDocument) return;

    setSavingDonation(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('donations_out')
      .insert({
        donee_name: donationOutForm.donee_name.trim(),
        address: donationOutForm.address.trim() || null,
        donated_at: new Date(donationOutForm.donated_at).toISOString(),
        amount: Number(donationOutForm.amount),
        reference_id: donationOutForm.reference_id.trim(),
        notes: donationOutForm.notes.trim() || null,
        document_id: donationOutDocument.id,
        status: 'pending',
      })
      .select('id, donee_name, address, donated_at, amount, reference_id, status, created_at, updated_at, notes, document_id')
      .single();

    if (insertError) {
      showToast('error', insertError.message);
    } else {
      setDonationsOut((current) => [data as DonationOut, ...current]);
      setDonationOutForm(emptyDonationOutForm);
      setDonationOutDocument(null);
      setDonationOutUploadStatus('idle');
      setDonationOutErrors({});
      showToast('success', 'Donation out record created.');
    }

    setSavingDonation(false);
  }

  async function uploadDonationDocument(form: DonationForm, donationType: 'donation_in' | 'donation_out') {
    if (!supabase || !form.file) return null;

    const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
    if (!appsScriptUrl) {
      showToast('error', 'Apps Script URL is missing.');
      return null;
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      showToast('error', 'Please sign in again before uploading the document.');
      return null;
    }

    try {
      const base64 = await fileToBase64(form.file);
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'uploadDocument',
          accessToken,
          donationType,
          donatedAt: new Date(form.donated_at).toISOString(),
          fileName: form.file.name,
          mimeType: form.file.type,
          base64,
        }),
      });
      const result = await response.json();

      if (!result.ok) {
        showToast('error', result.error || 'Document upload failed.');
        return null;
      }

      return result.document as UploadedDocument;
    } catch (uploadError) {
      showToast('error', uploadError instanceof Error ? uploadError.message : 'Document upload failed.');
      return null;
    }
  }

  async function handleDonationInStatusChange(donation: DonationIn, status: DonationIn['status']) {
    if (!supabase || !isAdmin) return;

    const { data, error: updateError } = await supabase
      .from('donations_in')
      .update({ status })
      .eq('id', donation.id)
      .select('id, user_id, donated_at, amount, reference_id, status, created_at, updated_at, notes, document_id')
      .single();

    if (updateError) {
      showToast('error', updateError.message);
      return;
    }

    const updated = data as DonationIn;
    setPublicDonations((current) =>
      current.map((item) =>
        item.id === updated.id
          ? {
              ...item,
              status: updated.status,
              updated_at: updated.updated_at,
            }
          : item,
      ),
    );
    setMyDonations((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    setSelectedDonationIn((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
    setPendingDonationCount((current) =>
      status === 'pending' ? current : Math.max(0, current - (donation.status === 'pending' ? 1 : 0)),
    );
    showToast('success', 'Donation status updated.');
  }

  async function handleDonationOutUpdate(donationId: string, updates: Partial<DonationOut>) {
    if (!supabase || !isAdmin) return;

    const { data, error: updateError } = await supabase
      .from('donations_out')
      .update(updates)
      .eq('id', donationId)
      .select('id, donee_name, address, donated_at, amount, reference_id, status, created_at, updated_at, notes, document_id')
      .single();

    if (updateError) {
      showToast('error', updateError.message);
      return;
    }

    const updated = data as DonationOut;
    setDonationsOut((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedDonationOut(updated);
    showToast('success', 'Donation out record updated.');
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="app-shell centered">
        <Toast toast={toast} />
        <section className="auth-panel">
          <ShieldCheck aria-hidden="true" />
          <h1>Social Impact</h1>
          <p>Add your Supabase URL and publishable key in `.env.local` to start the app.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="app-shell centered">
        <Toast toast={toast} />
        <section className="auth-panel">
          <ShieldCheck aria-hidden="true" />
          <h1>Social Impact</h1>
          <p>Sign in to manage charity donation records.</p>

          <div className="auth-tabs" aria-label="Authentication mode">
            <button
              className={authMode === 'sign-in' ? 'active' : ''}
              type="button"
              onClick={() => {
                setAuthMode('sign-in');
                setError(null);
                setAuthNotice(null);
              }}
            >
              Sign in
            </button>
            <button
              className={authMode === 'sign-up' ? 'active' : ''}
              type="button"
              onClick={() => {
                setAuthMode('sign-up');
                setError(null);
                setAuthNotice(null);
              }}
            >
              Sign up
            </button>
          </div>

          <button className="primary-button" type="button" onClick={handleGoogleAuth} disabled={authLoading}>
            <Mail aria-hidden="true" />
            Continue with Google
          </button>

          <form className="auth-form" onSubmit={handleEmailAuth}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
            <button type="submit" disabled={authLoading}>
              {authMode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {authNotice && <p className="success-text">{authNotice}</p>}
          {error && <p className="error-text">{error}</p>}
        </section>
      </main>
    );
  }

  if (profileLoading && !profile) {
    return (
      <main className="app-shell centered">
        <Toast toast={toast} />
        <section className="auth-panel">
          <ShieldCheck aria-hidden="true" />
          <h1>Social Impact</h1>
          <p>Checking your profile...</p>
        </section>
      </main>
    );
  }

  if (!emailVerified) {
    return (
      <main className="app-shell centered">
        <Toast toast={toast} />
        <section className="auth-panel">
          <Mail aria-hidden="true" />
          <h1>Verify Email</h1>
          <p>You need to verify your email before proceeding.</p>
          <p className="muted">{userEmail}</p>

          <button className="primary-button" type="button" onClick={handleResendVerification} disabled={authLoading}>
            Resend verification email
          </button>

          <button className="text-button" type="button" onClick={handleSignOut}>
            Back to sign in
          </button>

          {authNotice && <p className="success-text">{authNotice}</p>}
          {error && <p className="error-text">{error}</p>}
        </section>
      </main>
    );
  }

  if (activeOnboardingStep === 'required') {
    return (
      <main className="app-shell centered">
        <Toast toast={toast} />
        <section className="auth-panel profile-panel">
          <UserRound aria-hidden="true" />
          <h1>Onboarding</h1>
          <p>{userEmail}</p>

          <form className="auth-form" onSubmit={handleRequiredOnboardingSubmit}>
            <input
              type="text"
              placeholder="First name"
              value={profileForm.first_name}
              onChange={(event) => setProfileForm({ ...profileForm, first_name: event.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Username"
              value={profileForm.username}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  username: event.target.value.toLowerCase().replace(/\s+/g, ''),
                })
              }
              required
            />
            <p className={`field-hint username-${usernameStatus}`}>{getUsernameMessage(usernameStatus)}</p>
            <input
              type="tel"
              placeholder="Mobile"
              value={profileForm.mobile}
              onChange={(event) => setProfileForm({ ...profileForm, mobile: event.target.value })}
              required
            />
            <button type="submit" disabled={profileLoading || usernameStatus !== 'available'}>
              Next
            </button>
          </form>

          <button className="text-button" type="button" onClick={handleSignOut}>
            Back to sign in
          </button>

        </section>
      </main>
    );
  }

  if (activeOnboardingStep === 'optional') {
    return (
      <main className="app-shell centered">
        <Toast toast={toast} />
        <section className="auth-panel profile-panel">
          <UserRound aria-hidden="true" />
          <h1>More Details</h1>
          <p>{userEmail}</p>

          <form className="auth-form" onSubmit={handleOptionalOnboardingSubmit}>
            <input
              type="text"
              placeholder="Last name optional"
              value={profileForm.last_name}
              onChange={(event) => setProfileForm({ ...profileForm, last_name: event.target.value })}
            />
            <input
              type="text"
              placeholder="NIC optional"
              value={profileForm.nic}
              onChange={(event) => setProfileForm({ ...profileForm, nic: event.target.value })}
            />
            <button type="submit" disabled={profileLoading}>
              Complete
            </button>
          </form>

          <button className="text-button" type="button" onClick={handleSkipOptionalOnboarding}>
            Skip
          </button>
        </section>
      </main>
    );
  }

  const completedProfile = profile;
  if (!completedProfile) return null;

  return (
    <div className="app-layout">
      <Toast toast={toast} />
      <header className="topbar">
        <div>
          <p className="eyebrow">Donation Records</p>
          <h1>Social Impact</h1>
        </div>
        {isAdmin && pendingDonationCount > 0 && (
          <button className="pending-banner" type="button" onClick={() => setActiveView('public-donations')}>
            {pendingDonationCount} pending
          </button>
        )}
        <button className="icon-button" type="button" onClick={handleSignOut} aria-label="Sign out">
          <LogOut aria-hidden="true" />
        </button>
      </header>

      <main className="content">
        <section className="welcome-strip">
          <div>
            <p className="eyebrow">Signed in</p>
            <strong>{completedProfile.name}</strong>
            <span className="muted">{userEmail}</span>
          </div>
          <Avatar profile={completedProfile} />
        </section>

        {error && <p className="error-banner">{error}</p>}

        {activeView === 'dashboard' && (
          <section className="grid-panels">
            <article className="metric-panel">
              <span>Community donations</span>
              <strong>{currency.format(totals.incomingTotal)}</strong>
              <small>{totals.incomingCount} successful records</small>
            </article>
            <article className="metric-panel">
              <span>Charity distributions</span>
              <strong>{currency.format(totals.outgoingTotal)}</strong>
              <small>{totals.outgoingCount} outgoing records</small>
            </article>
          </section>
        )}

        {activeView === 'my-donations' && (
          <section className="record-section">
            <h2>New Donation In</h2>
            <DonationInForm
              form={donationForm}
              errors={donationErrors}
              saving={savingDonation}
              uploadedDocument={donationDocument}
              uploadStatus={donationUploadStatus}
              onChange={updateDonationForm}
              onFileChange={(file) => handleDonationFileChange(file, 'in')}
              onSubmit={handleDonationInSubmit}
            />

            <h2 className="section-subtitle">My Donation Records</h2>
            {myDonations.length ? (
              <div className="record-list">
                {myDonations.map((donation) => (
                  <button className="record-item record-button" key={donation.id} onClick={() => setSelectedDonationIn(donation)}>
                    <div>
                      <strong>{donation.reference_id}</strong>
                      <span>{formatDate(donation.donated_at)}</span>
                    </div>
                    <div>
                      <strong>{currency.format(Number(donation.amount))}</strong>
                      <StatusPill status={donation.status} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="No personal donation records yet." />
            )}
          </section>
        )}

        {activeView === 'public-donations' && (
          <section className="record-section">
            <h2>Community Donations</h2>
            <ListControls
              search={communitySearch}
              sort={communitySort}
              placeholder="Search username, user ref, donation ref"
              onSearch={setCommunitySearch}
              onSort={setCommunitySort}
            />
            {loading ? (
              <p className="muted">Loading records...</p>
            ) : filteredCommunityDonations.length ? (
              <div className="record-list">
                {filteredCommunityDonations.map((donation) => (
                  <button className="record-item record-button" key={donation.id} onClick={() => setSelectedDonationIn(donation)}>
                    <div>
                      <strong>{donation.reference_id}</strong>
                      <span>{donation.donor_username ? `@${donation.donor_username}` : 'Community donation'}</span>
                    </div>
                    <div>
                      <strong>{currency.format(Number(donation.amount))}</strong>
                      <StatusPill status={donation.status} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="No community donation records found." />
            )}
          </section>
        )}

        {activeView === 'donations-out' && (
          <section className="record-section">
            <h2>Donations Out</h2>
            <ListControls
              search={outSearch}
              sort={outSort}
              placeholder="Search donee or donation ref"
              onSearch={setOutSearch}
              onSort={setOutSort}
            />
            {loading ? (
              <p className="muted">Loading records...</p>
            ) : filteredDonationsOut.length ? (
              <div className="record-list">
                {filteredDonationsOut.map((donation) => (
                  <button className="record-item record-button" key={donation.id} onClick={() => setSelectedDonationOut(donation)}>
                    <div>
                      <strong>{donation.donee_name}</strong>
                      <span>{formatDate(donation.donated_at)}</span>
                    </div>
                    <div>
                      <strong>{currency.format(Number(donation.amount))}</strong>
                      <StatusPill status={donation.status} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="No outgoing donation records yet." />
            )}
          </section>
        )}

        {activeView === 'admin-out' && isAdmin && (
          <section className="record-section">
            <h2>Create Donation Out</h2>
            <DonationOutFormView
              form={donationOutForm}
              errors={donationOutErrors}
              saving={savingDonation}
              uploadedDocument={donationOutDocument}
              uploadStatus={donationOutUploadStatus}
              onChange={updateDonationOutForm}
              onFileChange={(file) => handleDonationFileChange(file, 'out')}
              onSubmit={handleDonationOutSubmit}
            />
          </section>
        )}
      </main>

      {selectedDonationIn && (
        <DonationInModal
          donation={selectedDonationIn}
          isAdmin={isAdmin}
          isOwner={selectedDonationIn.user_id === session.user.id}
          onClose={() => setSelectedDonationIn(null)}
          onStatusChange={handleDonationInStatusChange}
        />
      )}

      {selectedDonationOut && (
        <DonationOutModal
          donation={selectedDonationOut}
          isAdmin={isAdmin}
          onClose={() => setSelectedDonationOut(null)}
          onSave={handleDonationOutUpdate}
        />
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={activeView === item.key ? 'active' : ''}
              type="button"
              key={item.key}
              onClick={() => setActiveView(item.key)}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function createReferenceId(userId: string) {
  return `USR-${userId.slice(0, 8).toUpperCase()}`;
}

function isValidUsername(username: string) {
  return /^[a-z0-9_]{3,24}$/.test(username);
}

function isProfileComplete(profile: Profile | null) {
  return Boolean(profile?.first_name?.trim() && profile.username?.trim() && profile.mobile?.trim());
}

function isEmailVerified(session: Session) {
  const identities = session.user.identities ?? [];
  const hasExternalProvider = identities.some((identity) => identity.provider !== 'email');

  return Boolean(session.user.email_confirmed_at || session.user.confirmed_at || hasExternalProvider);
}

function getUsernameMessage(status: UsernameStatus) {
  if (status === 'checking') return 'Checking username...';
  if (status === 'available') return 'Username is available.';
  if (status === 'taken') return 'Username is already obtained.';
  if (status === 'invalid') return 'Use 3-24 lowercase letters, numbers, or underscores.';
  return 'Choose a unique username.';
}

function getDefaultFirstName(session: Session) {
  const metadata = session.user.user_metadata;
  const fullName = String(metadata.full_name || metadata.name || '').trim();

  return metadata.given_name || fullName.split(/\s+/)[0] || getDefaultUsername(session);
}

function getDefaultLastName(session: Session) {
  const metadata = session.user.user_metadata;
  const fullName = String(metadata.full_name || metadata.name || '').trim();
  const [, ...rest] = fullName.split(/\s+/);

  return metadata.family_name || rest.join(' ');
}

function getDefaultUsername(session: Session) {
  return (session.user.email?.split('@')[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 24);
}

function getDisplayName(firstName: string, lastName: string | null | undefined) {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function getDefaultProfileImageUrl(session: Session) {
  const metadata = session.user.user_metadata;
  return metadata.avatar_url || metadata.picture || null;
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function Avatar({ profile }: { profile: Profile }) {
  if (profile.profile_image_url) {
    return <img className="avatar" src={profile.profile_image_url} alt="" />;
  }

  return <div className="avatar avatar-fallback">{getInitials(profile.name || profile.username)}</div>;
}

function RequiredLabel({ children }: { children: string }) {
  return (
    <label className="field-label">
      {children}
      <span aria-hidden="true">*</span>
    </label>
  );
}

function DonationInForm({
  form,
  errors,
  saving,
  uploadedDocument,
  uploadStatus,
  onChange,
  onFileChange,
  onSubmit,
}: {
  form: DonationForm;
  errors: FieldErrors;
  saving: boolean;
  uploadedDocument: UploadedDocument | null;
  uploadStatus: UploadStatus;
  onChange: (form: DonationForm) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="donation-form" onSubmit={onSubmit}>
      <FieldGroup error={errors.donated_at}>
        <RequiredLabel>Donated at</RequiredLabel>
        <input
          className={errors.donated_at ? 'field-error' : ''}
          type="date"
          value={form.donated_at}
          onChange={(event) => onChange({ ...form, donated_at: event.target.value })}
        />
      </FieldGroup>
      <FieldGroup error={errors.reference_id}>
        <RequiredLabel>Reference ID</RequiredLabel>
        <input
          className={errors.reference_id ? 'field-error' : ''}
          value={form.reference_id}
          onChange={(event) => onChange({ ...form, reference_id: event.target.value })}
        />
      </FieldGroup>
      <FieldGroup error={errors.amount}>
        <RequiredLabel>Amount</RequiredLabel>
        <input
          className={errors.amount ? 'field-error' : ''}
          type="number"
          min="1"
          step="0.01"
          value={form.amount}
          onChange={(event) => onChange({ ...form, amount: event.target.value })}
        />
      </FieldGroup>
      <FieldGroup error={errors.notes}>
        <label className="field-label">Notes</label>
        <textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
      </FieldGroup>
      <DocumentInput
        file={form.file}
        error={errors.file}
        uploadedDocument={uploadedDocument}
        uploadStatus={uploadStatus}
        onFileChange={onFileChange}
      />
      <button type="submit" disabled={saving || uploadStatus === 'uploading' || !uploadedDocument}>
        {saving ? 'Saving...' : 'Save Donation'}
      </button>
    </form>
  );
}

function DonationOutFormView({
  form,
  errors,
  saving,
  uploadedDocument,
  uploadStatus,
  onChange,
  onFileChange,
  onSubmit,
}: {
  form: DonationOutForm;
  errors: FieldErrors;
  saving: boolean;
  uploadedDocument: UploadedDocument | null;
  uploadStatus: UploadStatus;
  onChange: (form: DonationOutForm) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="donation-form" onSubmit={onSubmit}>
      <FieldGroup error={errors.donee_name}>
        <RequiredLabel>Donee name</RequiredLabel>
        <input
          className={errors.donee_name ? 'field-error' : ''}
          value={form.donee_name}
          onChange={(event) => onChange({ ...form, donee_name: event.target.value })}
        />
      </FieldGroup>
      <FieldGroup error={errors.address}>
        <label className="field-label">Address</label>
        <textarea value={form.address} onChange={(event) => onChange({ ...form, address: event.target.value })} />
      </FieldGroup>
      <FieldGroup error={errors.donated_at}>
        <RequiredLabel>Donated at</RequiredLabel>
        <input
          className={errors.donated_at ? 'field-error' : ''}
          type="date"
          value={form.donated_at}
          onChange={(event) => onChange({ ...form, donated_at: event.target.value })}
        />
      </FieldGroup>
      <FieldGroup error={errors.reference_id}>
        <RequiredLabel>Reference ID</RequiredLabel>
        <input
          className={errors.reference_id ? 'field-error' : ''}
          value={form.reference_id}
          onChange={(event) => onChange({ ...form, reference_id: event.target.value })}
        />
      </FieldGroup>
      <FieldGroup error={errors.amount}>
        <RequiredLabel>Amount</RequiredLabel>
        <input
          className={errors.amount ? 'field-error' : ''}
          type="number"
          min="1"
          step="0.01"
          value={form.amount}
          onChange={(event) => onChange({ ...form, amount: event.target.value })}
        />
      </FieldGroup>
      <FieldGroup error={errors.notes}>
        <label className="field-label">Notes</label>
        <textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
      </FieldGroup>
      <DocumentInput
        file={form.file}
        error={errors.file}
        uploadedDocument={uploadedDocument}
        uploadStatus={uploadStatus}
        onFileChange={onFileChange}
      />
      <button type="submit" disabled={saving || uploadStatus === 'uploading' || !uploadedDocument}>
        {saving ? 'Saving...' : 'Create Donation Out'}
      </button>
    </form>
  );
}

function FieldGroup({ children, error }: { children: ReactNode; error?: string }) {
  return (
    <div className="field-group">
      {children}
      {error && <p className="validation-message">{error}</p>}
    </div>
  );
}

function DocumentInput({
  file,
  error,
  uploadedDocument,
  uploadStatus,
  onFileChange,
}: {
  file: File | null;
  error?: string;
  uploadedDocument: UploadedDocument | null;
  uploadStatus: UploadStatus;
  onFileChange: (file: File | null) => void;
}) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  return (
    <FieldGroup error={error}>
      <RequiredLabel>Document</RequiredLabel>
      <input
        className={error ? 'field-error' : ''}
        type="file"
        accept="image/*,application/pdf"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
      {file && (
        <div className="document-preview">
          {uploadStatus === 'uploading' && (
            <div className="preview-overlay">
              <span className="spinner" />
            </div>
          )}
          {file.type.startsWith('image/') && previewUrl ? (
            <img src={previewUrl} alt="" />
          ) : (
            <div className="pdf-preview">PDF</div>
          )}
          <div>
            <strong>{file.name}</strong>
            <span>{Math.ceil(file.size / 1024)} KB</span>
            {uploadStatus === 'uploaded' && uploadedDocument && <span className="upload-ok">Uploaded</span>}
            {uploadStatus === 'error' && <span className="upload-error">Upload failed</span>}
          </div>
          <button type="button" onClick={() => onFileChange(null)}>
            Replace
          </button>
        </div>
      )}
    </FieldGroup>
  );
}

function ListControls({
  search,
  sort,
  placeholder,
  onSearch,
  onSort,
}: {
  search: string;
  sort: SortKey;
  placeholder: string;
  onSearch: (value: string) => void;
  onSort: (value: SortKey) => void;
}) {
  return (
    <div className="list-controls">
      <input placeholder={placeholder} value={search} onChange={(event) => onSearch(event.target.value)} />
      <select value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
        <option value="created_at">Created</option>
        <option value="updated_at">Updated</option>
        <option value="donated_at">Donated</option>
      </select>
    </div>
  );
}

function DonationInModal({
  donation,
  isAdmin,
  isOwner,
  onClose,
  onStatusChange,
}: {
  donation: DonationIn;
  isAdmin: boolean;
  isOwner: boolean;
  onClose: () => void;
  onStatusChange: (donation: DonationIn, status: DonationIn['status']) => void;
}) {
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <button className="modal-close" type="button" onClick={onClose}>
          Close
        </button>
        <h2>{donation.reference_id}</h2>
        <DetailRow label="Amount" value={currency.format(Number(donation.amount))} />
        <DetailRow label="Donated at" value={formatDate(donation.donated_at)} />
        <DetailRow label="Status" value={donation.status} />
        <DetailRow label="Created" value={formatDate(donation.created_at)} />
        {(isAdmin || isOwner) && <DetailRow label="User ID" value={donation.user_id} />}
        {donation.donor_username && <DetailRow label="Username" value={`@${donation.donor_username}`} />}
        {isAdmin && (
          <div className="field-group">
            <label className="field-label">Admin status</label>
            <select value={donation.status} onChange={(event) => onStatusChange(donation, event.target.value as DonationIn['status'])}>
              <option value="pending">Pending</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        )}
      </section>
    </div>
  );
}

function DonationOutModal({
  donation,
  isAdmin,
  onClose,
  onSave,
}: {
  donation: DonationOut;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (donationId: string, updates: Partial<DonationOut>) => void;
}) {
  const [editForm, setEditForm] = useState({
    donee_name: donation.donee_name,
    address: donation.address ?? '',
    donated_at: donation.donated_at.slice(0, 10),
    amount: String(donation.amount),
    reference_id: donation.reference_id,
    status: donation.status,
    notes: donation.notes ?? '',
  });

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onSave(donation.id, {
      donee_name: editForm.donee_name.trim(),
      address: editForm.address.trim() || null,
      donated_at: new Date(editForm.donated_at).toISOString(),
      amount: Number(editForm.amount),
      reference_id: editForm.reference_id.trim(),
      status: editForm.status,
      notes: editForm.notes.trim() || null,
    });
  }

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <button className="modal-close" type="button" onClick={onClose}>
          Close
        </button>
        <h2>{donation.donee_name}</h2>
        <DetailRow label="Amount" value={currency.format(Number(donation.amount))} />
        <DetailRow label="Reference" value={donation.reference_id} />
        <DetailRow label="Donated at" value={formatDate(donation.donated_at)} />
        <DetailRow label="Status" value={donation.status} />
        {donation.address && <DetailRow label="Address" value={donation.address} />}
        {donation.notes && <DetailRow label="Notes" value={donation.notes} />}
        {isAdmin && (
          <form className="donation-form modal-edit" onSubmit={handleSave}>
            <FieldGroup>
              <RequiredLabel>Donee name</RequiredLabel>
              <input value={editForm.donee_name} onChange={(event) => setEditForm({ ...editForm, donee_name: event.target.value })} />
            </FieldGroup>
            <FieldGroup>
              <label className="field-label">Address</label>
              <textarea value={editForm.address} onChange={(event) => setEditForm({ ...editForm, address: event.target.value })} />
            </FieldGroup>
            <FieldGroup>
              <RequiredLabel>Donated at</RequiredLabel>
              <input type="date" value={editForm.donated_at} onChange={(event) => setEditForm({ ...editForm, donated_at: event.target.value })} />
            </FieldGroup>
            <FieldGroup>
              <RequiredLabel>Amount</RequiredLabel>
              <input type="number" min="1" step="0.01" value={editForm.amount} onChange={(event) => setEditForm({ ...editForm, amount: event.target.value })} />
            </FieldGroup>
            <FieldGroup>
              <RequiredLabel>Reference ID</RequiredLabel>
              <input value={editForm.reference_id} onChange={(event) => setEditForm({ ...editForm, reference_id: event.target.value })} />
            </FieldGroup>
            <FieldGroup>
              <label className="field-label">Status</label>
              <select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as DonationOut['status'] })}>
                <option value="pending">Pending</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </FieldGroup>
            <FieldGroup>
              <label className="field-label">Notes</label>
              <textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} />
            </FieldGroup>
            <button type="submit">Save changes</button>
          </form>
        )}
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function validateDonationForm(form: DonationForm, uploadedDocument: UploadedDocument | null, uploadStatus: UploadStatus) {
  const errors: FieldErrors = {};

  if (!form.donated_at) errors.donated_at = 'Donated date is required.';
  if (!form.reference_id.trim()) errors.reference_id = 'Reference ID is required.';
  if (!form.amount || Number(form.amount) <= 0) errors.amount = 'Amount must be greater than zero.';
  if (!form.file) errors.file = 'Document is required.';
  if (form.file && uploadStatus === 'uploading') errors.file = 'Document is still uploading.';
  if (form.file && uploadStatus === 'error') errors.file = 'Document upload failed. Replace the file and try again.';
  if (form.file && uploadStatus !== 'uploading' && !uploadedDocument) errors.file = 'Document must be uploaded before saving.';
  if (form.file && !isValidDocumentFile(form.file)) errors.file = 'Upload an image or PDF document.';

  return errors;
}

function validateDonationOutForm(form: DonationOutForm, uploadedDocument: UploadedDocument | null, uploadStatus: UploadStatus) {
  const errors = validateDonationForm(form, uploadedDocument, uploadStatus);
  if (!form.donee_name.trim()) errors.donee_name = 'Donee name is required.';

  return errors;
}

function isValidDocumentFile(file: File) {
  return file.type.startsWith('image/') || file.type === 'application/pdf';
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function filterAndSortIncoming(records: DonationIn[], search: string, sort: SortKey) {
  const query = search.trim().toLowerCase();

  return [...records]
    .filter((record) => {
      if (!query) return true;
      return [record.reference_id, record.donor_username, record.donor_reference_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((a, b) => new Date(b[sort]).getTime() - new Date(a[sort]).getTime());
}

function filterAndSortOutgoing(records: DonationOut[], search: string, sort: SortKey) {
  const query = search.trim().toLowerCase();

  return [...records]
    .filter((record) => {
      if (!query) return true;
      return [record.reference_id, record.donee_name].some((value) => value.toLowerCase().includes(query));
    })
    .sort((a, b) => new Date(b[sort]).getTime() - new Date(a[sort]).getTime());
}
