import {
  IconLayoutDashboard,
  IconReceipt,
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
    subheader: '홈',
    id: 'home-header',
  },
  {
    id: 'dashboard',
    title: '대시보드',
    icon: IconLayoutDashboard,
    href: '/',
  },
  {
    navlabel: true,
    subheader: '관리',
    id: 'manage-header',
  },
  {
    id: 'transactions',
    title: '거래 내역',
    icon: IconReceipt,
    href: '/transactions',
  },
  {
    id: 'accounts',
    title: '계좌 관리',
    icon: IconWallet,
    href: '/accounts',
  },
  {
    id: 'assets',
    title: '자산 관리',
    icon: IconBuildingBank,
    href: '/assets',
  },
  {
    id: 'liabilities',
    title: '부채 관리',
    icon: IconCreditCard,
    href: '/liabilities',
  },
  {
    id: 'categories',
    title: '카테고리',
    icon: IconCategory,
    href: '/categories',
  },
  {
    id: 'budget',
    title: '예산',
    icon: IconPigMoney,
    href: '/budget',
  },
  {
    navlabel: true,
    subheader: '분석',
    id: 'analysis-header',
  },
  {
    id: 'statistics',
    title: '통계',
    icon: IconChartBar,
    href: '/statistics',
  },
  {
    navlabel: true,
    subheader: '설정',
    id: 'settings-header',
  },
  {
    id: 'settings',
    title: '설정',
    icon: IconSettings,
    href: '/settings',
  },
]

export default MenuItems
