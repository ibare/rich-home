import {
  IconLayoutDashboard,
  IconReceipt,
  IconCalendarCheck,
  IconWallet,
  IconBuildingBank,
  IconCreditCard,
  IconCategory,
  IconPigMoney,
  IconChartBar,
  IconSettings,
} from '@tabler/icons-react'

export interface MenuItem {
  id: string
  title?: string
  icon?: React.ComponentType<{ stroke?: number; size?: string }>
  href?: string
  navlabel?: boolean
  subheader?: string
}

const MenuItems: MenuItem[] = [
  {
    navlabel: true,
    subheader: 'Home',
    id: 'home-header',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: IconLayoutDashboard,
    href: '/',
  },
  {
    navlabel: true,
    subheader: 'Manage',
    id: 'manage-header',
  },
  {
    id: 'transactions',
    title: 'Transactions',
    icon: IconReceipt,
    href: '/transactions',
  },
  {
    id: 'monthly-closing',
    title: 'Monthly Closing',
    icon: IconCalendarCheck,
    href: '/monthly-closing',
  },
  {
    id: 'accounts',
    title: 'Accounts',
    icon: IconWallet,
    href: '/accounts',
  },
  {
    id: 'assets',
    title: 'Assets',
    icon: IconBuildingBank,
    href: '/assets',
  },
  {
    id: 'liabilities',
    title: 'Liabilities',
    icon: IconCreditCard,
    href: '/liabilities',
  },
  {
    id: 'categories',
    title: 'Categories',
    icon: IconCategory,
    href: '/categories',
  },
  {
    id: 'budget',
    title: 'Budget',
    icon: IconPigMoney,
    href: '/budget',
  },
  {
    navlabel: true,
    subheader: 'Analysis',
    id: 'analysis-header',
  },
  {
    id: 'statistics',
    title: 'Statistics',
    icon: IconChartBar,
    href: '/statistics',
  },
  {
    navlabel: true,
    subheader: 'Settings',
    id: 'settings-header',
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: IconSettings,
    href: '/settings',
  },
]

export default MenuItems
