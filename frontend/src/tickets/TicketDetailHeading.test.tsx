import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeTicket } from '@/test/ticketFixtures'
import { TicketDetailHeading } from './TicketDetailHeading'

// The <dd> next to a <dt> label.
const field = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling

describe('TicketDetailHeading', () => {
  it('shows the id, subject, submitter, source and dates', () => {
    const ticket = makeTicket()

    render(<TicketDetailHeading ticket={ticket} />)

    expect(screen.getByText('#42')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Refund for duplicate charge', level: 1 }),
    ).toBeInTheDocument()
    expect(field('Submitter')).toHaveTextContent('Jane Student <jane@example.com>')
    expect(field('Source')).toHaveTextContent('email')
    expect(field('Received')).toHaveTextContent(new Date(ticket.createdAt).toLocaleString())
    expect(field('Received')?.querySelector('time')).toHaveAttribute('dateTime', ticket.createdAt)
    expect(field('Updated')).toHaveTextContent(new Date(ticket.updatedAt).toLocaleString())
    expect(field('Updated')?.querySelector('time')).toHaveAttribute('dateTime', ticket.updatedAt)
  })

  it('shows just the email when the submitter has no name', () => {
    render(<TicketDetailHeading ticket={makeTicket({ submitterName: null })} />)

    expect(field('Submitter')).toHaveTextContent(/^jane@example\.com$/)
  })
})
