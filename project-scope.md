## Problem

We receive hundreds of support emails daily. Our agents manually read, classify, and respond to each ticket — which is slow and leads to impersonal, canned responses.

## Solution

Build a ticket management system that uses AI to automatically classify, respond to, and route support tickets — delivering faster, more personalized responses to students while freeing up agents for complex issues.

## Features

- Receive support emails and create tickets
- Auto-generate human-friendly responses using a knowledge base
- Ticket list with filtering and sorting
- Ticket detail view
- AI-powered ticket classification 
- AI summaries
- AI-suggested replies
- User management (admin only)
- Dashboard to view and manage all tickets

## Ticket Lifecycle

Statuses: `open` → `resolved` → `closed`

## Ticket Categories

Each ticket belongs to exactly one category: `general question`, `technical question`, `refund request`

## Roles

- System is deployed with a single seeded admin account.
- Admin can create additional agent accounts.
- Agents handle day-to-day ticket resolution; admin additionally manages users.

## Open Questions

- Auto-reply mode: should AI auto-send replies for high-confidence/known tickets, or should every reply go through agent approval first? (leaning human-in-the-loop for v1)
- Knowledge base: is it admin-authored FAQ/articles, mined from past resolved tickets, or both?
- Refund requests: should AI attempt to draft/resolve these, or should they always route straight to an agent given the business-logic/approval implications?
- Ticket submitter identity: since auth is out of scope for v1, are tickets submitted anonymously (name/email typed in) or is there still some lightweight student identification?
- Routing: Solution mentions routing tickets, but routing isn't reflected in Features — route to whom, based on what (category, load, skill)?
- Multi-language support: earlier draft mentioned replying in the user's local language — still in scope or cut?
- AI feedback loop: how do agents correct a wrong classification/reply, and does that improve future AI behavior?
- Success metrics: how will "faster, more personalized" be measured (e.g. avg response time, % auto-resolved)?
- Volume/performance expectations: "hundreds of emails daily" — any latency/throughput requirements for AI processing?

See [tech-stack.md](tech-stack.md) for chosen tech stack and [implementation-plan.md](implementation-plan.md) for phased task breakdown.