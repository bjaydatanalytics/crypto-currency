/**
 * Support tickets.
 *
 * No mock fallback. A fabricated reply on a support thread would be a sentence
 * the customer believes came from a person, and a fabricated ticket would be a
 * problem an operator believes they have answered.
 */

import { request } from './client'

export type TicketCategory =
  | 'account'
  | 'verification'
  | 'deposit'
  | 'withdrawal'
  | 'investment'
  | 'other'

export type TicketStatus = 'awaiting_support' | 'awaiting_customer' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high'

export interface TicketMessage {
  id: string
  authorRole: 'user' | 'admin'
  authorName: string | null
  body: string
  /** Operator-only note. Never present in a customer-facing response. */
  internal: boolean
  createdAt: string
}

export interface Ticket {
  id: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  priority: TicketPriority
  createdAt: string
  lastMessageAt: string
  resolvedAt: string | null
  closedAt: string | null
  messageCount: number
}

export interface AdminTicket extends Ticket {
  userId: string
  userName: string
  userEmail: string
  assignedTo: string | null
  assignedToName: string | null
  needsReply: boolean
}

/* ---- customer ---------------------------------------------------- */

export async function listMyTickets(): Promise<{ tickets: Ticket[] }> {
  return request('/support/tickets')
}

export async function fetchMyTicket(
  id: string,
): Promise<{ ticket: Ticket; messages: TicketMessage[] }> {
  return request(`/support/tickets/${id}`)
}

export async function openTicket(input: {
  subject: string
  category: TicketCategory
  body: string
}): Promise<{ ticket: Ticket; messages: TicketMessage[]; message: string }> {
  return request('/support/tickets', { method: 'POST', body: input })
}

export async function replyToTicket(
  id: string,
  body: string,
): Promise<{ message: TicketMessage }> {
  return request(`/support/tickets/${id}`, { method: 'POST', body: { body } })
}

/* ---- operator ---------------------------------------------------- */

export async function listSupportQueue(filter?: {
  status?: TicketStatus
  unassigned?: boolean
}): Promise<{ tickets: AdminTicket[]; awaitingSupport: number }> {
  return request('/admin/support', { query: filter })
}

export async function fetchSupportTicket(
  id: string,
): Promise<{ ticket: AdminTicket; messages: TicketMessage[] }> {
  return request(`/admin/support/${id}`)
}

export async function replyAsSupport(
  id: string,
  body: string,
  internal = false,
): Promise<{ message: TicketMessage; ticket: AdminTicket; note: string }> {
  return request(`/admin/support/${id}`, {
    method: 'POST',
    body: { action: 'reply', body, internal },
  })
}

export async function setTicketStatus(
  id: string,
  status: TicketStatus,
): Promise<{ ticket: AdminTicket; note: string }> {
  return request(`/admin/support/${id}`, { method: 'POST', body: { action: 'status', status } })
}

export async function setTicketPriority(
  id: string,
  priority: TicketPriority,
): Promise<{ ticket: AdminTicket; note: string }> {
  return request(`/admin/support/${id}`, {
    method: 'POST',
    body: { action: 'priority', priority },
  })
}

export async function assignTicket(
  id: string,
  assignedTo: string | null,
): Promise<{ ticket: AdminTicket; note: string }> {
  return request(`/admin/support/${id}`, {
    method: 'POST',
    body: { action: 'assign', assignedTo },
  })
}
