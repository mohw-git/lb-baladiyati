'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useTranslate, useLocale, type MessageKey } from '@/lib/i18n';
import { PERMISSIONS } from '@shared/constants/permissions';
import { useQuery } from '@tanstack/react-query';
import { municipalitiesApi } from '@/lib/api';
import { MunicipalityBrandHeader } from '@/components/municipality/municipality-brand-header';
import { resolveMunicipalityMediaUrl } from '@/lib/municipality-branding';
import {
  LayoutDashboard,
  MessageSquareWarning,
  Users,
  Shield,
  Building,
  Tags,
  Newspaper,
  Bell,
  Building2,
  ShieldCheck,
  Globe,
  Activity,
  UserCog,
  ScrollText,
  Wrench,
  Paintbrush,
  Megaphone,
  ListChecks,
  ArrowRightLeft,
  HandHelping,
  User,
  History,
  ChevronsLeft,
  ChevronsRight,
  Settings,
  Map,
} from 'lucide-react';

interface NavItem {
  labelKey: MessageKey;
  href: string;
  icon: React.ReactNode;
  permissions?: string[];
}

const personalNavItems: NavItem[] = [
  {
    labelKey: 'nav.dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    labelKey: 'nav.complaints',
    href: '/complaints',
    icon: <MessageSquareWarning className="h-4 w-4" />,
    permissions: [
      PERMISSIONS.COMPLAINT_VIEW_ALL,
      PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
      PERMISSIONS.COMPLAINT_VIEW_ASSIGNED,
      PERMISSIONS.COMPLAINT_VIEW_OWN,
    ],
  },
  {
    labelKey: 'nav.notifications',
    href: '/notifications',
    icon: <Bell className="h-4 w-4" />,
  },
  {
    labelKey: 'nav.profile',
    href: '/profile',
    icon: <User className="h-4 w-4" />,
  },
];

const adminNavItems: NavItem[] = [
  {
    labelKey: 'nav.tasks',
    href: '/tasks',
    icon: <ListChecks className="h-4 w-4" />,
    permissions: [
      PERMISSIONS.TASK_VIEW_ALL,
      PERMISSIONS.TASK_VIEW_DEPARTMENT,
      PERMISSIONS.TASK_VIEW_ASSIGNED,
    ],
  },
  {
    labelKey: 'nav.transfers',
    href: '/transfers',
    icon: <ArrowRightLeft className="h-4 w-4" />,
    permissions: [PERMISSIONS.TRANSFER_VIEW],
  },
  {
    labelKey: 'nav.helpRequests',
    href: '/help-requests',
    icon: <HandHelping className="h-4 w-4" />,
    permissions: [PERMISSIONS.HELP_VIEW],
  },
  {
    labelKey: 'nav.users',
    href: '/users',
    icon: <Users className="h-4 w-4" />,
    permissions: [PERMISSIONS.USER_VIEW_ALL, PERMISSIONS.USER_VIEW_DEPARTMENT],
  },
  {
    labelKey: 'nav.departments',
    href: '/departments',
    icon: <Building className="h-4 w-4" />,
    permissions: [
      PERMISSIONS.DEPARTMENT_CREATE,
      PERMISSIONS.DEPARTMENT_UPDATE,
      PERMISSIONS.COMPLAINT_VIEW_ALL,
      PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
    ],
  },
  {
    labelKey: 'nav.roles',
    href: '/roles',
    icon: <Shield className="h-4 w-4" />,
    permissions: [PERMISSIONS.ROLE_VIEW],
  },
  {
    labelKey: 'nav.categories',
    href: '/categories',
    icon: <Tags className="h-4 w-4" />,
    permissions: [PERMISSIONS.CATEGORY_CREATE, PERMISSIONS.CATEGORY_UPDATE],
  },
  {
    labelKey: 'nav.news',
    href: '/news',
    icon: <Newspaper className="h-4 w-4" />,
    permissions: [PERMISSIONS.NEWS_CREATE, PERMISSIONS.NEWS_UPDATE],
  },
  {
    labelKey: 'nav.kyc',
    href: '/kyc',
    icon: <ShieldCheck className="h-4 w-4" />,
    permissions: [PERMISSIONS.KYC_VIEW_ALL, PERMISSIONS.KYC_REVIEW],
  },
  {
    labelKey: 'nav.audit',
    href: '/audit',
    icon: <History className="h-4 w-4" />,
    permissions: [PERMISSIONS.AUDIT_VIEW],
  },
  {
    labelKey: 'nav.municipalitySettings',
    href: '/municipality-settings',
    icon: <Settings className="h-4 w-4" />,
    permissions: [PERMISSIONS.MUNICIPALITY_UPDATE],
  },
];

const platformNavItems: NavItem[] = [
  {
    labelKey: 'nav.platformOverview',
    href: '/platform',
    icon: <Activity className="h-4 w-4" />,
  },
  {
    labelKey: 'nav.municipalities',
    href: '/platform/municipalities',
    icon: <Globe className="h-4 w-4" />,
  },
  {
    labelKey: 'nav.boundaryAssignment',
    href: '/platform/boundaries',
    icon: <Map className="h-4 w-4" />,
  },
  {
    labelKey: 'nav.allUsers',
    href: '/platform/users',
    icon: <UserCog className="h-4 w-4" />,
  },
  {
    labelKey: 'nav.platformAudit',
    href: '/platform/audit',
    icon: <ScrollText className="h-4 w-4" />,
  },
  {
    labelKey: 'nav.maintenance',
    href: '/platform/maintenance',
    icon: <Wrench className="h-4 w-4" />,
  },
  {
    labelKey: 'nav.platformBranding',
    href: '/platform/branding',
    icon: <Paintbrush className="h-4 w-4" />,
  },
  {
    labelKey: 'nav.platformAnnouncements',
    href: '/platform/announcements',
    icon: <Megaphone className="h-4 w-4" />,
  },
  {
    labelKey: 'nav.platformBroadcasts',
    href: '/platform/broadcasts',
    icon: <Bell className="h-4 w-4" />,
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavLink({
  item,
  isActive,
  collapsed,
  activeClass,
  inactiveClass,
  label,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  activeClass: string;
  inactiveClass: string;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'flex min-h-[44px] items-center gap-2.5 rounded px-2.5 py-2.5 text-sm font-medium transition-colors',
          isActive ? activeClass : inactiveClass,
          collapsed && 'justify-center px-2',
        )}
        title={collapsed ? label : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}

export function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useTranslate();
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const isSuperAdmin = !!user?.isSuperAdmin;

  // Fetch municipality branding for non-superadmin users
  const { data: muniData } = useQuery({
    queryKey: ['municipality', 'current'],
    queryFn: () => municipalitiesApi.getCurrent(),
    enabled: !!user?.municipalityId && !isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });
  const muniName = (muniData as any)?.nameAr && locale === 'ar'
    ? (muniData as any).nameAr
    : (muniData as any)?.nameFr && locale === 'fr'
    ? (muniData as any).nameFr
    : muniData?.name;
  const muniLogoSrc = resolveMunicipalityMediaUrl(muniData?.logoUrl);

  const filterByPerms = (items: NavItem[]) =>
    items.filter((item) => {
      if (!item.permissions?.length) return true;
      return item.permissions.some((p) => user?.permissions?.includes(p));
    });

  const filteredPersonalItems = filterByPerms(personalNavItems);
  const filteredAdminItems = filterByPerms(adminNavItems);

  const isItemActive = (item: NavItem) =>
    item.href === '/dashboard' || item.href === '/platform'
      ? pathname === item.href
      : pathname.startsWith(item.href);

  // Collapse icon: in RTL, flip direction
  const CollapseIcon = collapsed
    ? (isRtl ? ChevronsLeft : ChevronsRight)
    : (isRtl ? ChevronsRight : ChevronsLeft);

  const closeMobile = () => onMobileClose?.();

  return (
    <aside
      className={cn(
        'fixed start-0 top-0 z-40 flex h-screen flex-col border-e border-gray-700 bg-navy-900 transition-transform duration-300 sidebar-transition',
        'w-[min(85vw,20rem)] lg:z-30',
        collapsed ? 'lg:w-14' : 'lg:w-60',
        mobileOpen ? 'flex max-lg:translate-x-0' : 'hidden max-lg:-translate-x-full max-lg:rtl:translate-x-full lg:flex lg:translate-x-0',
      )}
      aria-hidden={!mobileOpen ? undefined : false}
    >
      {/* ── Logo / Brand ─────────────────────────────────────────── */}
      {isSuperAdmin ? (
        <div className="relative flex h-14 shrink-0 items-center border-b border-navy-700 bg-navy-900 px-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-amber-600">
            <Globe className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="ms-2.5 min-w-0">
              <p className="truncate text-sm font-bold text-white leading-tight">
                {t('common.appName')}
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-amber-400 leading-tight">
                Platform
              </p>
            </div>
          )}
        </div>
      ) : collapsed ? (
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-navy-700 bg-navy-900">
          {muniLogoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={muniLogoSrc}
              alt=""
              className="h-8 w-8 rounded object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <Building2 className="h-5 w-5 text-white/80" />
          )}
        </div>
      ) : (
        <MunicipalityBrandHeader
          className="shrink-0 border-b border-navy-700"
          name={muniName || t('common.appName')}
          subtitle={t('common.tagline')}
          logoUrl={muniData?.logoUrl}
          bannerImageUrl={(muniData as { bannerImageUrl?: string | null })?.bannerImageUrl}
          bannerOverlayColor={
            (muniData as { bannerOverlayColor?: string | null })?.bannerOverlayColor
          }
          bannerOverlayOpacity={
            (muniData as { bannerOverlayOpacity?: number | null })?.bannerOverlayOpacity
          }
          primaryColor={(muniData as { primaryColor?: string | null })?.primaryColor}
          variant="sidebar"
        />
      )}

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2">
        {isSuperAdmin ? (
          /* Super-admin platform nav */
          <ul className="space-y-0.5">
            {platformNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                label={t(item.labelKey)}
                isActive={isItemActive(item)}
                collapsed={collapsed}
                onNavigate={closeMobile}
                activeClass="bg-amber-600/20 text-amber-300"
                inactiveClass="text-navy-300 hover:bg-navy-800 hover:text-white"
              />
            ))}
          </ul>
        ) : (
          /* Tenant user nav (two sections) */
          <div className="space-y-3">
            {/* Personal */}
            <div>
              {!collapsed && (
                <p className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-widest text-navy-400">
                  {t('nav.personalSection')}
                </p>
              )}
              <ul className="space-y-0.5">
                {filteredPersonalItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    label={t(item.labelKey)}
                    isActive={isItemActive(item)}
                    collapsed={collapsed}
                    onNavigate={closeMobile}
                    activeClass="bg-brand-700/40 text-white"
                    inactiveClass="text-navy-300 hover:bg-navy-800 hover:text-white"
                  />
                ))}
              </ul>
            </div>

            {/* Administration */}
            {filteredAdminItems.length > 0 && (
              <div>
                {!collapsed ? (
                  <p className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-widest text-navy-400">
                    {t('nav.administrationSection')}
                  </p>
                ) : (
                  <div className="mx-2 my-2 border-t border-navy-700" />
                )}
                <ul className="space-y-0.5">
                  {filteredAdminItems.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      label={t(item.labelKey)}
                      isActive={isItemActive(item)}
                      collapsed={collapsed}
                      onNavigate={closeMobile}
                      activeClass="bg-brand-700/40 text-white"
                      inactiveClass="text-navy-300 hover:bg-navy-800 hover:text-white"
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ── Collapse Toggle ───────────────────────────────────────── */}
      <div className="hidden shrink-0 border-t border-navy-700 p-2 lg:block">
        <button
          onClick={onToggle}
          className="flex w-full min-h-[44px] items-center justify-center rounded p-2 text-navy-400 hover:bg-navy-800 hover:text-white transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <CollapseIcon className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
