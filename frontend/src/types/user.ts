import type { Role } from './auth'

export type UserListItem = {
  id: number
  email: string
  displayName: string
  role: Role
  isActive: boolean
  createdAt: string
}

// A user a ticket can be (or still is) assigned to, from GET /api/users/assignees.
export type AssigneeOption = {
  id: number
  displayName: string
  isActive: boolean
}
