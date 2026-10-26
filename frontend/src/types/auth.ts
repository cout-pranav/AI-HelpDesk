export type Role = 'Admin' | 'Agent'

export type AuthUser = {
  id: number
  email: string
  displayName: string
  role: Role
}

export type LoginResponse = {
  token: string
  expiresAt: string
  user: AuthUser
}

export type LoginCredentials = {
  email: string
  password: string
}
