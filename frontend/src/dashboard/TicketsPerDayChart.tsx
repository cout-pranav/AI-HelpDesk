import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { api, errorMessage } from '@/lib/api'
import type { TicketsPerDay } from '@/types/ticket'

const chartConfig = {
  count: { label: 'Tickets', color: 'var(--primary)' },
} satisfies ChartConfig

const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

// "2026-10-28" as a local date; new Date(string) would read it as UTC midnight and could show the day before.
function parseDay(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

const chartHeight = 'h-64'

// Tickets created per day over the last 30 days. The API buckets days in the browser's time zone,
// so the bars line up with the dates the viewer sees elsewhere.
export function TicketsPerDayChart() {
  const utcOffsetMinutes = -new Date().getTimezoneOffset()
  const perDay = useQuery({
    queryKey: ['tickets', 'stats', 'per-day', { utcOffsetMinutes }],
    queryFn: () =>
      api
        .get<TicketsPerDay[]>('/api/dashboard/tickets-per-day', { params: { utcOffsetMinutes } })
        .then((r) => r.data),
  })

  const total = perDay.data?.reduce((sum, day) => sum + day.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets per day</CardTitle>
        <CardDescription>
          Last 30 days{total !== undefined && ` · ${total.toLocaleString()} tickets`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {perDay.isPending ? (
          <Skeleton aria-busy="true" aria-label="Loading tickets per day" className={chartHeight} />
        ) : perDay.isError ? (
          <ErrorAlert>{errorMessage(perDay.error, 'Could not load tickets per day.')}</ErrorAlert>
        ) : total === 0 ? (
          <p className="text-muted-foreground">No tickets in the last 30 days.</p>
        ) : (
          <>
            <ChartContainer config={chartConfig} className={`${chartHeight} aspect-auto w-full`} aria-hidden="true">
              <BarChart data={perDay.data} margin={{ left: -16, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(day: string) => shortDate.format(parseDay(day))}
                />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={48} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => longDate.format(parseDay(payload[0].payload.date))}
                    />
                  }
                />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
            {/* The chart is hidden from screen readers; this table carries the same numbers. */}
            <table className="sr-only">
              <caption>Tickets per day, last 30 days</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Tickets</th>
                </tr>
              </thead>
              <tbody>
                {perDay.data.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{longDate.format(parseDay(day.date))}</th>
                    <td>{day.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
