import { useAuth } from '@/auth/authContext'
import { DashboardStats } from '@/dashboard/DashboardStats'
import { TicketsPerDayChart } from '@/dashboard/TicketsPerDayChart'

export function HomePage() {
  const { user } = useAuth()

  return (
    <>
      <h1 className="mb-4">Welcome, {user?.displayName}</h1>
      <DashboardStats />
      <div className="mt-4">
        <TicketsPerDayChart />
      </div>
    </>
  )
}
