import {
  LayoutDashboard,
  Building2,
  FileText,
  Layers,
  Users,
  CreditCard,
  BarChart2,
  Mail,
  Settings,
  ClipboardList,
} from 'lucide-react'

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, exact: true },
  { label: 'Mall Management', path: '/mall-management', icon: Building2 },
  { label: 'Application Management', path: '/application-management', icon: FileText },
  { label: 'AR Development', path: '/ar-development', icon: Layers },
  { label: 'Account Management', path: '/account-management', icon: Users },
  { label: 'License Management', path: '/license-management', icon: CreditCard },
  { label: 'Analytics', path: '/analytics', icon: BarChart2 },
  { label: 'Email Logs', path: '/email-logs', icon: Mail },
  { label: 'System Settings', path: '/system-settings', icon: Settings },
  { label: 'Audit Logs', path: '/audit-logs', icon: ClipboardList },
]

export function getActiveNavItem(pathname) {
  return NAV_ITEMS.find(item => item.path === pathname) || NAV_ITEMS[0]
}