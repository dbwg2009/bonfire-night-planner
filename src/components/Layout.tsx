import { Outlet } from 'react-router-dom'
import { FireBackground } from './FireBackground'
import { BottomNav } from './BottomNav'
import { Toaster } from './ui/toast'

interface LayoutProps {
  showNav?: boolean
}

export function Layout({ showNav = true }: LayoutProps) {
  return (
    <div className="relative min-h-dvh min-h-screen flex flex-col">
      <FireBackground />
      <div className="relative z-10 flex flex-col flex-1 pb-[80px]">
        <Outlet />
      </div>
      {showNav && <BottomNav />}
      <Toaster />
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-3">
      <div>
        <h1 className="text-xl font-bold text-smoke-100">{title}</h1>
        {subtitle && <p className="text-sm text-smoke-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const cn = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ')
  return (
    <div className={cn('px-4 pb-6 space-y-3 flex-1', className)}>
      {children}
    </div>
  )
}
