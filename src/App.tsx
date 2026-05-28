import {
  FormEvent,
  PointerEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  GripVertical,
  HandCoins,
  Heart,
  Home,
  Image as ImageIcon,
  Mail,
  Plus,
  Printer,
  ShieldCheck,
  TrendingUp,
  UserRound,
  UsersRound,
  Video,
  WalletCards,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type ViewKey =
  | "dashboard"
  | "my-donations"
  | "public-donations"
  | "donations-out"
  | "admin-out";
type AuthMode = "sign-in" | "sign-up";
type AdminCreateMode = "donation_out" | "donation_in" | "users" | "deleted";
type OnboardingStep = "required" | "optional" | null;
type ToastState = { type: "success" | "error"; message: string } | null;
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";
type UploadStatus = "idle" | "uploading" | "uploaded" | "error";
type DonationMethod = "online" | "cash" | "other";

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
  is_active: boolean;
};

type PublicDonationIn = {
  id: string;
  user_id: string | null;
  donated_at: string;
  amount_cents: number;
  method: DonationMethod;
  reference_id: string;
  status: "pending" | "success" | "failed";
  created_at: string;
  updated_at: string;
  document_id: string | null;
  is_own: boolean;
  donor_username: string | null;
  donor_reference_id: string;
};

type DonationOut = {
  id: string;
  donee_name: string;
  address?: string | null;
  donated_at: string;
  amount_cents: number;
  method: DonationMethod;
  reference_id: string;
  status: "pending" | "success" | "failed";
  created_at: string;
  updated_at: string;
  notes?: string | null;
  document_id?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

type DonationOutDetail = {
  id: string;
  donation_out_id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  contact_info: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type DonationOutMedia = {
  id: string;
  donation_out_id: string;
  document_id: string;
  media_type: "image" | "video";
  file_name: string;
  mime_type: string;
  caption: string | null;
  thumbnail_data_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type PublicDonationOutPage = {
  id: string;
  donee_name: string;
  donated_at: string;
  amount_cents: number;
  method: DonationMethod;
  reference_id: string;
  detail_id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  contact_info: string | null;
  detail_updated_at: string;
};

type PublicOrganizationStats = {
  donation_distribution_count: number;
  member_count: number;
  documented_support_total_cents: number;
};

type DonationIn = {
  id: string;
  user_id: string | null;
  donated_at: string;
  amount_cents: number;
  method: DonationMethod;
  reference_id: string;
  status: "pending" | "success" | "failed";
  created_at: string;
  updated_at: string;
  notes?: string | null;
  document_id?: string | null;
  donor_username?: string | null;
  donor_reference_id?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

type DonationForm = {
  donated_at: string;
  amount: string;
  method: DonationMethod;
  reference_id: string;
  notes: string;
  file: File | null;
};

type DonationOutForm = DonationForm & {
  donee_name: string;
  address: string;
};

type DonorOption = {
  id: string;
  name: string;
  username: string;
  reference_id: string;
};

type AdminUser = DonorOption & {
  mobile: string;
  role_id: number;
  is_active: boolean;
};

type SortKey = "created_at" | "updated_at" | "donated_at";

type FieldErrors = Record<string, string>;
type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
} | null;

type DashboardMonth = {
  key: string;
  label: string;
  contributions: number;
  distributions: number;
};

type DashboardActivity = {
  id: string;
  kind: "Contribution" | "Distribution";
  label: string;
  amount: number;
  date: string;
};

type UploadedDocument = {
  id: string;
  drive_file_id: string;
  url: string;
  file_name: string;
  mime_type: string;
};

type PreviewDocument = UploadedDocument & {
  base64: string;
};

const navItems: Array<{ key: ViewKey; label: string; icon: typeof Home }> = [
  { key: "dashboard", label: "Home", icon: Home },
  { key: "my-donations", label: "My", icon: Heart },
  { key: "public-donations", label: "Community", icon: UsersRound },
  { key: "donations-out", label: "Donations", icon: HandCoins },
];

const emptyDonationForm: DonationForm = {
  donated_at: "",
  amount: "",
  method: "online",
  reference_id: "",
  notes: "",
  file: null,
};

const emptyDonationOutForm: DonationOutForm = {
  ...emptyDonationForm,
  donee_name: "",
  address: "",
};

const emptyDonationOutDetailForm = {
  title: "",
  subtitle: "",
  description: "",
  contact_info: "",
  is_published: false,
};

const COMMUNITY_DONOR_ID = "00000000-0000-4000-8000-000000000001";

const currency = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-LK", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const monthFormatter = new Intl.DateTimeFormat("en-LK", {
  month: "short",
  year: "2-digit",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatDonationMethod(method: DonationMethod) {
  if (method === "online") return "Online transfer";
  if (method === "cash") return "Cash";
  return "Other";
}

function StatusPill({ status }: { status: "pending" | "success" | "failed" }) {
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

function ConfirmModal({
  action,
  onCancel,
  onConfirm,
}: {
  action: NonNullable<ConfirmState>;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <section
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{action.title}</h2>
        <p>{action.message}</p>
        <div className="confirm-actions">
          <button className="secondary-action" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`secondary-action ${action.danger ? "danger-action" : ""}`}
            type="button"
            onClick={onConfirm}
          >
            {action.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function PublicShell({
  authPanel,
  children,
  detail,
  detailDonation,
  detailDonationOutId,
  detailMedia,
  error,
  loading,
  onCloseAuth,
  onOpenSignIn,
  onOpenSignUp,
  publicDataLoaded,
  slides,
  stats,
}: {
  authPanel: ReactNode;
  children: ReactNode;
  detail: DonationOutDetail | null;
  detailDonation: DonationOut | null;
  detailDonationOutId: string | null;
  detailMedia: DonationOutMedia[];
  error: string | null;
  loading: boolean;
  onCloseAuth: () => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  publicDataLoaded: boolean;
  slides: Array<{
    donation: DonationOut;
    detail: DonationOutDetail;
    cover: DonationOutMedia;
  }>;
  stats: PublicOrganizationStats | null;
}) {
  return (
    <div className="app-layout public-layout">
      {children}
      <header className="topbar public-topbar">
        <div className="brand-block">
          <p className="eyebrow">Donation Records</p>
          <h1>Social Impact</h1>
        </div>
        <div className="public-auth-actions">
          <button className="secondary-action" type="button" onClick={onOpenSignIn}>
            Sign in
          </button>
          <button className="primary-action-inline" type="button" onClick={onOpenSignUp}>
            Sign up
          </button>
        </div>
      </header>

      <main className="content public-content">
        {error && <p className="error-banner">{error}</p>}

        {detailDonationOutId ? (
          !detailDonation && (loading || !publicDataLoaded) ? (
            <section className="record-section">
              <EmptyState title="Loading donation page..." />
            </section>
          ) : (
            <DonationOutDetailPage
              donation={detailDonation}
              detail={detail}
              media={detailMedia}
              isAdmin={false}
            />
          )
        ) : (
          <PublicHomePage slides={slides} stats={stats} />
        )}
      </main>

      {authPanel && (
        <div className="modal-backdrop public-auth-backdrop" onClick={onCloseAuth}>
          {authPanel}
        </div>
      )}
    </div>
  );
}

function PublicHomePage({
  slides,
  stats,
}: {
  slides: Array<{
    donation: DonationOut;
    detail: DonationOutDetail;
    cover: DonationOutMedia;
  }>;
  stats: PublicOrganizationStats | null;
}) {
  const distributionCount =
    stats?.donation_distribution_count ?? slides.length;
  const documentedSupport = centsToCurrency(
    stats?.documented_support_total_cents ??
      slides.reduce((sum, slide) => sum + slide.donation.amount_cents, 0),
  );

  return (
    <>
      <DonationOutHeroCarousel slides={slides} />

      <section className="public-intro">
        <div>
          <p className="eyebrow">Community impact</p>
          <h2>Transparent support for people who need it most.</h2>
          <p>
            This site helps our charity organization keep donation records
            documented. Sign up to become a member.
          </p>
        </div>
        <div className="public-intro-stats" aria-label="Public organization summary">
          <article>
            <span>Donation distributions</span>
            <strong>{distributionCount}</strong>
          </article>
          <article>
            <span>Members</span>
            <strong>{stats ? stats.member_count : "Pending"}</strong>
          </article>
          <article>
            <span>Documented support</span>
            <strong>{currency.format(documentedSupport)}</strong>
          </article>
        </div>
      </section>
    </>
  );
}

function GoogleMark() {
  return (
    <span className="google-mark" aria-hidden="true">
      G
    </span>
  );
}

function AuthPanel({
  authLoading,
  authMode,
  authNotice,
  email,
  error,
  onEmailChange,
  onGoogleAuth,
  onModeChange,
  onPasswordChange,
  onSubmit,
  password,
}: {
  authLoading: boolean;
  authMode: AuthMode;
  authNotice: string | null;
  email: string;
  error: string | null;
  onEmailChange: (value: string) => void;
  onGoogleAuth: () => void;
  onModeChange: (mode: AuthMode) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
}) {
  return (
    <section className="auth-panel">
      <ShieldCheck aria-hidden="true" />
      <h1>Social Impact</h1>
      <p>Sign in to manage charity donation records.</p>

      <div className="auth-tabs" aria-label="Authentication mode">
        <button
          className={authMode === "sign-in" ? "active" : ""}
          type="button"
          onClick={() => onModeChange("sign-in")}
        >
          Sign in
        </button>
        <button
          className={authMode === "sign-up" ? "active" : ""}
          type="button"
          onClick={() => onModeChange("sign-up")}
        >
          Sign up
        </button>
      </div>

      <button
        className="primary-button google-button"
        type="button"
        onClick={onGoogleAuth}
        disabled={authLoading}
      >
        <GoogleMark />
        Continue with Google
      </button>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          minLength={6}
          required
        />
        <button type="submit" disabled={authLoading}>
          {authMode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>

      {authNotice && <p className="success-text">{authNotice}</p>}
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [publicDonations, setPublicDonations] = useState<PublicDonationIn[]>(
    [],
  );
  const [myDonations, setMyDonations] = useState<DonationIn[]>([]);
  const [donationsOut, setDonationsOut] = useState<DonationOut[]>([]);
  const [donationOutDetails, setDonationOutDetails] = useState<
    DonationOutDetail[]
  >([]);
  const [donationOutMedia, setDonationOutMedia] = useState<DonationOutMedia[]>(
    [],
  );
  const [deletedDonationsIn, setDeletedDonationsIn] = useState<DonationIn[]>(
    [],
  );
  const [deletedDonationsOut, setDeletedDonationsOut] = useState<DonationOut[]>(
    [],
  );
  const [showMineDonationForm, setShowMineDonationForm] = useState(false);
  const [selectedDonationIn, setSelectedDonationIn] = useState<
    DonationIn | PublicDonationIn | null
  >(null);
  const [selectedDonationOut, setSelectedDonationOut] =
    useState<DonationOut | null>(null);
  const [detailDonationOutId, setDetailDonationOutId] = useState<string | null>(
    getDonationOutIdFromHash(),
  );
  const [pendingDonationCount, setPendingDonationCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [publicDataLoaded, setPublicDataLoaded] = useState(false);
  const [publicStats, setPublicStats] =
    useState<PublicOrganizationStats | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingDonation, setSavingDonation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmState>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [publicAuthOpen, setPublicAuthOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [adminCreateMode, setAdminCreateMode] =
    useState<AdminCreateMode>("donation_out");
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    nic: "",
    mobile: "",
  });
  const [donationForm, setDonationForm] =
    useState<DonationForm>(emptyDonationForm);
  const [adminDonationForm, setAdminDonationForm] =
    useState<DonationForm>(emptyDonationForm);
  const [donationOutForm, setDonationOutForm] =
    useState<DonationOutForm>(emptyDonationOutForm);
  const [donationDocument, setDonationDocument] =
    useState<UploadedDocument | null>(null);
  const [adminDonationDocument, setAdminDonationDocument] =
    useState<UploadedDocument | null>(null);
  const [donationOutDocument, setDonationOutDocument] =
    useState<UploadedDocument | null>(null);
  const [donationUploadStatus, setDonationUploadStatus] =
    useState<UploadStatus>("idle");
  const [adminDonationUploadStatus, setAdminDonationUploadStatus] =
    useState<UploadStatus>("idle");
  const [donationOutUploadStatus, setDonationOutUploadStatus] =
    useState<UploadStatus>("idle");
  const [donationErrors, setDonationErrors] = useState<FieldErrors>({});
  const [adminDonationErrors, setAdminDonationErrors] = useState<FieldErrors>(
    {},
  );
  const [donationOutErrors, setDonationOutErrors] = useState<FieldErrors>({});
  const [donorOptions, setDonorOptions] = useState<DonorOption[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminDonationUserId, setAdminDonationUserId] =
    useState(COMMUNITY_DONOR_ID);
  const [communitySearch, setCommunitySearch] = useState("");
  const [communitySort, setCommunitySort] = useState<SortKey>("created_at");
  const [outSearch, setOutSearch] = useState("");
  const [outSort, setOutSort] = useState<SortKey>("created_at");

  const userEmail = session?.user.email ?? "";
  const emailVerified = session ? isEmailVerified(session) : false;
  const needsOnboarding = Boolean(
    session && emailVerified && (!profile || !isProfileComplete(profile)),
  );
  const activeOnboardingStep = needsOnboarding ? "required" : onboardingStep;
  const isAdmin = profile?.role_id === 1;
  const visibleNavItems = useMemo(
    () =>
      isAdmin
        ? [
            ...navItems,
            { key: "admin-out" as ViewKey, label: "Admin", icon: Plus },
          ]
        : navItems,
    [isAdmin],
  );

  const filteredCommunityDonations = useMemo(
    () =>
      filterAndSortIncoming(publicDonations, communitySearch, communitySort),
    [communitySearch, communitySort, publicDonations],
  );

  const filteredDonationsOut = useMemo(
    () => filterAndSortOutgoing(donationsOut, outSearch, outSort),
    [donationsOut, outSearch, outSort],
  );

  const totals = useMemo(() => {
    const successfulIncoming = publicDonations.filter(
      (donation) => donation.status === "success",
    );
    const successfulOutgoing = donationsOut.filter(
      (donation) => donation.status === "success",
    );
    const incomingTotal = successfulIncoming.reduce(
      (sum, donation) => sum + centsToCurrency(donation.amount_cents),
      0,
    );
    const outgoingTotal = successfulOutgoing.reduce(
      (sum, donation) => sum + centsToCurrency(donation.amount_cents),
      0,
    );

    return {
      incomingTotal,
      outgoingTotal,
      incomingCount: successfulIncoming.length,
      outgoingCount: successfulOutgoing.length,
    };
  }, [donationsOut, publicDonations]);

  const dashboardMonths = useMemo(
    () => buildMonthlyFlow(publicDonations, donationsOut),
    [donationsOut, publicDonations],
  );

  const dashboardActivity = useMemo(
    () => buildDashboardActivity(publicDonations, donationsOut),
    [donationsOut, publicDonations],
  );

  const dashboardImpact = useMemo(() => {
    const successfulIncoming = publicDonations.filter(
      (donation) => donation.status === "success",
    );
    const contributorCount = new Set(
      successfulIncoming.map((donation) => donation.donor_reference_id),
    ).size;
    const communityDonorTotal = successfulIncoming
      .filter((donation) => isCommunityDonorContribution(donation))
      .reduce((sum, donation) => sum + centsToCurrency(donation.amount_cents), 0);
    const userContributionTotal = successfulIncoming
      .filter((donation) => !isCommunityDonorContribution(donation))
      .reduce((sum, donation) => sum + centsToCurrency(donation.amount_cents), 0);

    return {
      contributorCount,
      communityDonorTotal,
      userContributionTotal,
      availableBalance: totals.incomingTotal - totals.outgoingTotal,
    };
  }, [publicDonations, totals.incomingTotal, totals.outgoingTotal]);

  const donationOutPageSlides = useMemo(
    () =>
      donationsOut
        .filter((donation) => donation.status === "success")
        .map((donation) => {
          const detail = donationOutDetails.find(
            (item) => item.donation_out_id === donation.id && item.is_published,
          );
          const cover = donationOutMedia
            .filter(
              (item) =>
                item.donation_out_id === donation.id &&
                item.media_type === "image",
            )
            .sort((first, second) => first.sort_order - second.sort_order)[0];

          return detail && cover ? { donation, detail, cover } : null;
        })
        .filter(Boolean)
        .slice(0, 6) as Array<{
        donation: DonationOut;
        detail: DonationOutDetail;
        cover: DonationOutMedia;
      }>,
    [donationOutDetails, donationOutMedia, donationsOut],
  );

  const selectedDetailDonationOut = detailDonationOutId
    ? (donationsOut.find((donation) => donation.id === detailDonationOutId) ??
      null)
    : null;

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
    const handleHashChange = () => {
      setDetailDonationOutId(getDonationOutIdFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!supabase || session) return;

    async function loadPublicDonationPages() {
      setLoading(true);
      setPublicDataLoaded(false);
      setError(null);

      const [pagesResult, mediaResult, statsResult] = await Promise.all([
        supabase!
          .from("public_donation_out_pages")
          .select(
            "id, donee_name, donated_at, amount_cents, method, reference_id, detail_id, title, subtitle, description, contact_info, detail_updated_at",
          )
          .order("donated_at", { ascending: false })
          .limit(24),
        supabase!
          .from("public_donation_out_page_media")
          .select(
            "id, donation_out_id, media_type, file_name, mime_type, caption, thumbnail_data_url, sort_order, created_at, updated_at",
          )
          .order("sort_order", { ascending: true }),
        supabase!
          .from("public_organization_stats")
          .select(
            "donation_distribution_count, member_count, documented_support_total_cents",
          )
          .maybeSingle(),
      ]);

      if (pagesResult.error || mediaResult.error) {
        setError(
          pagesResult.error?.message ??
            mediaResult.error?.message ??
            "Unable to load public donation pages.",
        );
      } else {
        const pages = (pagesResult.data ?? []) as PublicDonationOutPage[];
        setPublicStats(
          statsResult.error
            ? null
            : (statsResult.data as PublicOrganizationStats | null),
        );
        setDonationsOut(
          pages.map((page) => ({
            id: page.id,
            donee_name: page.donee_name,
            donated_at: page.donated_at,
            amount_cents: page.amount_cents,
            method: page.method,
            reference_id: page.reference_id,
            status: "success",
            created_at: page.detail_updated_at,
            updated_at: page.detail_updated_at,
          })),
        );
        setDonationOutDetails(
          pages.map((page) => ({
            id: page.detail_id,
            donation_out_id: page.id,
            title: page.title,
            subtitle: page.subtitle,
            description: page.description,
            contact_info: page.contact_info,
            is_published: true,
            created_at: page.detail_updated_at,
            updated_at: page.detail_updated_at,
          })),
        );
        setDonationOutMedia(
          (mediaResult.data ?? []).map((item) => ({
            ...item,
            document_id: "",
          })) as DonationOutMedia[],
        );
      }

      setLoading(false);
      setPublicDataLoaded(true);
    }

    loadPublicDonationPages();
  }, [session]);

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
        .from("profiles")
        .select(
          "id, name, first_name, last_name, username, nic, mobile, profile_image_url, reference_id, role_id, is_active",
        )
        .eq("id", session!.user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
      } else if (data && !data.is_active) {
        setProfile(null);
        setError(
          "Your account is deactivated. Please contact an admin to activate it again.",
        );
        await supabase!.auth.signOut();
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
      first_name:
        current.first_name ||
        profile?.first_name ||
        getDefaultFirstName(session),
      last_name:
        current.last_name || profile?.last_name || getDefaultLastName(session),
      username:
        current.username || profile?.username || getDefaultUsername(session),
      nic: current.nic || profile?.nic || "",
      mobile: current.mobile || profile?.mobile || "",
    }));
  }, [emailVerified, needsOnboarding, profile, session]);

  useEffect(() => {
    if (!supabase || !session || !emailVerified || !needsOnboarding) return;

    const username = profileForm.username.trim().toLowerCase();

    if (!username) {
      setUsernameStatus("idle");
      return;
    }

    if (!isValidUsername(username)) {
      setUsernameStatus("invalid");
      return;
    }

    if (profile && profile.username.toLowerCase() === username) {
      setUsernameStatus("available");
      return;
    }

    setUsernameStatus("checking");
    const timeout = window.setTimeout(async () => {
      const { data, error: usernameError } = await supabase!.rpc(
        "is_username_available",
        {
          candidate_username: username,
        },
      );

      if (usernameError) {
        setError(usernameError.message);
        setUsernameStatus("idle");
      } else {
        setUsernameStatus(data ? "available" : "taken");
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [emailVerified, needsOnboarding, profile, profileForm.username, session]);

  useEffect(() => {
    if (!supabase || !session || !profile || !emailVerified || needsOnboarding)
      return;

    async function loadRecords() {
      setLoading(true);
      setError(null);

      const [
        incomingResult,
        myIncomingResult,
        outgoingResult,
        detailsResult,
        mediaResult,
        pendingResult,
        usersResult,
        deletedInResult,
        deletedOutResult,
      ] = await Promise.all([
        supabase!
          .from("community_donations_in")
          .select(
            "id, user_id, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, document_id, is_own, donor_username, donor_reference_id",
          )
          .order("donated_at", { ascending: false })
          .limit(100),
        supabase!
          .from("donations_in")
          .select(
            "id, user_id, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id, deleted_at, deleted_by",
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase!
          .from("community_donations_out")
          .select(
            "id, donee_name, donated_at, amount_cents, method, reference_id, status, created_at, updated_at",
          )
          .order("donated_at", { ascending: false })
          .limit(100),
        supabase!
          .from("donation_out_details")
          .select(
            "id, donation_out_id, title, subtitle, description, contact_info, is_published, created_at, updated_at",
          )
          .order("updated_at", { ascending: false }),
        supabase!
          .from("donation_out_media")
          .select(
            "id, donation_out_id, document_id, media_type, file_name, mime_type, caption, thumbnail_data_url, sort_order, created_at, updated_at",
          )
          .order("sort_order", { ascending: true }),
        isAdmin
          ? supabase!
              .from("donations_in")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending")
              .is("deleted_at", null)
          : Promise.resolve({ count: 0, error: null }),
        isAdmin
          ? supabase!
              .from("profiles")
              .select(
                "id, name, username, reference_id, mobile, role_id, is_active",
              )
              .order("username", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        isAdmin
          ? supabase!
              .from("donations_in")
              .select(
                "id, user_id, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id, deleted_at, deleted_by",
              )
              .not("deleted_at", "is", null)
              .order("deleted_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        isAdmin
          ? supabase!
              .from("donations_out")
              .select(
                "id, donee_name, address, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id, deleted_at, deleted_by",
              )
              .not("deleted_at", "is", null)
              .order("deleted_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (
        incomingResult.error ||
        myIncomingResult.error ||
        outgoingResult.error ||
        detailsResult.error ||
        mediaResult.error ||
        pendingResult.error ||
        usersResult.error ||
        deletedInResult.error ||
        deletedOutResult.error
      ) {
        setError(
          incomingResult.error?.message ??
            myIncomingResult.error?.message ??
            outgoingResult.error?.message ??
            detailsResult.error?.message ??
            mediaResult.error?.message ??
            pendingResult.error?.message ??
            usersResult.error?.message ??
            deletedInResult.error?.message ??
            deletedOutResult.error?.message ??
            "Unable to load records.",
        );
      } else {
        setPublicDonations((incomingResult.data ?? []) as PublicDonationIn[]);
        setMyDonations((myIncomingResult.data ?? []) as DonationIn[]);
        setDonationsOut((outgoingResult.data ?? []) as DonationOut[]);
        setDonationOutDetails(
          (detailsResult.data ?? []) as DonationOutDetail[],
        );
        setDonationOutMedia((mediaResult.data ?? []) as DonationOutMedia[]);
        setPendingDonationCount(pendingResult.count ?? 0);
        const users = (usersResult.data ?? []) as AdminUser[];
        setAdminUsers(users);
        setDonorOptions(
          users.filter(
            (user) => user.is_active || user.id === COMMUNITY_DONOR_ID,
          ),
        );
        setDeletedDonationsIn((deletedInResult.data ?? []) as DonationIn[]);
        setDeletedDonationsOut((deletedOutResult.data ?? []) as DonationOut[]);
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

    if (authMode === "sign-in") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(
          signInError.message.toLowerCase().includes("email not confirmed")
            ? "You need to verify your email before proceeding."
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
        setAuthNotice(
          "Check your email and verify your account before signing in.",
        );
      } else {
        setAuthNotice("Account created.");
      }
    }

    setAuthLoading(false);
  }

  async function handleGoogleAuth() {
    if (!supabase) return;
    setAuthLoading(true);
    setError(null);

    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
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
      type: "signup",
      email: userEmail,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setAuthNotice("Verification email sent.");
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
    setDonationOutDetails([]);
    setDonationOutMedia([]);
    setPublicDataLoaded(false);
    setPublicStats(null);
    setDeletedDonationsIn([]);
    setDeletedDonationsOut([]);
    window.location.hash = "";
    setDonorOptions([]);
    setAdminUsers([]);
    setAdminDonationUserId(COMMUNITY_DONOR_ID);
    setPendingDonationCount(0);
  }

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3600);
  }

  function openDonationOutPage(donationId: string) {
    setSelectedDonationOut(null);
    window.location.hash = `out/${donationId}`;
    setDetailDonationOutId(donationId);
  }

  async function handleRequiredOnboardingSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!supabase || !session) return;

    setProfileLoading(true);
    setError(null);
    setToast(null);

    const username = profileForm.username.trim().toLowerCase();
    const mobile = profileForm.mobile.trim();
    const firstName = profileForm.first_name.trim();

    if (!isValidUsername(username)) {
      showToast(
        "error",
        "Username must be 3-24 characters and use only lowercase letters, numbers, or underscores.",
      );
      setUsernameStatus("invalid");
      setProfileLoading(false);
      return;
    }

    if (!mobile) {
      showToast("error", "Mobile number is required.");
      setProfileLoading(false);
      return;
    }

    if (!firstName) {
      showToast("error", "First name is required.");
      setProfileLoading(false);
      return;
    }

    let usernameAvailable = profile?.username.toLowerCase() === username;
    let usernameError: { message: string } | null = null;

    if (!usernameAvailable) {
      const result = await supabase.rpc("is_username_available", {
        candidate_username: username,
      });

      usernameAvailable = Boolean(result.data);
      usernameError = result.error;
    }

    if (usernameError || !usernameAvailable) {
      showToast(
        "error",
        usernameError?.message ?? "Username is already taken.",
      );
      setUsernameStatus(usernameError ? "idle" : "taken");
      setProfileLoading(false);
      return;
    }

    const nextProfile = {
      id: session.user.id,
      name: getDisplayName(firstName, profile?.last_name ?? ""),
      first_name: firstName,
      last_name: profile?.last_name ?? null,
      username,
      nic: profile?.nic ?? null,
      mobile,
      profile_image_url:
        profile?.profile_image_url ?? getDefaultProfileImageUrl(session),
      reference_id: profile?.reference_id ?? createReferenceId(session.user.id),
      role_id: profile?.role_id ?? 2,
      is_active: profile?.is_active ?? true,
    };

    const query = profile
      ? supabase.from("profiles").update(nextProfile).eq("id", session.user.id)
      : supabase.from("profiles").insert(nextProfile);

    const { data, error: saveError } = await query
      .select(
        "id, name, first_name, last_name, username, nic, mobile, profile_image_url, reference_id, role_id, is_active",
      )
      .single();

    if (saveError) {
      showToast("error", saveError.message);
    } else {
      setProfile(data as Profile);
      setOnboardingStep("optional");
      showToast("success", "Profile basics saved.");
    }

    setProfileLoading(false);
  }

  async function handleOptionalOnboardingSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!supabase || !session || !profile) return;

    setProfileLoading(true);
    setError(null);
    setToast(null);

    const lastName = profileForm.last_name.trim();
    const nic = profileForm.nic.trim();
    const firstName = profile.first_name || profileForm.first_name.trim();

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        last_name: lastName || null,
        nic: nic || null,
        name: getDisplayName(firstName, lastName),
      })
      .eq("id", session.user.id)
      .select(
        "id, name, first_name, last_name, username, nic, mobile, profile_image_url, reference_id, role_id, is_active",
      )
      .single();

    if (updateError) {
      showToast("error", updateError.message);
    } else {
      setProfile(data as Profile);
      setOnboardingStep(null);
      showToast("success", "Onboarding complete.");
    }

    setProfileLoading(false);
  }

  function handleSkipOptionalOnboarding() {
    setOnboardingStep(null);
    showToast("success", "Onboarding complete.");
  }

  function updateDonationForm(nextForm: DonationForm) {
    if (nextForm.donated_at !== donationForm.donated_at) {
      setDonationDocument(null);
      setDonationUploadStatus("idle");
    }

    setDonationForm(nextForm);
  }

  function updateAdminDonationForm(nextForm: DonationForm) {
    if (nextForm.donated_at !== adminDonationForm.donated_at) {
      setAdminDonationDocument(null);
      setAdminDonationUploadStatus("idle");
    }

    setAdminDonationForm(nextForm);
  }

  function updateDonationOutForm(nextForm: DonationOutForm) {
    if (nextForm.donated_at !== donationOutForm.donated_at) {
      setDonationOutDocument(null);
      setDonationOutUploadStatus("idle");
    }

    setDonationOutForm(nextForm);
  }

  async function handleDonationFileChange(
    file: File | null,
    type: "in" | "admin-in" | "out",
  ) {
    if (type === "in") {
      const nextForm = { ...donationForm, file };
      setDonationForm(nextForm);
      setDonationDocument(null);
      setDonationErrors((current) => ({ ...current, file: "" }));

      if (!file) {
        setDonationUploadStatus("idle");
        return;
      }

      if (!nextForm.donated_at) {
        setDonationUploadStatus("error");
        setDonationErrors((current) => ({
          ...current,
          donated_at: "Select donated date before uploading a document.",
        }));
        showToast("error", "Select donated date before uploading a document.");
        return;
      }

      setDonationUploadStatus("uploading");
      const uploadedDocument = await uploadDonationDocument(
        nextForm,
        "donation_in",
      );
      if (uploadedDocument) {
        setDonationDocument(uploadedDocument);
        setDonationUploadStatus("uploaded");
      } else {
        setDonationUploadStatus("error");
      }
    } else if (type === "admin-in") {
      const nextForm = { ...adminDonationForm, file };
      setAdminDonationForm(nextForm);
      setAdminDonationDocument(null);
      setAdminDonationErrors((current) => ({ ...current, file: "" }));

      if (!file) {
        setAdminDonationUploadStatus("idle");
        return;
      }

      if (!nextForm.donated_at) {
        setAdminDonationUploadStatus("error");
        setAdminDonationErrors((current) => ({
          ...current,
          donated_at: "Select donated date before uploading a document.",
        }));
        showToast("error", "Select donated date before uploading a document.");
        return;
      }

      setAdminDonationUploadStatus("uploading");
      const uploadedDocument = await uploadDonationDocument(
        nextForm,
        "donation_in",
      );
      if (uploadedDocument) {
        setAdminDonationDocument(uploadedDocument);
        setAdminDonationUploadStatus("uploaded");
      } else {
        setAdminDonationUploadStatus("error");
      }
    } else {
      const nextForm = { ...donationOutForm, file };
      setDonationOutForm(nextForm);
      setDonationOutDocument(null);
      setDonationOutErrors((current) => ({ ...current, file: "" }));

      if (!file) {
        setDonationOutUploadStatus("idle");
        return;
      }

      if (!nextForm.donated_at) {
        setDonationOutUploadStatus("error");
        setDonationOutErrors((current) => ({
          ...current,
          donated_at: "Select donated date before uploading a document.",
        }));
        showToast("error", "Select donated date before uploading a document.");
        return;
      }

      setDonationOutUploadStatus("uploading");
      const uploadedDocument = await uploadDonationDocument(
        nextForm,
        "donation_out",
      );
      if (uploadedDocument) {
        setDonationOutDocument(uploadedDocument);
        setDonationOutUploadStatus("uploaded");
      } else {
        setDonationOutUploadStatus("error");
      }
    }
  }

  async function handleDonationInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;

    const validationErrors = validateDonationForm(
      donationForm,
      donationDocument,
      donationUploadStatus,
    );
    setDonationErrors(validationErrors);

    if (Object.keys(validationErrors).length) {
      showToast("error", "Please complete the required donation fields.");
      return;
    }

    if (!donationDocument) return;

    setSavingDonation(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("donations_in")
      .insert({
        donated_at: new Date(donationForm.donated_at).toISOString(),
        amount_cents: currencyToCents(donationForm.amount),
        method: donationForm.method,
        reference_id: donationForm.reference_id.trim(),
        notes: donationForm.notes.trim() || null,
        document_id: donationDocument.id,
        status: "pending",
      })
      .select(
        "id, user_id, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id",
      )
      .single();

    if (insertError) {
      showToast("error", insertError.message);
    } else {
      const createdDonation = data as DonationIn;
      setMyDonations((current) => [createdDonation, ...current]);
      setPublicDonations((current) => [
        {
          ...toPublicDonationIn(createdDonation, {
            isOwn: true,
            donorUsername: profile?.username ?? null,
            donorReferenceId:
              profile?.reference_id ??
              createReferenceId(createdDonation.user_id ?? session.user.id),
          }),
        },
        ...current,
      ]);
      setDonationForm(emptyDonationForm);
      setDonationDocument(null);
      setDonationUploadStatus("idle");
      setDonationErrors({});
      setShowMineDonationForm(false);
      showToast("success", "Donation submitted for admin review.");
    }

    setSavingDonation(false);
  }

  async function handleAdminDonationInSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;

    const validationErrors = validateDonationForm(
      adminDonationForm,
      adminDonationDocument,
      adminDonationUploadStatus,
    );
    if (!adminDonationUserId) validationErrors.user_id = "Select a donor.";
    setAdminDonationErrors(validationErrors);

    if (Object.keys(validationErrors).length) {
      showToast("error", "Please complete the required donation fields.");
      return;
    }

    if (!adminDonationDocument) return;

    setSavingDonation(true);
    setError(null);

    const donor = donorOptions.find(
      (option) => option.id === adminDonationUserId,
    );
    const { data, error: insertError } = await supabase
      .from("donations_in")
      .insert({
        user_id: adminDonationUserId,
        donated_at: new Date(adminDonationForm.donated_at).toISOString(),
        amount_cents: currencyToCents(adminDonationForm.amount),
        method: adminDonationForm.method,
        reference_id: adminDonationForm.reference_id.trim(),
        notes: adminDonationForm.notes.trim() || null,
        document_id: adminDonationDocument.id,
        status: "pending",
      })
      .select(
        "id, user_id, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id",
      )
      .single();

    if (insertError) {
      showToast("error", insertError.message);
    } else {
      const createdDonation = data as DonationIn;
      setPublicDonations((current) => [
        {
          ...toPublicDonationIn(createdDonation, {
            isOwn: createdDonation.user_id === session?.user.id,
            donorUsername: donor?.username ?? null,
            donorReferenceId:
              donor?.reference_id ??
              createReferenceId(createdDonation.user_id ?? adminDonationUserId),
          }),
        },
        ...current,
      ]);
      if (createdDonation.user_id === session?.user.id) {
        setMyDonations((current) => [createdDonation, ...current]);
      }
      setAdminDonationForm(emptyDonationForm);
      setAdminDonationDocument(null);
      setAdminDonationUploadStatus("idle");
      setAdminDonationErrors({});
      setAdminDonationUserId(COMMUNITY_DONOR_ID);
      setPendingDonationCount((current) => current + 1);
      showToast("success", "Admin donation-in record created.");
    }

    setSavingDonation(false);
  }

  async function handleDonationOutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;

    const validationErrors = validateDonationOutForm(
      donationOutForm,
      donationOutDocument,
      donationOutUploadStatus,
    );
    setDonationOutErrors(validationErrors);

    if (Object.keys(validationErrors).length) {
      showToast("error", "Please complete the required donation-out fields.");
      return;
    }

    if (!donationOutDocument) return;

    setSavingDonation(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("donations_out")
      .insert({
        donee_name: donationOutForm.donee_name.trim(),
        address: donationOutForm.address.trim() || null,
        donated_at: new Date(donationOutForm.donated_at).toISOString(),
        amount_cents: currencyToCents(donationOutForm.amount),
        method: donationOutForm.method,
        reference_id: donationOutForm.reference_id.trim(),
        notes: donationOutForm.notes.trim() || null,
        document_id: donationOutDocument.id,
        status: "pending",
      })
      .select(
        "id, donee_name, address, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id",
      )
      .single();

    if (insertError) {
      showToast("error", insertError.message);
    } else {
      setDonationsOut((current) => [data as DonationOut, ...current]);
      setDonationOutForm(emptyDonationOutForm);
      setDonationOutDocument(null);
      setDonationOutUploadStatus("idle");
      setDonationOutErrors({});
      showToast("success", "Donation out record created.");
    }

    setSavingDonation(false);
  }

  async function uploadDonationDocument(
    form: DonationForm,
    donationType: "donation_in" | "donation_out",
  ) {
    if (!supabase || !form.file) return null;

    const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
    if (!appsScriptUrl) {
      showToast("error", "Apps Script URL is missing.");
      return null;
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      showToast("error", "Please sign in again before uploading the document.");
      return null;
    }

    try {
      const base64 = await fileToBase64(form.file);
      const response = await fetch(appsScriptUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "uploadDocument",
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
        showToast("error", result.error || "Document upload failed.");
        return null;
      }

      return result.document as UploadedDocument;
    } catch (uploadError) {
      showToast(
        "error",
        uploadError instanceof Error
          ? uploadError.message
          : "Document upload failed.",
      );
      return null;
    }
  }

  async function handleDonationInStatusChange(
    donation: DonationIn,
    status: DonationIn["status"],
  ) {
    if (!supabase || !isAdmin) return;

    const { data, error: updateError } = await supabase
      .from("donations_in")
      .update({ status })
      .eq("id", donation.id)
      .select(
        "id, user_id, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id, deleted_at, deleted_by",
      )
      .single();

    if (updateError) {
      showToast("error", updateError.message);
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
    setMyDonations((current) =>
      current.map((item) =>
        item.id === updated.id ? { ...item, ...updated } : item,
      ),
    );
    setSelectedDonationIn((current) =>
      current?.id === updated.id ? { ...current, ...updated } : current,
    );
    setPendingDonationCount((current) =>
      status === "pending"
        ? current
        : Math.max(0, current - (donation.status === "pending" ? 1 : 0)),
    );
    showToast("success", "Donation status updated.");
  }

  async function handleDonationInDonorChange(
    donation: DonationIn,
    userId: string,
  ) {
    if (!supabase || !isAdmin) return;

    const donor = donorOptions.find((option) => option.id === userId);
    const { data, error: updateError } = await supabase
      .from("donations_in")
      .update({ user_id: userId })
      .eq("id", donation.id)
      .select(
        "id, user_id, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id, deleted_at, deleted_by",
      )
      .single();

    if (updateError) {
      showToast("error", updateError.message);
      return;
    }

    const updated = {
      ...(data as DonationIn),
      donor_username: donor?.username,
      donor_reference_id: donor?.reference_id,
    };
    const publicUpdated = toPublicDonationIn(updated, {
      isOwn: updated.user_id === session?.user.id,
      donorUsername: donor?.username ?? null,
      donorReferenceId:
        donor?.reference_id ?? createReferenceId(updated.user_id ?? userId),
    });

    setPublicDonations((current) =>
      current.map((item) => (item.id === updated.id ? publicUpdated : item)),
    );
    setMyDonations((current) => {
      const isMine = updated.user_id === session?.user.id;
      const exists = current.some((item) => item.id === updated.id);

      if (!isMine) {
        return current.filter((item) => item.id !== updated.id);
      }

      if (exists) {
        return current.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      }

      return [updated, ...current];
    });
    setSelectedDonationIn((current) =>
      current?.id === updated.id ? { ...current, ...updated } : current,
    );
    showToast("success", "Donation donor updated.");
  }

  async function handleDonationInOwnerUpdate(
    donation: DonationIn,
    updates: Partial<DonationIn>,
  ) {
    if (!supabase || !session) return;

    if (donation.user_id !== session.user.id || donation.status === "success") {
      showToast("error", "This donation cannot be edited.");
      return;
    }

    const { data, error: updateError } = await supabase
      .from("donations_in")
      .update(updates)
      .eq("id", donation.id)
      .eq("user_id", session.user.id)
      .neq("status", "success")
      .select(
        "id, user_id, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id, deleted_at, deleted_by",
      )
      .single();

    if (updateError) {
      showToast("error", updateError.message);
      return;
    }

    const updated = {
      ...(data as DonationIn),
      donor_username: donation.donor_username ?? profile?.username,
      donor_reference_id: donation.donor_reference_id ?? profile?.reference_id,
    };
    const publicUpdated = toPublicDonationIn(updated, {
      isOwn: true,
      donorUsername: updated.donor_username ?? null,
      donorReferenceId:
        updated.donor_reference_id ??
        createReferenceId(updated.user_id ?? session.user.id),
    });

    setPublicDonations((current) =>
      current.map((item) => (item.id === updated.id ? publicUpdated : item)),
    );
    setMyDonations((current) =>
      current.map((item) =>
        item.id === updated.id ? { ...item, ...updated } : item,
      ),
    );
    setSelectedDonationIn((current) =>
      current?.id === updated.id ? { ...current, ...updated } : current,
    );
    showToast("success", "Donation record updated.");
  }

  async function handleDonationOutUpdate(
    donationId: string,
    updates: Partial<DonationOut>,
  ) {
    if (!supabase || !isAdmin) return;

    const { data, error: updateError } = await supabase
      .from("donations_out")
      .update(updates)
      .eq("id", donationId)
      .select(
        "id, donee_name, address, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id, deleted_at, deleted_by",
      )
      .single();

    if (updateError) {
      showToast("error", updateError.message);
      return;
    }

    const updated = data as DonationOut;
    setDonationsOut((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setSelectedDonationOut(updated);
    showToast("success", "Donation out record updated.");
  }

  async function handleDonationOutDetailSave(
    donationId: string,
    detailForm: typeof emptyDonationOutDetailForm,
  ) {
    if (!supabase || !isAdmin) return;

    const payload = {
      donation_out_id: donationId,
      title: detailForm.title.trim() || null,
      subtitle: detailForm.subtitle.trim() || null,
      description: detailForm.description.trim() || null,
      contact_info: detailForm.contact_info.trim() || null,
      is_published: detailForm.is_published,
    };

    const { data, error: saveError } = await supabase
      .from("donation_out_details")
      .upsert(payload, { onConflict: "donation_out_id" })
      .select(
        "id, donation_out_id, title, subtitle, description, contact_info, is_published, created_at, updated_at",
      )
      .single();

    if (saveError) {
      showToast("error", saveError.message);
      return;
    }

    const savedDetail = data as DonationOutDetail;
    setDonationOutDetails((current) => [
      savedDetail,
      ...current.filter((item) => item.donation_out_id !== donationId),
    ]);
    showToast("success", "Detail page saved.");
  }

  async function handleDonationOutMediaUpload(donationId: string, file: File) {
    if (!supabase || !isAdmin) return null;

    const donation =
      donationsOut.find((item) => item.id === donationId) ??
      selectedDonationOut;
    if (!donation) {
      showToast("error", "Donation out record was not found.");
      return null;
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      showToast("error", "Upload an image or video file.");
      return null;
    }

    const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
    if (!appsScriptUrl) {
      showToast("error", "Apps Script URL is missing.");
      return null;
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      showToast("error", "Please sign in again before uploading media.");
      return null;
    }

    try {
      const base64 = await fileToBase64(file);
      const response = await fetch(appsScriptUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "uploadDonationOutMedia",
          accessToken,
          donationId,
          fileName: file.name,
          mimeType: file.type,
          base64,
        }),
      });
      const result = await response.json();

      if (!result.ok) {
        showToast("error", result.error || "Media upload failed.");
        return null;
      }

      const currentMedia = donationOutMedia.filter(
        (item) => item.donation_out_id === donationId,
      );
      const nextSortOrder = currentMedia.length
        ? Math.max(...currentMedia.map((item) => item.sort_order)) + 1
        : 0;
      const uploadedDocument = result.document as UploadedDocument;
      const thumbnailDataUrl = file.type.startsWith("image/")
        ? await createImageThumbnailDataUrl(file)
        : null;
      const { data: mediaData, error: mediaError } = await supabase
        .from("donation_out_media")
        .insert({
          donation_out_id: donationId,
          document_id: uploadedDocument.id,
          media_type: file.type.startsWith("video/") ? "video" : "image",
          file_name: uploadedDocument.file_name,
          mime_type: uploadedDocument.mime_type,
          thumbnail_data_url: thumbnailDataUrl,
          sort_order: nextSortOrder,
        })
        .select(
          "id, donation_out_id, document_id, media_type, file_name, mime_type, caption, thumbnail_data_url, sort_order, created_at, updated_at",
        )
        .single();

      if (mediaError) {
        showToast("error", mediaError.message);
        return null;
      }

      const savedMedia = mediaData as DonationOutMedia;
      setDonationOutMedia((current) =>
        [...current, savedMedia].sort(sortMedia),
      );
      showToast("success", "Page media uploaded.");
      return savedMedia;
    } catch (uploadError) {
      showToast(
        "error",
        uploadError instanceof Error
          ? uploadError.message
          : "Media upload failed.",
      );
      return null;
    }
  }

  async function handleDonationOutMediaDelete(media: DonationOutMedia) {
    if (!supabase || !isAdmin) return;

    const { error: deleteError } = await supabase
      .from("donation_out_media")
      .delete()
      .eq("id", media.id);

    if (deleteError) {
      showToast("error", deleteError.message);
      return;
    }

    setDonationOutMedia((current) =>
      current.filter((item) => item.id !== media.id),
    );
    showToast("success", "Media removed from page.");
  }

  async function handleDonationOutMediaReorder(
    donationId: string,
    orderedMedia: DonationOutMedia[],
  ) {
    if (!supabase || !isAdmin) return;

    const updates = orderedMedia.map((item, index) => ({
      ...item,
      sort_order: index,
    }));
    setDonationOutMedia((current) =>
      [
        ...current.filter((item) => item.donation_out_id !== donationId),
        ...updates,
      ].sort(sortMedia),
    );

    const { error: updateError } = await supabase
      .from("donation_out_media")
      .upsert(
        updates.map((item) => ({
          id: item.id,
          donation_out_id: item.donation_out_id,
          document_id: item.document_id,
          media_type: item.media_type,
          file_name: item.file_name,
          mime_type: item.mime_type,
          caption: item.caption,
          thumbnail_data_url: item.thumbnail_data_url,
          sort_order: item.sort_order,
        })),
      );

    if (updateError) {
      showToast("error", updateError.message);
    }
  }

  async function handleDonationInDeletedChange(
    donation: DonationIn,
    deleted: boolean,
  ) {
    if (!supabase || !isAdmin || !session) return;

    if (deleted) {
      setConfirmAction({
        title: "Delete donation record?",
        message: `This will hide ${donation.reference_id} from normal lists and totals. Admins can restore it later.`,
        confirmLabel: "Delete record",
        danger: true,
        onConfirm: () => applyDonationInDeletedChange(donation, true),
      });
      return;
    }

    await applyDonationInDeletedChange(donation, false);
  }

  async function applyDonationInDeletedChange(
    donation: DonationIn,
    deleted: boolean,
  ) {
    if (!supabase || !isAdmin || !session) return;

    const updates = deleted
      ? { deleted_at: new Date().toISOString(), deleted_by: session.user.id }
      : { deleted_at: null, deleted_by: null };
    const { data, error: updateError } = await supabase
      .from("donations_in")
      .update(updates)
      .eq("id", donation.id)
      .select(
        "id, user_id, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id, deleted_at, deleted_by",
      )
      .single();

    if (updateError) {
      showToast("error", updateError.message);
      return;
    }

    const donor = adminUsers.find((user) => user.id === data.user_id);
    const updated = {
      ...(data as DonationIn),
      donor_username: donor?.username ?? donation.donor_username,
      donor_reference_id: donor?.reference_id ?? donation.donor_reference_id,
    };

    if (deleted) {
      setPublicDonations((current) =>
        current.filter((item) => item.id !== updated.id),
      );
      setMyDonations((current) =>
        current.filter((item) => item.id !== updated.id),
      );
      setDeletedDonationsIn((current) => [
        updated,
        ...current.filter((item) => item.id !== updated.id),
      ]);
      setPendingDonationCount((current) =>
        Math.max(0, current - (donation.status === "pending" ? 1 : 0)),
      );
    } else {
      setDeletedDonationsIn((current) =>
        current.filter((item) => item.id !== updated.id),
      );
      setPublicDonations((current) => [
        toPublicDonationIn(updated, {
          isOwn: updated.user_id === session.user.id,
          donorUsername: updated.donor_username ?? null,
          donorReferenceId:
            updated.donor_reference_id ??
            createReferenceId(updated.user_id ?? session.user.id),
        }),
        ...current.filter((item) => item.id !== updated.id),
      ]);
      if (updated.user_id === session.user.id) {
        setMyDonations((current) => [
          updated,
          ...current.filter((item) => item.id !== updated.id),
        ]);
      }
      setPendingDonationCount(
        (current) => current + (updated.status === "pending" ? 1 : 0),
      );
    }

    setSelectedDonationIn((current) =>
      current?.id === updated.id ? { ...current, ...updated } : current,
    );
    showToast(
      "success",
      deleted ? "Donation record deleted." : "Donation record restored.",
    );
  }

  async function handleDonationOutDeletedChange(
    donation: DonationOut,
    deleted: boolean,
  ) {
    if (!supabase || !isAdmin || !session) return;

    if (deleted) {
      setConfirmAction({
        title: "Delete donation out record?",
        message: `This will hide ${donation.reference_id} from normal lists and totals. Admins can restore it later.`,
        confirmLabel: "Delete record",
        danger: true,
        onConfirm: () => applyDonationOutDeletedChange(donation, true),
      });
      return;
    }

    await applyDonationOutDeletedChange(donation, false);
  }

  async function applyDonationOutDeletedChange(
    donation: DonationOut,
    deleted: boolean,
  ) {
    if (!supabase || !isAdmin || !session) return;

    const updates = deleted
      ? { deleted_at: new Date().toISOString(), deleted_by: session.user.id }
      : { deleted_at: null, deleted_by: null };
    const { data, error: updateError } = await supabase
      .from("donations_out")
      .update(updates)
      .eq("id", donation.id)
      .select(
        "id, donee_name, address, donated_at, amount_cents, method, reference_id, status, created_at, updated_at, notes, document_id, deleted_at, deleted_by",
      )
      .single();

    if (updateError) {
      showToast("error", updateError.message);
      return;
    }

    const updated = data as DonationOut;
    if (deleted) {
      setDonationsOut((current) =>
        current.filter((item) => item.id !== updated.id),
      );
      setDeletedDonationsOut((current) => [
        updated,
        ...current.filter((item) => item.id !== updated.id),
      ]);
    } else {
      setDeletedDonationsOut((current) =>
        current.filter((item) => item.id !== updated.id),
      );
      setDonationsOut((current) => [
        updated,
        ...current.filter((item) => item.id !== updated.id),
      ]);
    }
    setSelectedDonationOut((current) =>
      current?.id === updated.id ? updated : current,
    );
    showToast(
      "success",
      deleted
        ? "Donation out record deleted."
        : "Donation out record restored.",
    );
  }

  async function handleUserActiveChange(user: AdminUser, isActive: boolean) {
    if (!supabase || !isAdmin) return;

    if (user.id === session?.user.id && !isActive) {
      showToast("error", "You cannot deactivate your own admin account.");
      return;
    }

    if (user.id === COMMUNITY_DONOR_ID && !isActive) {
      showToast("error", "Community donor must stay active.");
      return;
    }

    if (!isActive) {
      setConfirmAction({
        title: "Deactivate user?",
        message: `${user.name || user.username} will be blocked from using the app until an admin activates the account again.`,
        confirmLabel: "Deactivate user",
        danger: true,
        onConfirm: () => applyUserActiveChange(user, false),
      });
      return;
    }

    await applyUserActiveChange(user, true);
  }

  async function applyUserActiveChange(user: AdminUser, isActive: boolean) {
    if (!supabase || !isAdmin) return;

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", user.id)
      .select("id, name, username, reference_id, mobile, role_id, is_active")
      .single();

    if (updateError) {
      showToast("error", updateError.message);
      return;
    }

    const updated = data as AdminUser;
    setAdminUsers((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setDonorOptions((current) => {
      const withoutUpdated = current.filter((item) => item.id !== updated.id);
      return updated.is_active || updated.id === COMMUNITY_DONOR_ID
        ? [...withoutUpdated, updated].sort((a, b) =>
            a.username.localeCompare(b.username),
          )
        : withoutUpdated;
    });
    showToast("success", isActive ? "User activated." : "User deactivated.");
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="app-shell centered">
        <Toast toast={toast} />
        <section className="auth-panel">
          <ShieldCheck aria-hidden="true" />
          <h1>Social Impact</h1>
          <p>
            Add your Supabase URL and publishable key in `.env.local` to start
            the app.
          </p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <PublicShell
        authPanel={
          publicAuthOpen ? (
            <div onClick={(event) => event.stopPropagation()}>
              <AuthPanel
                authLoading={authLoading}
                authMode={authMode}
                authNotice={authNotice}
                email={email}
                error={error}
                onEmailChange={setEmail}
                onGoogleAuth={handleGoogleAuth}
                onModeChange={(mode) => {
                  setAuthMode(mode);
                  setError(null);
                  setAuthNotice(null);
                }}
                onPasswordChange={setPassword}
                onSubmit={handleEmailAuth}
                password={password}
              />
            </div>
          ) : null
        }
        detail={
          detailDonationOutId
            ? (donationOutDetails.find(
                (item) => item.donation_out_id === detailDonationOutId,
              ) ?? null)
            : null
        }
        detailDonation={selectedDetailDonationOut}
        detailDonationOutId={detailDonationOutId}
        detailMedia={donationOutMedia
          .filter((item) => item.donation_out_id === detailDonationOutId)
          .sort(sortMedia)}
        error={publicAuthOpen ? null : error}
        loading={loading}
        onCloseAuth={() => setPublicAuthOpen(false)}
        onOpenSignIn={() => {
          setAuthMode("sign-in");
          setAuthNotice(null);
          setError(null);
          setPublicAuthOpen(true);
        }}
        onOpenSignUp={() => {
          setAuthMode("sign-up");
          setAuthNotice(null);
          setError(null);
          setPublicAuthOpen(true);
        }}
        publicDataLoaded={publicDataLoaded}
        slides={donationOutPageSlides}
        stats={publicStats}
      >
        <Toast toast={toast} />
      </PublicShell>
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

          <button
            className="primary-button"
            type="button"
            onClick={handleResendVerification}
            disabled={authLoading}
          >
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

  if (activeOnboardingStep === "required") {
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
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  first_name: event.target.value,
                })
              }
              required
            />
            <input
              type="text"
              placeholder="Username"
              value={profileForm.username}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  username: event.target.value
                    .toLowerCase()
                    .replace(/\s+/g, ""),
                })
              }
              required
            />
            <p className={`field-hint username-${usernameStatus}`}>
              {getUsernameMessage(usernameStatus)}
            </p>
            <input
              type="tel"
              placeholder="Mobile"
              value={profileForm.mobile}
              onChange={(event) =>
                setProfileForm({ ...profileForm, mobile: event.target.value })
              }
              required
            />
            <button
              type="submit"
              disabled={profileLoading || usernameStatus !== "available"}
            >
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

  if (activeOnboardingStep === "optional") {
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
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  last_name: event.target.value,
                })
              }
            />
            <input
              type="text"
              placeholder="NIC optional"
              value={profileForm.nic}
              onChange={(event) =>
                setProfileForm({ ...profileForm, nic: event.target.value })
              }
            />
            <button type="submit" disabled={profileLoading}>
              Complete
            </button>
          </form>

          <button
            className="text-button"
            type="button"
            onClick={handleSkipOptionalOnboarding}
          >
            Skip
          </button>
        </section>
      </main>
    );
  }

  const completedProfile = profile;
  if (!completedProfile) return null;

  return (
    <div className={`app-layout ${isAdmin ? "has-admin-nav" : ""}`}>
      <Toast toast={toast} />
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Donation Records</p>
          <h1>Social Impact</h1>
        </div>
        <div className="topbar-actions">
          {isAdmin && pendingDonationCount > 0 && (
            <button
              className="pending-banner"
              type="button"
              onClick={() => setActiveView("public-donations")}
            >
              {pendingDonationCount} pending
            </button>
          )}
          <div className="profile-menu-wrap">
            <button
              className="header-user"
              type="button"
              aria-expanded={profileMenuOpen}
              onClick={() => setProfileMenuOpen((current) => !current)}
            >
              <div>
                <p className="eyebrow">Signed in</p>
                <strong>{completedProfile.name}</strong>
                <span>{userEmail}</span>
              </div>
              <Avatar profile={completedProfile} />
            </button>
            {profileMenuOpen && (
              <div className="profile-menu" role="menu">
                <strong>{completedProfile.reference_id}</strong>
                <span>@{completedProfile.username}</span>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    void handleSignOut();
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="content">
        {error && <p className="error-banner">{error}</p>}

        {detailDonationOutId ? (
          <DonationOutDetailPage
            donation={selectedDetailDonationOut}
            detail={
              donationOutDetails.find(
                (item) => item.donation_out_id === detailDonationOutId,
              ) ?? null
            }
            media={donationOutMedia
              .filter((item) => item.donation_out_id === detailDonationOutId)
              .sort(sortMedia)}
            isAdmin={isAdmin}
          />
        ) : (
          activeView === "dashboard" && (
            <>
              <DonationOutHeroCarousel slides={donationOutPageSlides} />
              <DashboardBalance
                availableBalance={dashboardImpact.availableBalance}
                contributionTotal={totals.incomingTotal}
                distributionTotal={totals.outgoingTotal}
              />
              <section className="grid-panels balance-breakdown">
                <article className="metric-panel">
                  <span>Community contributions</span>
                  <strong>{currency.format(totals.incomingTotal)}</strong>
                  <small>{totals.incomingCount} successful records</small>
                </article>
                <article className="metric-panel">
                  <span>Charity distributions</span>
                  <strong>{currency.format(totals.outgoingTotal)}</strong>
                  <small>{totals.outgoingCount} outgoing records</small>
                </article>
              </section>
              <DashboardFlowChart months={dashboardMonths} />
              <section className="dashboard-insights">
                <DashboardImpactCards
                  contributorCount={dashboardImpact.contributorCount}
                  contributionCount={totals.incomingCount}
                  distributionCount={totals.outgoingCount}
                  communityDonorTotal={dashboardImpact.communityDonorTotal}
                  userContributionTotal={dashboardImpact.userContributionTotal}
                />
                <DashboardActivityTimeline activity={dashboardActivity} />
              </section>
            </>
          )
        )}

        {!detailDonationOutId && activeView === "my-donations" && (
          <section className="record-section">
            <div className="section-header">
              <h2>My Contribution</h2>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setShowMineDonationForm((current) => !current)}
              >
                <Plus aria-hidden="true" />
                {showMineDonationForm ? "Hide form" : "Create new donation"}
              </button>
            </div>

            {showMineDonationForm && (
              <div className="expandable-form">
                <h3>New Donation In</h3>
                <DonationInForm
                  form={donationForm}
                  errors={donationErrors}
                  saving={savingDonation}
                  uploadedDocument={donationDocument}
                  uploadStatus={donationUploadStatus}
                  onChange={updateDonationForm}
                  onFileChange={(file) => handleDonationFileChange(file, "in")}
                  onSubmit={handleDonationInSubmit}
                />
              </div>
            )}

            {myDonations.length ? (
              <div className="record-list">
                {myDonations.map((donation) => (
                  <button
                    className="record-item record-button"
                    key={donation.id}
                    onClick={() => setSelectedDonationIn(donation)}
                  >
                    <div>
                      <strong>{donation.reference_id}</strong>
                      <span>
                        {formatDate(donation.donated_at)} ·{" "}
                        {formatDonationMethod(donation.method)}
                      </span>
                    </div>
                    <div>
                      <strong>
                        {currency.format(
                          centsToCurrency(donation.amount_cents),
                        )}
                      </strong>
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

        {!detailDonationOutId && activeView === "public-donations" && (
          <section className="record-section">
            <h2>Community Contributions</h2>
            <ListControls
              search={communitySearch}
              sort={communitySort}
              placeholder="Search user ref, donation ref"
              onSearch={setCommunitySearch}
              onSort={setCommunitySort}
            />
            {loading ? (
              <p className="muted">Loading records...</p>
            ) : filteredCommunityDonations.length ? (
              <div className="record-list">
                {filteredCommunityDonations.map((donation) => (
                  <button
                    className="record-item record-button"
                    key={donation.id}
                    onClick={() => setSelectedDonationIn(donation)}
                  >
                    <div>
                      <strong>{donation.reference_id}</strong>
                      <span>
                        {isAdmin || donation.is_own
                          ? donation.donor_username
                            ? `@${donation.donor_username}`
                            : donation.donor_reference_id ||
                              "Community contribution"
                          : donation.donor_reference_id ||
                            "Community contribution"}
                        {" · "}
                        {formatDonationMethod(donation.method)}
                      </span>
                    </div>
                    <div>
                      <strong>
                        {currency.format(
                          centsToCurrency(donation.amount_cents),
                        )}
                      </strong>
                      <StatusPill status={donation.status} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="No community contribution records found." />
            )}
          </section>
        )}

        {!detailDonationOutId && activeView === "donations-out" && (
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
                  <button
                    className="record-item record-button"
                    key={donation.id}
                    onClick={() => setSelectedDonationOut(donation)}
                  >
                    <div>
                      <strong>{donation.donee_name}</strong>
                      <span>
                        {formatDate(donation.donated_at)} ·{" "}
                        {formatDonationMethod(donation.method)}
                      </span>
                    </div>
                    <div>
                      <strong>
                        {currency.format(
                          centsToCurrency(donation.amount_cents),
                        )}
                      </strong>
                      <StatusPill status={donation.status} />
                      {donationOutDetails.some(
                        (detail) =>
                          detail.donation_out_id === donation.id &&
                          detail.is_published,
                      ) && <span className="text-link">Page available</span>}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="No outgoing donation records yet." />
            )}
          </section>
        )}

        {!detailDonationOutId && activeView === "admin-out" && isAdmin && (
          <section className="record-section">
            <h2>Admin</h2>
            <div className="admin-create-tabs" aria-label="Admin section">
              <button
                className={adminCreateMode === "donation_out" ? "active" : ""}
                type="button"
                onClick={() => setAdminCreateMode("donation_out")}
              >
                Donation Out
              </button>
              <button
                className={adminCreateMode === "donation_in" ? "active" : ""}
                type="button"
                onClick={() => setAdminCreateMode("donation_in")}
              >
                Donation In
              </button>
              <button
                className={adminCreateMode === "users" ? "active" : ""}
                type="button"
                onClick={() => setAdminCreateMode("users")}
              >
                Users
              </button>
              <button
                className={adminCreateMode === "deleted" ? "active" : ""}
                type="button"
                onClick={() => setAdminCreateMode("deleted")}
              >
                Deleted
              </button>
            </div>

            {adminCreateMode === "donation_out" && (
              <div className="admin-tab-panel">
                <h3>Create Donation Out</h3>
                <DonationOutFormView
                  form={donationOutForm}
                  errors={donationOutErrors}
                  saving={savingDonation}
                  uploadedDocument={donationOutDocument}
                  uploadStatus={donationOutUploadStatus}
                  onChange={updateDonationOutForm}
                  onFileChange={(file) => handleDonationFileChange(file, "out")}
                  onSubmit={handleDonationOutSubmit}
                />
              </div>
            )}

            {adminCreateMode === "donation_in" && (
              <div className="admin-tab-panel">
                <h3>Create Donation In</h3>
                <AdminDonationInForm
                  form={adminDonationForm}
                  errors={adminDonationErrors}
                  saving={savingDonation}
                  donorOptions={donorOptions}
                  selectedDonorId={adminDonationUserId}
                  uploadedDocument={adminDonationDocument}
                  uploadStatus={adminDonationUploadStatus}
                  onDonorChange={setAdminDonationUserId}
                  onChange={updateAdminDonationForm}
                  onFileChange={(file) =>
                    handleDonationFileChange(file, "admin-in")
                  }
                  onSubmit={handleAdminDonationInSubmit}
                />
              </div>
            )}

            {adminCreateMode === "users" && (
              <AdminUsersSection
                users={adminUsers}
                currentUserId={session.user.id}
                onActiveChange={handleUserActiveChange}
              />
            )}

            {adminCreateMode === "deleted" && (
              <DeletedRecordsSection
                donationsIn={deletedDonationsIn}
                donationsOut={deletedDonationsOut}
                onOpenDonationIn={setSelectedDonationIn}
                onOpenDonationOut={setSelectedDonationOut}
              />
            )}
          </section>
        )}
      </main>

      {selectedDonationIn && (
        <DonationInModal
          donation={selectedDonationIn}
          isAdmin={isAdmin}
          isOwner={
            "is_own" in selectedDonationIn
              ? selectedDonationIn.is_own
              : selectedDonationIn.user_id === session.user.id
          }
          donorOptions={donorOptions}
          onClose={() => setSelectedDonationIn(null)}
          onStatusChange={handleDonationInStatusChange}
          onDonorChange={handleDonationInDonorChange}
          onOwnerUpdate={handleDonationInOwnerUpdate}
          onDocumentUpload={(form) =>
            uploadDonationDocument(form, "donation_in")
          }
          onDeletedChange={handleDonationInDeletedChange}
        />
      )}

      {selectedDonationOut && (
        <DonationOutModal
          donation={selectedDonationOut}
          detail={
            donationOutDetails.find(
              (item) => item.donation_out_id === selectedDonationOut.id,
            ) ?? null
          }
          media={donationOutMedia
            .filter((item) => item.donation_out_id === selectedDonationOut.id)
            .sort(sortMedia)}
          isAdmin={isAdmin}
          onClose={() => setSelectedDonationOut(null)}
          onSave={handleDonationOutUpdate}
          onDetailSave={handleDonationOutDetailSave}
          onMediaUpload={handleDonationOutMediaUpload}
          onMediaDelete={handleDonationOutMediaDelete}
          onMediaReorder={handleDonationOutMediaReorder}
          onDeletedChange={handleDonationOutDeletedChange}
          onOpenPage={openDonationOutPage}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            const action = confirmAction;
            setConfirmAction(null);
            await action.onConfirm();
          }}
        />
      )}

      <nav
        className={`bottom-nav ${isAdmin ? "has-admin" : ""}`}
        aria-label="Main navigation"
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`${activeView === item.key ? "active" : ""} nav-${item.key}`}
              type="button"
              key={item.key}
              onClick={() => {
                window.location.hash = "";
                setDetailDonationOutId(null);
                setActiveView(item.key);
              }}
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

function getDonationOutIdFromHash() {
  const match = window.location.hash.match(/^#\/?out\/([0-9a-f-]{36})$/i);
  return match?.[1] ?? null;
}

function openHashDonationOutPage(donationId: string) {
  window.location.hash = `out/${donationId}`;
}

function sortMedia(first: DonationOutMedia, second: DonationOutMedia) {
  return (
    first.sort_order - second.sort_order ||
    first.created_at.localeCompare(second.created_at)
  );
}

function toPublicDonationIn(
  donation: DonationIn,
  options: {
    isOwn: boolean;
    donorUsername: string | null;
    donorReferenceId: string;
  },
): PublicDonationIn {
  return {
    id: donation.id,
    user_id: donation.user_id,
    donated_at: donation.donated_at,
    amount_cents: donation.amount_cents,
    method: donation.method,
    reference_id: donation.reference_id,
    status: donation.status,
    created_at: donation.created_at,
    updated_at: donation.updated_at,
    document_id: donation.document_id ?? null,
    is_own: options.isOwn,
    donor_username: options.donorUsername,
    donor_reference_id: options.donorReferenceId,
  };
}

function isValidUsername(username: string) {
  return /^[a-z0-9_]{3,24}$/.test(username);
}

function isProfileComplete(profile: Profile | null) {
  return Boolean(
    profile?.first_name?.trim() &&
    profile.username?.trim() &&
    profile.mobile?.trim(),
  );
}

function isEmailVerified(session: Session) {
  const identities = session.user.identities ?? [];
  const hasExternalProvider = identities.some(
    (identity) => identity.provider !== "email",
  );

  return Boolean(
    session.user.email_confirmed_at ||
    session.user.confirmed_at ||
    hasExternalProvider,
  );
}

function getUsernameMessage(status: UsernameStatus) {
  if (status === "checking") return "Checking username...";
  if (status === "available") return "Username is available.";
  if (status === "taken") return "Username is already obtained.";
  if (status === "invalid")
    return "Use 3-24 lowercase letters, numbers, or underscores.";
  return "Choose a unique username.";
}

function getDefaultFirstName(session: Session) {
  const metadata = session.user.user_metadata;
  const fullName = String(metadata.full_name || metadata.name || "").trim();

  return (
    metadata.given_name ||
    fullName.split(/\s+/)[0] ||
    getDefaultUsername(session)
  );
}

function getDefaultLastName(session: Session) {
  const metadata = session.user.user_metadata;
  const fullName = String(metadata.full_name || metadata.name || "").trim();
  const [, ...rest] = fullName.split(/\s+/);

  return metadata.family_name || rest.join(" ");
}

function getDefaultUsername(session: Session) {
  return (session.user.email?.split("@")[0] || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 24);
}

function getDisplayName(
  firstName: string,
  lastName: string | null | undefined,
) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
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
    .join("");
}

function Avatar({ profile }: { profile: Profile }) {
  if (profile.profile_image_url) {
    return <img className="avatar" src={profile.profile_image_url} alt="" />;
  }

  return (
    <div className="avatar avatar-fallback">
      {getInitials(profile.name || profile.username)}
    </div>
  );
}

function RequiredLabel({ children }: { children: string }) {
  return (
    <label className="field-label">
      {children}
      <span aria-hidden="true">*</span>
    </label>
  );
}

function AdminUsersSection({
  users,
  currentUserId,
  onActiveChange,
}: {
  users: AdminUser[];
  currentUserId: string;
  onActiveChange: (user: AdminUser, isActive: boolean) => void;
}) {
  return (
    <div className="admin-tab-panel">
      <h2>Users</h2>
      {users.length ? (
        <div className="record-list">
          {users.map((user) => (
            <article className="record-item" key={user.id}>
              <div>
                <strong>{user.name || user.username}</strong>
                <span>
                  @{user.username} · {user.reference_id}
                </span>
                <span>{user.mobile}</span>
              </div>
              <div>
                <span
                  className={`status ${user.is_active ? "status-success" : "status-failed"}`}
                >
                  {user.is_active ? "active" : "inactive"}
                </span>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={
                    user.id === currentUserId || user.id === COMMUNITY_DONOR_ID
                  }
                  onClick={() => onActiveChange(user, !user.is_active)}
                >
                  {user.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No users found." />
      )}
    </div>
  );
}

function DeletedRecordsSection({
  donationsIn,
  donationsOut,
  onOpenDonationIn,
  onOpenDonationOut,
}: {
  donationsIn: DonationIn[];
  donationsOut: DonationOut[];
  onOpenDonationIn: (donation: DonationIn) => void;
  onOpenDonationOut: (donation: DonationOut) => void;
}) {
  return (
    <div className="admin-tab-panel">
      <h2>Deleted Records</h2>
      <h3 className="section-subtitle">Donation In</h3>
      {donationsIn.length ? (
        <div className="record-list">
          {donationsIn.map((donation) => (
            <button
              className="record-item record-button"
              key={donation.id}
              onClick={() => onOpenDonationIn(donation)}
            >
              <div>
                <strong>{donation.reference_id}</strong>
                <span>
                  {donation.donor_username
                    ? `@${donation.donor_username}`
                    : (donation.user_id ?? "Unknown donor")}
                </span>
              </div>
              <div>
                <strong>
                  {currency.format(centsToCurrency(donation.amount_cents))}
                </strong>
                {donation.deleted_at && (
                  <span>Deleted {formatDate(donation.deleted_at)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="No deleted incoming records." />
      )}

      <h3 className="section-subtitle">Donation Out</h3>
      {donationsOut.length ? (
        <div className="record-list">
          {donationsOut.map((donation) => (
            <button
              className="record-item record-button"
              key={donation.id}
              onClick={() => onOpenDonationOut(donation)}
            >
              <div>
                <strong>{donation.donee_name}</strong>
                <span>{donation.reference_id}</span>
              </div>
              <div>
                <strong>
                  {currency.format(centsToCurrency(donation.amount_cents))}
                </strong>
                {donation.deleted_at && (
                  <span>Deleted {formatDate(donation.deleted_at)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="No deleted outgoing records." />
      )}
    </div>
  );
}

function AdminDonationInForm({
  form,
  errors,
  saving,
  donorOptions,
  selectedDonorId,
  uploadedDocument,
  uploadStatus,
  onDonorChange,
  onChange,
  onFileChange,
  onSubmit,
}: {
  form: DonationForm;
  errors: FieldErrors;
  saving: boolean;
  donorOptions: DonorOption[];
  selectedDonorId: string;
  uploadedDocument: UploadedDocument | null;
  uploadStatus: UploadStatus;
  onDonorChange: (userId: string) => void;
  onChange: (form: DonationForm) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="donation-form" onSubmit={onSubmit}>
      <FieldGroup error={errors.user_id}>
        <RequiredLabel>Donor</RequiredLabel>
        <select
          value={selectedDonorId}
          onChange={(event) => onDonorChange(event.target.value)}
        >
          {donorOptions.map((donor) => (
            <option key={donor.id} value={donor.id}>
              {donor.username === "community_donor"
                ? "Community Donor"
                : `${donor.name || donor.username} (@${donor.username})`}
            </option>
          ))}
        </select>
      </FieldGroup>
      <DonationFields
        form={form}
        errors={errors}
        uploadedDocument={uploadedDocument}
        uploadStatus={uploadStatus}
        onChange={onChange}
        onFileChange={onFileChange}
      />
      <button
        type="submit"
        disabled={saving || uploadStatus === "uploading" || !uploadedDocument}
      >
        {saving ? "Saving..." : "Save Donation In"}
      </button>
    </form>
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
      <DonationFields
        form={form}
        errors={errors}
        uploadedDocument={uploadedDocument}
        uploadStatus={uploadStatus}
        onChange={onChange}
        onFileChange={onFileChange}
      />
      <button
        type="submit"
        disabled={saving || uploadStatus === "uploading" || !uploadedDocument}
      >
        {saving ? "Saving..." : "Save Donation"}
      </button>
    </form>
  );
}

function DonationFields({
  form,
  errors,
  uploadedDocument,
  uploadStatus,
  onChange,
  onFileChange,
  documentLabel = "Document",
  documentRequired = true,
}: {
  form: DonationForm;
  errors: FieldErrors;
  uploadedDocument: UploadedDocument | null;
  uploadStatus: UploadStatus;
  onChange: (form: DonationForm) => void;
  onFileChange: (file: File | null) => void;
  documentLabel?: string;
  documentRequired?: boolean;
}) {
  return (
    <>
      <FieldGroup error={errors.donated_at}>
        <RequiredLabel>Donated at</RequiredLabel>
        <input
          className={errors.donated_at ? "field-error" : ""}
          type="date"
          value={form.donated_at}
          onChange={(event) =>
            onChange({ ...form, donated_at: event.target.value })
          }
        />
      </FieldGroup>
      <FieldGroup error={errors.reference_id}>
        <RequiredLabel>Reference ID</RequiredLabel>
        <input
          className={errors.reference_id ? "field-error" : ""}
          value={form.reference_id}
          onChange={(event) =>
            onChange({ ...form, reference_id: event.target.value })
          }
        />
      </FieldGroup>
      <FieldGroup error={errors.amount}>
        <RequiredLabel>Amount</RequiredLabel>
        <input
          className={errors.amount ? "field-error" : ""}
          type="number"
          min="1"
          step="0.01"
          value={form.amount}
          onChange={(event) =>
            onChange({ ...form, amount: event.target.value })
          }
        />
      </FieldGroup>
      <DonationMethodField
        value={form.method}
        onChange={(method) => onChange({ ...form, method })}
      />
      <FieldGroup error={errors.notes}>
        <label className="field-label">Notes</label>
        <textarea
          value={form.notes}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
        />
      </FieldGroup>
      <DocumentInput
        file={form.file}
        error={errors.file}
        uploadedDocument={uploadedDocument}
        uploadStatus={uploadStatus}
        onFileChange={onFileChange}
        label={documentLabel}
        required={documentRequired}
      />
    </>
  );
}

function DonationMethodField({
  value,
  onChange,
}: {
  value: DonationMethod;
  onChange: (method: DonationMethod) => void;
}) {
  return (
    <FieldGroup>
      <label className="field-label">Method</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as DonationMethod)}
      >
        <option value="online">Online transfer</option>
        <option value="cash">Cash</option>
        <option value="other">Other</option>
      </select>
    </FieldGroup>
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
          className={errors.donee_name ? "field-error" : ""}
          value={form.donee_name}
          onChange={(event) =>
            onChange({ ...form, donee_name: event.target.value })
          }
        />
      </FieldGroup>
      <FieldGroup error={errors.address}>
        <label className="field-label">Address</label>
        <textarea
          value={form.address}
          onChange={(event) =>
            onChange({ ...form, address: event.target.value })
          }
        />
      </FieldGroup>
      <FieldGroup error={errors.donated_at}>
        <RequiredLabel>Donated at</RequiredLabel>
        <input
          className={errors.donated_at ? "field-error" : ""}
          type="date"
          value={form.donated_at}
          onChange={(event) =>
            onChange({ ...form, donated_at: event.target.value })
          }
        />
      </FieldGroup>
      <FieldGroup error={errors.reference_id}>
        <RequiredLabel>Reference ID</RequiredLabel>
        <input
          className={errors.reference_id ? "field-error" : ""}
          value={form.reference_id}
          onChange={(event) =>
            onChange({ ...form, reference_id: event.target.value })
          }
        />
      </FieldGroup>
      <FieldGroup error={errors.amount}>
        <RequiredLabel>Amount</RequiredLabel>
        <input
          className={errors.amount ? "field-error" : ""}
          type="number"
          min="1"
          step="0.01"
          value={form.amount}
          onChange={(event) =>
            onChange({ ...form, amount: event.target.value })
          }
        />
      </FieldGroup>
      <DonationMethodField
        value={form.method}
        onChange={(method) => onChange({ ...form, method })}
      />
      <FieldGroup error={errors.notes}>
        <label className="field-label">Notes</label>
        <textarea
          value={form.notes}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
        />
      </FieldGroup>
      <DocumentInput
        file={form.file}
        error={errors.file}
        uploadedDocument={uploadedDocument}
        uploadStatus={uploadStatus}
        onFileChange={onFileChange}
        required
      />
      <button
        type="submit"
        disabled={saving || uploadStatus === "uploading" || !uploadedDocument}
      >
        {saving ? "Saving..." : "Create Donation Out"}
      </button>
    </form>
  );
}

function FieldGroup({
  children,
  error,
}: {
  children: ReactNode;
  error?: string;
}) {
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
  label = "Document",
  required = false,
}: {
  file: File | null;
  error?: string;
  uploadedDocument: UploadedDocument | null;
  uploadStatus: UploadStatus;
  onFileChange: (file: File | null) => void;
  label?: string;
  required?: boolean;
}) {
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  return (
    <FieldGroup error={error}>
      {required ? (
        <RequiredLabel>{label}</RequiredLabel>
      ) : (
        <label className="field-label">{label}</label>
      )}
      <input
        className={error ? "field-error" : ""}
        type="file"
        accept="image/*,application/pdf"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
      {file && (
        <div className="document-preview">
          {uploadStatus === "uploading" && (
            <div className="preview-overlay">
              <span className="spinner" />
            </div>
          )}
          {file.type.startsWith("image/") && previewUrl ? (
            <img src={previewUrl} alt="" />
          ) : (
            <div className="pdf-preview">PDF</div>
          )}
          <div>
            <strong>{file.name}</strong>
            <span>{Math.ceil(file.size / 1024)} KB</span>
            {uploadStatus === "uploaded" && uploadedDocument && (
              <span className="upload-ok">Uploaded</span>
            )}
            {uploadStatus === "error" && (
              <span className="upload-error">Upload failed</span>
            )}
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
      <input
        placeholder={placeholder}
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
      <select
        value={sort}
        onChange={(event) => onSort(event.target.value as SortKey)}
      >
        <option value="created_at">Created</option>
        <option value="updated_at">Updated</option>
        <option value="donated_at">Donated</option>
      </select>
    </div>
  );
}

function DashboardBalance({
  availableBalance,
  contributionTotal,
  distributionTotal,
}: {
  availableBalance: number;
  contributionTotal: number;
  distributionTotal: number;
}) {
  const distributedPercent = contributionTotal
    ? Math.min(100, Math.round((distributionTotal / contributionTotal) * 100))
    : 0;

  return (
    <section className="dashboard-balance">
      <div>
        <p className="eyebrow">Available balance</p>
        <h2>{currency.format(availableBalance)}</h2>
        <span>
          {currency.format(distributionTotal)} distributed from{" "}
          {currency.format(contributionTotal)} contributed
        </span>
      </div>
      <div className="balance-visual" aria-hidden="true">
        <WalletCards />
        <div className="balance-track">
          <span style={{ width: `${distributedPercent}%` }} />
        </div>
        <small>{distributedPercent}% distributed</small>
      </div>
    </section>
  );
}

function DashboardFlowChart({ months }: { months: DashboardMonth[] }) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartDragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const [chartDragging, setChartDragging] = useState(false);
  const maxAmount = Math.max(
    1,
    ...months.flatMap((month) => [month.contributions, month.distributions]),
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !months.length) return;

    window.requestAnimationFrame(() => {
      chart.scrollLeft = chart.scrollWidth - chart.clientWidth;
    });
  }, [months.length]);

  function handleChartPointerDown(event: PointerEvent<HTMLDivElement>) {
    const chart = chartRef.current;
    if (!chart) return;

    chartDragRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: chart.scrollLeft,
    };
    setChartDragging(true);
    chart.setPointerCapture(event.pointerId);
  }

  function handleChartPointerMove(event: PointerEvent<HTMLDivElement>) {
    const chart = chartRef.current;
    const drag = chartDragRef.current;
    if (!chart || !drag.active) return;

    chart.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
  }

  function endChartDrag() {
    chartDragRef.current.active = false;
    setChartDragging(false);
  }

  return (
    <section className="dashboard-chart">
      <div className="section-header">
        <div>
          <p className="eyebrow">Monthly flow</p>
          <h2>Contributions vs Donations</h2>
        </div>
        <div className="chart-legend">
          <span className="legend-in">Contributions</span>
          <span className="legend-out">Donations</span>
        </div>
      </div>
      <div
        className={`flow-chart ${chartDragging ? "dragging" : ""}`}
        ref={chartRef}
        aria-label="Monthly contributions and donations"
        onPointerDown={handleChartPointerDown}
        onPointerMove={handleChartPointerMove}
        onPointerUp={endChartDrag}
        onPointerCancel={endChartDrag}
        onPointerLeave={endChartDrag}
      >
        {months.map((month) => (
          <div className="flow-month" key={month.key}>
            <div className="flow-bars">
              <span
                className="flow-bar flow-bar-in"
                style={{ height: `${Math.max(6, (month.contributions / maxAmount) * 100)}%` }}
                title={`${month.label} contributions: ${currency.format(month.contributions)}`}
              />
              <span
                className="flow-bar flow-bar-out"
                style={{ height: `${Math.max(6, (month.distributions / maxAmount) * 100)}%` }}
                title={`${month.label} donations: ${currency.format(month.distributions)}`}
              />
            </div>
            <strong>{month.label}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardImpactCards({
  contributorCount,
  contributionCount,
  distributionCount,
  communityDonorTotal,
  userContributionTotal,
}: {
  contributorCount: number;
  contributionCount: number;
  distributionCount: number;
  communityDonorTotal: number;
  userContributionTotal: number;
}) {
  const comparisonTotal = communityDonorTotal + userContributionTotal;
  const communityPercent = comparisonTotal ? Math.round((communityDonorTotal / comparisonTotal) * 100) : 0;
  const userPercent = comparisonTotal ? 100 - communityPercent : 0;
  const items = [
    { label: "Contributors", value: String(contributorCount), icon: UsersRound },
    { label: "Contributions", value: String(contributionCount), icon: TrendingUp },
    { label: "Donations", value: String(distributionCount), icon: HandCoins },
  ];

  return (
    <section className="impact-grid" aria-label="Impact summary">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article className="impact-card" key={item.label}>
            <Icon aria-hidden="true" />
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        );
      })}
      <article className="impact-card contribution-split-card">
        <div
          className="contribution-donut"
          style={{
            background: comparisonTotal
              ? `conic-gradient(#177865 0 ${communityPercent}%, #d7a02f ${communityPercent}% 100%)`
              : "#deeee9",
          }}
          role="img"
          aria-label={`Community donor ${communityPercent} percent, user contributions ${userPercent} percent`}
        >
          <span>{communityPercent}%</span>
        </div>
        <div className="split-summary">
          <strong>Contribution Split</strong>
          <span>
            <i className="split-dot split-community" />
            Community donor {currency.format(communityDonorTotal)}
          </span>
          <span>
            <i className="split-dot split-users" />
            Users {currency.format(userContributionTotal)}
          </span>
        </div>
      </article>
    </section>
  );
}

function DashboardActivityTimeline({
  activity,
}: {
  activity: DashboardActivity[];
}) {
  return (
    <section className="activity-panel">
      <div className="section-header">
        <h2>Recent Activity</h2>
      </div>
      {activity.length ? (
        <div className="activity-list">
          {activity.map((item) => (
            <article className="activity-item" key={item.id}>
              <span className={item.kind === "Contribution" ? "activity-dot activity-in" : "activity-dot activity-out"} />
              <div>
                <strong>{item.label}</strong>
                <span>
                  {item.kind} · {formatDate(item.date)}
                </span>
              </div>
              <strong>{currency.format(item.amount)}</strong>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">Recent records will appear here.</p>
      )}
    </section>
  );
}

function DonationInModal({
  donation,
  isAdmin,
  isOwner,
  donorOptions,
  onClose,
  onStatusChange,
  onDonorChange,
  onOwnerUpdate,
  onDocumentUpload,
  onDeletedChange,
}: {
  donation: DonationIn;
  isAdmin: boolean;
  isOwner: boolean;
  donorOptions: DonorOption[];
  onClose: () => void;
  onStatusChange: (donation: DonationIn, status: DonationIn["status"]) => void;
  onDonorChange: (donation: DonationIn, userId: string) => void;
  onOwnerUpdate: (
    donation: DonationIn,
    updates: Partial<DonationIn>,
  ) => Promise<void>;
  onDocumentUpload: (form: DonationForm) => Promise<UploadedDocument | null>;
  onDeletedChange: (donation: DonationIn, deleted: boolean) => void;
}) {
  const isDeleted = Boolean(donation.deleted_at);
  const canOwnerEdit = isOwner && donation.status !== "success" && !isDeleted;
  const [editForm, setEditForm] = useState<DonationForm>({
    donated_at: donation.donated_at.slice(0, 10),
    amount: centsToCurrency(donation.amount_cents).toFixed(2),
    method: donation.method,
    reference_id: donation.reference_id,
    notes: donation.notes ?? "",
    file: null,
  });
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editDocument, setEditDocument] = useState<UploadedDocument | null>(
    null,
  );
  const [editUploadStatus, setEditUploadStatus] =
    useState<UploadStatus>("idle");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingOwnerRecord, setEditingOwnerRecord] = useState(false);

  useEffect(() => {
    setEditForm({
      donated_at: donation.donated_at.slice(0, 10),
      amount: centsToCurrency(donation.amount_cents).toFixed(2),
      method: donation.method,
      reference_id: donation.reference_id,
      notes: donation.notes ?? "",
      file: null,
    });
    setEditErrors({});
    setEditDocument(null);
    setEditUploadStatus("idle");
    setEditingOwnerRecord(false);
  }, [donation]);

  function updateEditForm(nextForm: DonationForm) {
    if (nextForm.donated_at !== editForm.donated_at) {
      setEditDocument(null);
      setEditUploadStatus(nextForm.file ? "error" : "idle");
    }

    setEditForm(nextForm);
  }

  async function handleEditFileChange(file: File | null) {
    const nextForm = { ...editForm, file };
    setEditForm(nextForm);
    setEditDocument(null);
    setEditErrors((current) => ({ ...current, file: "" }));

    if (!file) {
      setEditUploadStatus("idle");
      return;
    }

    if (!nextForm.donated_at) {
      setEditUploadStatus("error");
      setEditErrors((current) => ({
        ...current,
        donated_at: "Select donated date before uploading a document.",
      }));
      return;
    }

    setEditUploadStatus("uploading");
    const uploadedDocument = await onDocumentUpload(nextForm);
    if (uploadedDocument) {
      setEditDocument(uploadedDocument);
      setEditUploadStatus("uploaded");
    } else {
      setEditUploadStatus("error");
    }
  }

  async function handleOwnerEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateDonationEditForm(
      editForm,
      editDocument,
      editUploadStatus,
    );
    setEditErrors(validationErrors);

    if (Object.keys(validationErrors).length) return;

    setSavingEdit(true);
    await onOwnerUpdate(donation, {
      donated_at: new Date(editForm.donated_at).toISOString(),
      amount_cents: currencyToCents(editForm.amount),
      method: editForm.method,
      reference_id: editForm.reference_id.trim(),
      notes: editForm.notes.trim() || null,
      ...(editDocument ? { document_id: editDocument.id } : {}),
    });
    setEditForm((current) => ({ ...current, file: null }));
    setEditDocument(null);
    setEditUploadStatus("idle");
    setEditingOwnerRecord(false);
    setSavingEdit(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{donation.reference_id}</h2>
        <DetailRow
          label="Amount"
          value={currency.format(centsToCurrency(donation.amount_cents))}
        />
        <DetailRow
          label="Method"
          value={formatDonationMethod(donation.method)}
        />
        <DetailRow label="Donated at" value={formatDate(donation.donated_at)} />
        <DetailRow label="Status" value={donation.status} />
        {donation.deleted_at && (
          <DetailRow label="Deleted" value={formatDate(donation.deleted_at)} />
        )}
        <DetailRow label="Created" value={formatDate(donation.created_at)} />
        {(isAdmin || isOwner) && (
          <DetailRow label="User ID" value={donation.user_id ?? "Unknown"} />
        )}
        {(isAdmin || isOwner) && donation.donor_username && (
          <DetailRow label="Username" value={`@${donation.donor_username}`} />
        )}
        {!isAdmin && !isOwner && donation.donor_reference_id && (
          <DetailRow
            label="User Reference"
            value={donation.donor_reference_id}
          />
        )}
        <DocumentViewer
          recordType="donation_in"
          recordId={donation.id}
          documentId={donation.document_id}
          canView={isAdmin || isOwner}
        />
        {canOwnerEdit && !editingOwnerRecord && (
          <button
            className="secondary-action modal-action"
            type="button"
            onClick={() => setEditingOwnerRecord(true)}
          >
            <Edit3 aria-hidden="true" />
            Edit my record
          </button>
        )}
        {isAdmin && (
          <>
            <div className="field-group">
              <label className="field-label">Admin donor</label>
              <select
                value={donation.user_id ?? ""}
                onChange={(event) =>
                  onDonorChange(donation, event.target.value)
                }
              >
                {donorOptions.map((donor) => (
                  <option key={donor.id} value={donor.id}>
                    {donor.username === "community_donor"
                      ? "Community Donor"
                      : `${donor.name || donor.username} (@${donor.username})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Admin status</label>
              <select
                value={donation.status}
                onChange={(event) =>
                  onStatusChange(
                    donation,
                    event.target.value as DonationIn["status"],
                  )
                }
              >
                <option value="pending">Pending</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <button
              className="secondary-action danger-action"
              type="button"
              onClick={() => onDeletedChange(donation, !isDeleted)}
            >
              {isDeleted ? "Restore record" : "Delete record"}
            </button>
          </>
        )}
        {canOwnerEdit && editingOwnerRecord && (
          <form
            className="donation-form modal-edit"
            onSubmit={handleOwnerEditSubmit}
          >
            <div className="section-header">
              <h3>Edit My Record</h3>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setEditingOwnerRecord(false)}
              >
                Cancel
              </button>
            </div>
            <DonationFields
              form={editForm}
              errors={editErrors}
              uploadedDocument={editDocument}
              uploadStatus={editUploadStatus}
              onChange={updateEditForm}
              onFileChange={handleEditFileChange}
              documentLabel="Replace document"
              documentRequired={false}
            />
            <button
              type="submit"
              disabled={savingEdit || editUploadStatus === "uploading"}
            >
              {savingEdit ? "Saving..." : "Save changes"}
            </button>
          </form>
        )}
        {isOwner && donation.status === "success" && (
          <p className="muted">
            This donation is approved, so it can no longer be edited.
          </p>
        )}
      </section>
    </div>
  );
}

function DonationOutModal({
  donation,
  detail,
  media,
  isAdmin,
  onClose,
  onSave,
  onDetailSave,
  onMediaUpload,
  onMediaDelete,
  onMediaReorder,
  onDeletedChange,
  onOpenPage,
}: {
  donation: DonationOut;
  detail: DonationOutDetail | null;
  media: DonationOutMedia[];
  isAdmin: boolean;
  onClose: () => void;
  onSave: (donationId: string, updates: Partial<DonationOut>) => void;
  onDetailSave: (
    donationId: string,
    detailForm: typeof emptyDonationOutDetailForm,
  ) => void;
  onMediaUpload: (
    donationId: string,
    file: File,
  ) => Promise<DonationOutMedia | null>;
  onMediaDelete: (media: DonationOutMedia) => void;
  onMediaReorder: (
    donationId: string,
    orderedMedia: DonationOutMedia[],
  ) => void;
  onDeletedChange: (donation: DonationOut, deleted: boolean) => void;
  onOpenPage: (donationId: string) => void;
}) {
  const isDeleted = Boolean(donation.deleted_at);
  const [editForm, setEditForm] = useState({
    donee_name: donation.donee_name,
    address: donation.address ?? "",
    donated_at: donation.donated_at.slice(0, 10),
    amount: centsToCurrency(donation.amount_cents).toFixed(2),
    method: donation.method,
    reference_id: donation.reference_id,
    status: donation.status,
    notes: donation.notes ?? "",
  });

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onSave(donation.id, {
      donee_name: editForm.donee_name.trim(),
      address: editForm.address.trim() || null,
      donated_at: new Date(editForm.donated_at).toISOString(),
      amount_cents: currencyToCents(editForm.amount),
      method: editForm.method,
      reference_id: editForm.reference_id.trim(),
      status: editForm.status,
      notes: editForm.notes.trim() || null,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{donation.donee_name}</h2>
        <DetailRow
          label="Amount"
          value={currency.format(centsToCurrency(donation.amount_cents))}
        />
        <DetailRow
          label="Method"
          value={formatDonationMethod(donation.method)}
        />
        <DetailRow label="Reference" value={donation.reference_id} />
        <DetailRow label="Donated at" value={formatDate(donation.donated_at)} />
        <DetailRow label="Status" value={donation.status} />
        {donation.deleted_at && (
          <DetailRow label="Deleted" value={formatDate(donation.deleted_at)} />
        )}
        {donation.address && (
          <DetailRow label="Address" value={donation.address} />
        )}
        {donation.notes && <DetailRow label="Notes" value={donation.notes} />}
        {detail?.is_published && (
          <button
            className="secondary-action"
            type="button"
            onClick={() => onOpenPage(donation.id)}
          >
            <ExternalLink aria-hidden="true" />
            Open detail page
          </button>
        )}
        <DocumentViewer
          recordType="donation_out"
          recordId={donation.id}
          documentId={donation.document_id}
          canView
        />
        {isAdmin && (
          <form className="donation-form modal-edit" onSubmit={handleSave}>
            <FieldGroup>
              <RequiredLabel>Donee name</RequiredLabel>
              <input
                value={editForm.donee_name}
                onChange={(event) =>
                  setEditForm({ ...editForm, donee_name: event.target.value })
                }
              />
            </FieldGroup>
            <FieldGroup>
              <label className="field-label">Address</label>
              <textarea
                value={editForm.address}
                onChange={(event) =>
                  setEditForm({ ...editForm, address: event.target.value })
                }
              />
            </FieldGroup>
            <FieldGroup>
              <RequiredLabel>Donated at</RequiredLabel>
              <input
                type="date"
                value={editForm.donated_at}
                onChange={(event) =>
                  setEditForm({ ...editForm, donated_at: event.target.value })
                }
              />
            </FieldGroup>
            <FieldGroup>
              <RequiredLabel>Amount</RequiredLabel>
              <input
                type="number"
                min="1"
                step="0.01"
                value={editForm.amount}
                onChange={(event) =>
                  setEditForm({ ...editForm, amount: event.target.value })
                }
              />
            </FieldGroup>
            <DonationMethodField
              value={editForm.method}
              onChange={(method) => setEditForm({ ...editForm, method })}
            />
            <FieldGroup>
              <RequiredLabel>Reference ID</RequiredLabel>
              <input
                value={editForm.reference_id}
                onChange={(event) =>
                  setEditForm({ ...editForm, reference_id: event.target.value })
                }
              />
            </FieldGroup>
            <FieldGroup>
              <label className="field-label">Status</label>
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    status: event.target.value as DonationOut["status"],
                  })
                }
              >
                <option value="pending">Pending</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </FieldGroup>
            <FieldGroup>
              <label className="field-label">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(event) =>
                  setEditForm({ ...editForm, notes: event.target.value })
                }
              />
            </FieldGroup>
            <button type="submit">Save changes</button>
            <button
              className="danger-action"
              type="button"
              onClick={() => onDeletedChange(donation, !isDeleted)}
            >
              {isDeleted ? "Restore record" : "Delete record"}
            </button>
          </form>
        )}
        {isAdmin && !isDeleted && (
          <DonationOutPageEditor
            donation={donation}
            detail={detail}
            media={media}
            onSave={onDetailSave}
            onMediaUpload={onMediaUpload}
            onMediaDelete={onMediaDelete}
            onMediaReorder={onMediaReorder}
          />
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

function DonationOutPageEditor({
  donation,
  detail,
  media,
  onSave,
  onMediaUpload,
  onMediaDelete,
  onMediaReorder,
}: {
  donation: DonationOut;
  detail: DonationOutDetail | null;
  media: DonationOutMedia[];
  onSave: (
    donationId: string,
    detailForm: typeof emptyDonationOutDetailForm,
  ) => void;
  onMediaUpload: (
    donationId: string,
    file: File,
  ) => Promise<DonationOutMedia | null>;
  onMediaDelete: (media: DonationOutMedia) => void;
  onMediaReorder: (
    donationId: string,
    orderedMedia: DonationOutMedia[],
  ) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedMediaId, setDraggedMediaId] = useState<string | null>(null);
  const [detailForm, setDetailForm] = useState(emptyDonationOutDetailForm);
  const coverImageId =
    media.find((item) => item.media_type === "image")?.id ?? null;

  useEffect(() => {
    setDetailForm({
      title: detail?.title ?? "",
      subtitle: detail?.subtitle ?? "",
      description: detail?.description ?? "",
      contact_info: detail?.contact_info ?? "",
      is_published: detail?.is_published ?? false,
    });
  }, [detail]);

  async function handleMediaFiles(files: FileList | null) {
    if (!files?.length) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      await onMediaUpload(donation.id, file);
    }
    setUploading(false);
  }

  function moveMedia(targetId: string) {
    if (!draggedMediaId || draggedMediaId === targetId) return;

    const nextMedia = [...media];
    const fromIndex = nextMedia.findIndex((item) => item.id === draggedMediaId);
    const toIndex = nextMedia.findIndex((item) => item.id === targetId);

    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = nextMedia.splice(fromIndex, 1);
    nextMedia.splice(toIndex, 0, moved);
    onMediaReorder(donation.id, nextMedia);
  }

  return (
    <section className="page-editor">
      <button
        className="secondary-action page-editor-toggle"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        <Edit3 aria-hidden="true" />
        {expanded ? "Hide detail page content" : "Edit detail page content"}
      </button>

      {expanded && (
        <div className="page-editor-body">
          <div className="grid-fields">
            <FieldGroup>
              <label className="field-label">Title</label>
              <input
                value={detailForm.title}
                onChange={(event) =>
                  setDetailForm({ ...detailForm, title: event.target.value })
                }
              />
            </FieldGroup>
            <FieldGroup>
              <label className="field-label">Subtitle</label>
              <input
                value={detailForm.subtitle}
                onChange={(event) =>
                  setDetailForm({ ...detailForm, subtitle: event.target.value })
                }
              />
            </FieldGroup>
          </div>
          <FieldGroup>
            <label className="field-label">Description</label>
            <textarea
              value={detailForm.description}
              onChange={(event) =>
                setDetailForm({
                  ...detailForm,
                  description: event.target.value,
                })
              }
            />
          </FieldGroup>
          <FieldGroup>
            <label className="field-label">Contact information</label>
            <textarea
              value={detailForm.contact_info}
              onChange={(event) =>
                setDetailForm({
                  ...detailForm,
                  contact_info: event.target.value,
                })
              }
            />
          </FieldGroup>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={detailForm.is_published}
              onChange={(event) =>
                setDetailForm({
                  ...detailForm,
                  is_published: event.target.checked,
                })
              }
            />
            Publish detail page
          </label>
          <button type="button" onClick={() => onSave(donation.id, detailForm)}>
            Save detail page
          </button>

          <div className="media-upload-panel">
            <label className="media-upload-box">
              <ImageIcon aria-hidden="true" />
              <span>
                {uploading ? "Uploading media..." : "Upload images or videos"}
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={uploading}
                onChange={(event) => {
                  void handleMediaFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          {media.length ? (
            <div className="media-manager-list">
              {media.map((item) => (
                <article
                  className="media-manager-item"
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedMediaId(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveMedia(item.id)}
                  onDragEnd={() => setDraggedMediaId(null)}
                >
                  <GripVertical aria-hidden="true" />
                  <MediaPreview donationId={donation.id} media={item} compact />
                  <div>
                    <strong>{item.file_name}</strong>
                    <span>
                      {item.id === coverImageId
                        ? "Cover image"
                        : item.media_type}
                    </span>
                  </div>
                  <button
                    className="danger-action"
                    type="button"
                    onClick={() => onMediaDelete(item)}
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">
              Uploaded images will power the carousel. Uploaded videos will
              appear in the video section.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function DonationOutHeroCarousel({
  slides,
}: {
  slides: Array<{
    donation: DonationOut;
    detail: DonationOutDetail;
    cover: DonationOutMedia;
  }>;
}) {
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.floor(slides.length / 2),
  );
  const dragStartXRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    setActiveIndex(Math.floor(slides.length / 2));
  }, [slides.length]);

  if (!slides.length) {
    return (
      <section className="story-hero story-hero-empty">
        <div>
          <p className="eyebrow">Donation stories</p>
          <h2>Published stories will show here</h2>
          <span>
            Published donation-out pages with images will appear in this
            carousel.
          </span>
        </div>
      </section>
    );
  }

  function getSlideOffset(index: number) {
    return index - activeIndex;
  }

  function moveSlide(direction: -1 | 1) {
    setActiveIndex((current) =>
      Math.min(Math.max(current + direction, 0), slides.length - 1),
    );
  }

  function handleCarouselPointerDown(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest(".carousel-control")) return;
    dragStartXRef.current = event.clientX;
    dragMovedRef.current = false;
  }

  function handleCarouselPointerMove(event: PointerEvent<HTMLElement>) {
    if (dragStartXRef.current === null) return;

    if (Math.abs(event.clientX - dragStartXRef.current) > 10) {
      dragMovedRef.current = true;
    }
  }

  function handleCarouselPointerEnd(event: PointerEvent<HTMLElement>) {
    if (dragStartXRef.current === null) return;

    const distance = event.clientX - dragStartXRef.current;
    dragStartXRef.current = null;

    if (Math.abs(distance) > 48) {
      moveSlide(distance < 0 ? 1 : -1);
    }

    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 0);
  }

  return (
    <section
      className="story-carousel coverflow-carousel"
      aria-label="Recent donation stories"
      onPointerDown={handleCarouselPointerDown}
      onPointerMove={handleCarouselPointerMove}
      onPointerUp={handleCarouselPointerEnd}
      onPointerCancel={() => {
        dragStartXRef.current = null;
        dragMovedRef.current = false;
      }}
    >
      <button
        className="carousel-control carousel-control-left"
        type="button"
        onClick={() => moveSlide(-1)}
        disabled={activeIndex === 0}
        aria-label="Previous donation"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      {slides.map(({ donation, detail, cover }, index) => {
        const offset = getSlideOffset(index);
        const isActive = offset === 0;
        const hidden = Math.abs(offset) > 2;

        return (
          <button
            className={`story-slide coverflow-slide ${isActive ? "active" : ""} ${hidden ? "hidden" : ""}`}
            data-offset={String(offset)}
            key={donation.id}
            type="button"
            onClick={() => {
              if (dragMovedRef.current) {
                dragMovedRef.current = false;
                return;
              }

              if (isActive) {
                openHashDonationOutPage(donation.id);
              } else {
                setActiveIndex(index);
              }
            }}
          >
            <MediaPreview donationId={donation.id} media={cover} />
            <div className="story-slide-copy">
              <p className="eyebrow">Recent distribution</p>
              <h2>{detail.title || donation.donee_name}</h2>
              {detail.subtitle && <span>{detail.subtitle}</span>}
              <strong>
                {currency.format(centsToCurrency(donation.amount_cents))}
              </strong>
            </div>
          </button>
        );
      })}
      <button
        className="carousel-control carousel-control-right"
        type="button"
        onClick={() => moveSlide(1)}
        disabled={activeIndex === slides.length - 1}
        aria-label="Next donation"
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </section>
  );
}

function DonationOutDetailPage({
  donation,
  detail,
  media,
  isAdmin,
}: {
  donation: DonationOut | null;
  detail: DonationOutDetail | null;
  media: DonationOutMedia[];
  isAdmin: boolean;
}) {
  const imageStripRef = useRef<HTMLDivElement | null>(null);
  const [detailCarouselPaused, setDetailCarouselPaused] = useState(false);
  const imageCount = media.filter((item) => item.media_type === "image").length;

  useEffect(() => {
    if (!donation || detailCarouselPaused || imageCount < 2) return;

    const interval = window.setInterval(() => {
      const strip = imageStripRef.current;
      if (!strip) return;

      const maxScrollLeft = strip.scrollWidth - strip.clientWidth - 4;
      const nextLeft =
        strip.scrollLeft >= maxScrollLeft
          ? 0
          : strip.scrollLeft + strip.clientWidth;
      strip.scrollTo({ left: nextLeft, behavior: "smooth" });
    }, 4500);

    return () => window.clearInterval(interval);
  }, [detailCarouselPaused, donation, imageCount]);

  function moveDetailSlide(direction: -1 | 1) {
    const strip = imageStripRef.current;
    if (!strip) return;

    const maxScrollLeft = strip.scrollWidth - strip.clientWidth - 4;
    let nextLeft = strip.scrollLeft + strip.clientWidth * direction;

    if (nextLeft > maxScrollLeft) nextLeft = 0;
    if (nextLeft < 0) nextLeft = strip.scrollWidth - strip.clientWidth;

    strip.scrollTo({ left: nextLeft, behavior: "smooth" });
  }

  if (!donation) {
    return (
      <section className="record-section">
        <EmptyState title="Donation page was not found." />
      </section>
    );
  }

  const visible =
    isAdmin ||
    (detail?.is_published &&
      donation.status === "success" &&
      !donation.deleted_at);
  const images = media.filter((item) => item.media_type === "image");
  const videos = media.filter((item) => item.media_type === "video");

  if (!visible) {
    return (
      <section className="record-section">
        <EmptyState title="This donation page is not published yet." />
      </section>
    );
  }

  return (
    <section className="detail-page">
      <div className="detail-hero">
        {images.length ? (
          <div
            className="detail-image-carousel"
            onMouseEnter={() => setDetailCarouselPaused(true)}
            onMouseLeave={() => setDetailCarouselPaused(false)}
            onFocusCapture={() => setDetailCarouselPaused(true)}
            onBlurCapture={() => setDetailCarouselPaused(false)}
          >
            {images.length > 1 && (
              <button
                className="carousel-control carousel-control-left detail-carousel-control"
                type="button"
                onClick={() => moveDetailSlide(-1)}
                aria-label="Previous image"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
            )}
            <div className="detail-image-strip" ref={imageStripRef}>
              {images.map((item) => (
                <MediaPreview
                  donationId={donation.id}
                  media={item}
                  key={item.id}
                />
              ))}
            </div>
            {images.length > 1 && (
              <button
                className="carousel-control carousel-control-right detail-carousel-control"
                type="button"
                onClick={() => moveDetailSlide(1)}
                aria-label="Next image"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            )}
          </div>
        ) : (
          <div className="story-hero story-hero-empty">
            <div>
              <p className="eyebrow">Donation story</p>
              <h2>{detail?.title || donation.donee_name}</h2>
            </div>
          </div>
        )}
        <div className="detail-page-copy">
          <p className="eyebrow">Donation Out</p>
          <h2>{detail?.title || donation.donee_name}</h2>
          {detail?.subtitle && <h3>{detail.subtitle}</h3>}
          <DetailRow
            label="Cost"
            value={currency.format(centsToCurrency(donation.amount_cents))}
          />
          <DetailRow
            label="Method"
            value={formatDonationMethod(donation.method)}
          />
          <DetailRow label="Date" value={formatDate(donation.donated_at)} />
          <DetailRow label="Reference" value={donation.reference_id} />
          {donation.address && (
            <DetailRow label="Address" value={donation.address} />
          )}
        </div>
      </div>

      {detail?.description && (
        <article className="story-content">
          <h3>Description</h3>
          <p>{detail.description}</p>
        </article>
      )}

      {detail?.contact_info && (
        <article className="story-content">
          <h3>Contact Information</h3>
          <p>{detail.contact_info}</p>
        </article>
      )}

      {videos.length > 0 && (
        <section className="video-section">
          <h3>Videos</h3>
          <div className="video-grid">
            {videos.map((item) => (
              <MediaPreview
                donationId={donation.id}
                media={item}
                key={item.id}
              />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function MediaPreview({
  donationId,
  media,
  compact = false,
}: {
  donationId: string;
  media: DonationOutMedia;
  compact?: boolean;
}) {
  const [previewDocument, setPreviewDocument] =
    useState<PreviewDocument | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMedia() {
      if (!supabase) return;

      const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
      if (!appsScriptUrl) return;

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const payload = accessToken
        ? {
            action: "getDocumentFile",
            accessToken,
            donationType: "donation_out",
            donationId,
            documentId: media.document_id,
          }
        : {
            action: "getPublicDonationOutMedia",
            donationId,
            mediaId: media.id,
          };

      try {
        const response = await fetch(appsScriptUrl, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!active) return;

        if (result.ok) {
          setPreviewDocument(result.document as PreviewDocument);
        } else {
          setFailed(true);
        }
      } catch {
        if (active) setFailed(true);
      }
    }

    loadMedia();

    return () => {
      active = false;
    };
  }, [donationId, media.document_id, media.id]);

  if (failed) {
    return (
      <div className={`media-preview-fallback ${compact ? "compact" : ""}`}>
        {media.media_type === "video" ? (
          <Video aria-hidden="true" />
        ) : (
          <ImageIcon aria-hidden="true" />
        )}
      </div>
    );
  }

  if (!previewDocument) {
    if (media.media_type === "image" && media.thumbnail_data_url) {
      return (
        <img
          className={
            compact
              ? "media-preview media-preview-thumbnail compact"
              : "media-preview media-preview-thumbnail"
          }
          src={media.thumbnail_data_url}
          alt={media.file_name}
        />
      );
    }

    return (
      <div
        className={`media-preview-loading ${compact ? "compact" : ""}`}
        aria-label="Loading media"
      >
        <span className="sr-only">Loading media</span>
      </div>
    );
  }

  const dataUrl = getDocumentDataUrl(previewDocument);

  if (media.media_type === "video") {
    return (
      <video
        className={compact ? "media-preview compact" : "media-preview"}
        src={dataUrl}
        controls={!compact}
        muted={compact}
      />
    );
  }

  return (
    <img
      className={compact ? "media-preview compact" : "media-preview"}
      src={dataUrl}
      alt={media.file_name}
    />
  );
}

function DocumentViewer({
  recordType,
  recordId,
  documentId,
  canView,
}: {
  recordType: "donation_in" | "donation_out";
  recordId: string;
  documentId?: string | null;
  canView: boolean;
}) {
  const [document, setDocument] = useState<PreviewDocument | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [showLargePreview, setShowLargePreview] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDocument() {
      if (!canView) return;

      setLoadingDocument(true);
      setDocumentError(null);

      if (!supabase) {
        setDocumentError("Supabase is not configured.");
        setLoadingDocument(false);
        return;
      }

      const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
      if (!appsScriptUrl) {
        setDocumentError("Apps Script URL is not configured.");
        setLoadingDocument(false);
        return;
      }

      const { data } = await supabase!.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setDocumentError("Please sign in again to view the document.");
        setLoadingDocument(false);
        return;
      }

      try {
        const response = await fetch(appsScriptUrl, {
          method: "POST",
          body: JSON.stringify({
            action: "getDocumentFile",
            accessToken,
            donationType: recordType,
            donationId: recordId,
            documentId,
          }),
        });
        const result = await response.json();

        if (!active) return;

        if (!result.ok) {
          setDocumentError(result.error || "Document preview failed.");
        } else {
          setDocument(result.document as PreviewDocument);
        }
      } catch (previewError) {
        if (active) {
          setDocumentError(
            previewError instanceof Error
              ? previewError.message
              : "Document preview failed.",
          );
        }
      } finally {
        if (active) setLoadingDocument(false);
      }
    }

    loadDocument();

    return () => {
      active = false;
    };
  }, [canView, documentId, recordId, recordType]);

  if (!canView) {
    return (
      <p className="muted document-note">
        Document is visible only to the donor and admins.
      </p>
    );
  }

  if (loadingDocument) {
    return <DocumentLoadingSkeleton />;
  }

  if (documentError) {
    return <p className="error-banner">{documentError}</p>;
  }

  if (!document) return null;

  const previewDocument = document;
  const dataUrl = getDocumentDataUrl(previewDocument);
  const isImage = previewDocument.mime_type.startsWith("image/");
  const isPdf = previewDocument.mime_type === "application/pdf";

  function handleDownload() {
    downloadDocument(previewDocument);
  }

  function handlePrint() {
    printDocumentInPage(previewDocument);
  }

  return (
    <section className="document-viewer">
      <div className="section-header">
        <h3>Document</h3>
        <div className="document-actions">
          <button type="button" onClick={() => setShowLargePreview(true)}>
            <ExternalLink aria-hidden="true" />
            View
          </button>
          <button type="button" onClick={handleDownload}>
            <Download aria-hidden="true" />
            Download
          </button>
          <button type="button" onClick={handlePrint}>
            <Printer aria-hidden="true" />
            Print
          </button>
        </div>
      </div>

      {isImage && (
        <img
          className="document-full-preview"
          src={dataUrl}
          alt={document.file_name}
        />
      )}
      {isPdf && (
        <div className="pdf-document-card">
          <FileText aria-hidden="true" />
          <div>
            <strong>PDF document</strong>
            <span>{document.file_name}</span>
          </div>
        </div>
      )}
      {!isImage && !isPdf && (
        <p className="muted">
          Preview is not available for this file type. Use View or Download.
        </p>
      )}
      <p className="muted document-file-name">{document.file_name}</p>
      {showLargePreview && (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={() => setShowLargePreview(false)}
        />
      )}
    </section>
  );
}

function DocumentLoadingSkeleton() {
  return (
    <section
      className="document-viewer document-viewer-skeleton"
      aria-label="Loading document"
    >
      <div className="section-header">
        <div className="skeleton-line skeleton-title" />
        <div className="document-actions">
          <span className="skeleton-button" />
          <span className="skeleton-button" />
          <span className="skeleton-button" />
        </div>
      </div>
      <div className="document-preview-skeleton" />
      <div className="skeleton-line skeleton-caption" />
      <span className="sr-only">Loading document</span>
    </section>
  );
}

function DocumentPreviewModal({
  document,
  onClose,
}: {
  document: PreviewDocument;
  onClose: () => void;
}) {
  const dataUrl = getDocumentDataUrl(document);
  const isImage = document.mime_type.startsWith("image/");
  const isPdf = document.mime_type === "application/pdf";

  return (
    <div className="document-preview-backdrop" onClick={onClose}>
      <section
        className="document-preview-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-header">
          <h3>{document.file_name}</h3>
          <div className="document-actions">
            <button type="button" onClick={() => downloadDocument(document)}>
              <Download aria-hidden="true" />
              Download
            </button>
            <button type="button" onClick={() => printDocumentInPage(document)}>
              <Printer aria-hidden="true" />
              Print
            </button>
          </div>
        </div>
        {isImage && (
          <img
            className="document-large-image"
            src={dataUrl}
            alt={document.file_name}
          />
        )}
        {isPdf && (
          <iframe
            className="document-large-frame"
            src={dataUrl}
            title={document.file_name}
          />
        )}
        {!isImage && !isPdf && (
          <p className="muted">Preview is not available for this file type.</p>
        )}
      </section>
    </div>
  );
}

function validateDonationForm(
  form: DonationForm,
  uploadedDocument: UploadedDocument | null,
  uploadStatus: UploadStatus,
) {
  const errors: FieldErrors = {};

  if (!form.donated_at) errors.donated_at = "Donated date is required.";
  if (!form.reference_id.trim())
    errors.reference_id = "Reference ID is required.";
  if (!form.amount || Number(form.amount) <= 0)
    errors.amount = "Amount must be greater than zero.";
  if (!form.file) errors.file = "Document is required.";
  if (form.file && uploadStatus === "uploading")
    errors.file = "Document is still uploading.";
  if (form.file && uploadStatus === "error")
    errors.file = "Document upload failed. Replace the file and try again.";
  if (form.file && uploadStatus !== "uploading" && !uploadedDocument)
    errors.file = "Document must be uploaded before saving.";
  if (form.file && !isValidDocumentFile(form.file))
    errors.file = "Upload an image or PDF document.";

  return errors;
}

function validateDonationEditForm(
  form: DonationForm,
  uploadedDocument: UploadedDocument | null,
  uploadStatus: UploadStatus,
) {
  const errors: FieldErrors = {};

  if (!form.donated_at) errors.donated_at = "Donated date is required.";
  if (!form.reference_id.trim())
    errors.reference_id = "Reference ID is required.";
  if (!form.amount || Number(form.amount) <= 0)
    errors.amount = "Amount must be greater than zero.";
  if (form.file && uploadStatus === "uploading")
    errors.file = "Document is still uploading.";
  if (form.file && uploadStatus === "error")
    errors.file = "Document upload failed. Replace the file and try again.";
  if (form.file && uploadStatus !== "uploading" && !uploadedDocument)
    errors.file = "Document must be uploaded before saving.";
  if (form.file && !isValidDocumentFile(form.file))
    errors.file = "Upload an image or PDF document.";

  return errors;
}

function validateDonationOutForm(
  form: DonationOutForm,
  uploadedDocument: UploadedDocument | null,
  uploadStatus: UploadStatus,
) {
  const errors = validateDonationForm(form, uploadedDocument, uploadStatus);
  if (!form.donee_name.trim()) errors.donee_name = "Donee name is required.";

  return errors;
}

function isValidDocumentFile(file: File) {
  return file.type.startsWith("image/") || file.type === "application/pdf";
}

function currencyToCents(value: string) {
  return Math.round(Number(value) * 100);
}

function centsToCurrency(value: number) {
  return Number(value) / 100;
}

function getDocumentDataUrl(document: PreviewDocument) {
  return `data:${document.mime_type};base64,${document.base64}`;
}

function downloadDocument(document: PreviewDocument) {
  const dataUrl = getDocumentDataUrl(document);
  const link = window.document.createElement("a");
  link.href = dataUrl;
  link.download = document.file_name;
  link.style.display = "none";
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}

function printDocumentInPage(document: PreviewDocument) {
  const printFrame = window.document.createElement("iframe");
  const escapedName = escapeHtml(document.file_name);
  const objectUrl = URL.createObjectURL(
    base64ToBlob(document.base64, document.mime_type),
  );

  printFrame.className = "print-frame";
  window.document.body.appendChild(printFrame);

  const cleanup = () => {
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      printFrame.remove();
    }, 60000);
  };

  if (!printFrame.contentWindow) {
    printFrame.remove();
    return;
  }

  if (!document.mime_type.startsWith("image/")) {
    printFrame.onload = () => {
      window.setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        cleanup();
      }, 500);
    };
    printFrame.src = objectUrl;
    return;
  }

  const frameDocument =
    printFrame.contentDocument || printFrame.contentWindow.document;
  if (!frameDocument) {
    printFrame.remove();
    return;
  }

  frameDocument.open();
  frameDocument.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapedName}</title>
        <style>
          html,
          body {
            margin: 0;
            min-height: 100%;
          }

          body {
            display: grid;
            place-items: center;
            background: #ffffff;
          }

          img {
            max-width: 100%;
            max-height: 100vh;
            object-fit: contain;
          }

          iframe {
            width: 100vw;
            height: 100vh;
            border: 0;
          }
        </style>
      </head>
      <body>
        <img src="${objectUrl}" alt="${escapedName}" />
        <script>
          window.addEventListener('load', function () {
            window.focus();
            setTimeout(function () {
              window.print();
            }, 400);
          });
        </script>
      </body>
    </html>
  `);
  frameDocument.close();
  cleanup();
}

function base64ToBlob(base64: string, mimeType: string) {
  const bytes = window.atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < bytes.length; offset += 512) {
    const slice = bytes.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let index = 0; index < slice.length; index += 1) {
      byteNumbers[index] = slice.charCodeAt(index);
    }

    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: mimeType });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#039;";
    }
  });
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function createImageThumbnailDataUrl(file: File) {
  return new Promise<string | null>((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const maxSide = 960;
      const scale = Math.min(
        1,
        maxSide / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d");

      URL.revokeObjectURL(objectUrl);

      if (!context) {
        resolve(null);
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    image.src = objectUrl;
  });
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isCommunityDonorContribution(donation: PublicDonationIn) {
  return donation.user_id === COMMUNITY_DONOR_ID || donation.donor_reference_id === "COMMUNITY-DONOR";
}

function buildMonthlyFlow(
  contributions: PublicDonationIn[],
  distributions: DonationOut[],
) {
  const monthStarts = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - (11 - index));
    return date;
  });
  const monthMap = new Map<string, DashboardMonth>(
    monthStarts.map((date) => [
      getMonthKey(date),
      {
        key: getMonthKey(date),
        label: monthFormatter.format(date),
        contributions: 0,
        distributions: 0,
      },
    ]),
  );

  contributions
    .filter((donation) => donation.status === "success")
    .forEach((donation) => {
      const month = monthMap.get(getMonthKey(new Date(donation.donated_at)));
      if (month) month.contributions += centsToCurrency(donation.amount_cents);
    });

  distributions
    .filter((donation) => donation.status === "success")
    .forEach((donation) => {
      const month = monthMap.get(getMonthKey(new Date(donation.donated_at)));
      if (month) month.distributions += centsToCurrency(donation.amount_cents);
    });

  return Array.from(monthMap.values());
}

function buildDashboardActivity(
  contributions: PublicDonationIn[],
  distributions: DonationOut[],
) {
  const contributionActivity: DashboardActivity[] = contributions
    .filter((donation) => donation.status === "success")
    .map((donation) => ({
      id: `in-${donation.id}`,
      kind: "Contribution",
      label: donation.donor_reference_id || donation.reference_id,
      amount: centsToCurrency(donation.amount_cents),
      date: donation.donated_at,
    }));
  const distributionActivity: DashboardActivity[] = distributions
    .filter((donation) => donation.status === "success")
    .map((donation) => ({
      id: `out-${donation.id}`,
      kind: "Distribution",
      label: donation.donee_name,
      amount: centsToCurrency(donation.amount_cents),
      date: donation.donated_at,
    }));

  return [...contributionActivity, ...distributionActivity]
    .sort(
      (first, second) =>
        new Date(second.date).getTime() - new Date(first.date).getTime(),
    )
    .slice(0, 5);
}

function filterAndSortIncoming<T extends DonationIn | PublicDonationIn>(
  records: T[],
  search: string,
  sort: SortKey,
) {
  const query = search.trim().toLowerCase();

  return [...records]
    .filter((record) => {
      if (!query) return true;
      return [
        record.reference_id,
        record.donor_username,
        record.donor_reference_id,
        formatDonationMethod(record.method),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((a, b) => new Date(b[sort]).getTime() - new Date(a[sort]).getTime());
}

function filterAndSortOutgoing(
  records: DonationOut[],
  search: string,
  sort: SortKey,
) {
  const query = search.trim().toLowerCase();

  return [...records]
    .filter((record) => {
      if (!query) return true;
      return [
        record.reference_id,
        record.donee_name,
        formatDonationMethod(record.method),
      ].some((value) => value.toLowerCase().includes(query));
    })
    .sort((a, b) => new Date(b[sort]).getTime() - new Date(a[sort]).getTime());
}
