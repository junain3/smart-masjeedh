'use client';

import React from 'react';
import Link from 'next/link';
import { Users, CreditCard, Briefcase, Settings, Calendar, Home as HomeIcon } from 'lucide-react';
import { parsePermissions, hasModulePermission, ModulePermissions } from '@/lib/permissions-utils';
import { translations, getTranslation, Language } from "@/lib/i18n/translations";

interface PermissionBasedNavigationProps {
  permissions: string | null;
  lang: Language;
  onClose?: () => void;
  currentPage?: string;
}

export default function PermissionBasedNavigation({ 
  permissions, 
  lang, 
  onClose, 
  currentPage 
}: PermissionBasedNavigationProps) {
  const t = getTranslation(lang);
  const parsedPermissions = parsePermissions(permissions);

  const navItems = [
    {
      key: 'dashboard',
      href: '/',
      icon: HomeIcon,
      label: t.dashboard,
      alwaysShow: true
    },
    {
      key: 'families',
      href: '/families',
      icon: Users,
      label: t.families,
      permission: 'families'
    },
    {
      key: 'accounts',
      href: '/accounts',
      icon: CreditCard,
      label: t.accounts,
      permission: 'accounts'
    },
    {
      key: 'staff',
      href: '/staff',
      icon: Briefcase,
      label: t.staff_management || "Staff Management",
      alwaysShow: true
    },
    {
      key: 'settings',
      href: '/settings',
      icon: Settings,
      label: t.settings,
      permission: 'settings'
    },
    {
      key: 'events',
      href: '/events',
      icon: Calendar,
      label: t.events || "Events",
      permission: 'events'
    }
  ];

  return (
    <nav className="flex-1 p-4 space-y-2">
      {navItems.map((item) => {
        // Always show dashboard and staff page
        if (item.alwaysShow) {
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-4 p-4 rounded-3xl font-bold transition-all ${
                currentPage === item.href
                  ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200'
                  : 'hover:bg-neutral-50 text-neutral-600'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        }

        // Check permission for other modules
        if (item.permission && hasModulePermission(parsedPermissions, item.permission)) {
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-4 p-4 rounded-3xl font-bold transition-all ${
                currentPage === item.href
                  ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200'
                  : 'hover:bg-neutral-50 text-neutral-600'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        }

        return null;
      })}
    </nav>
  );
}
