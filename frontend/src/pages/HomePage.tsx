import { useAuth } from '@/auth/authContext'
import { DashboardStats } from '@/dashboard/DashboardStats'
import { greeting } from '@/dashboard/greeting'
import { TicketsPerDayChart } from '@/dashboard/TicketsPerDayChart'

export function HomePage() {
  const { user } = useAuth()

  return (
    <>
      <h1 className="mb-1">
        {greeting(new Date().getHours())}, {user?.displayName}
      </h1>
      <DashboardStats />
      <div className="mt-8">
        <TicketsPerDayChart />
      </div>
    </>
  )
}
