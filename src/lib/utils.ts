import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInDays, differenceInHours } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBonfireDate(year: number): Date {
  return new Date(year, 10, 5) // November 5th (month is 0-indexed)
}

export function getCountdownData(targetDate: Date) {
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()
  if (diff <= 0) return { past: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return { past: false, days, hours, minutes, seconds }
}

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy') {
  return format(new Date(date), fmt)
}

export function formatTime(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'pm' : 'am'
  const h12 = hour % 12 || 12
  return `${h12}:${m}${ampm}`
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function daysUntil(date: string | Date): number {
  return differenceInDays(new Date(date), new Date())
}

export function hoursUntil(date: string | Date): number {
  return differenceInHours(new Date(date), new Date())
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function hashPin(pin: string): string {
  // Simple hash for client-side — real hashing done server-side with bcrypt
  return btoa(pin + 'bonfire-salt-2025')
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
}

export function formatWhatsApp(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/__(.*?)__/g, '_$1_')
}

export type RsvpStatus = 'in_consideration' | 'invited' | 'accepted' | 'declined'
export type DietaryOption = 'burger' | 'sausage'
export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type TaskStage = 'pre_event' | 'day_of' | 'post_event'
export type LocationStatus = 'considering' | 'rejected' | 'chosen'
export type TransactionType = 'expense' | 'contribution'
export type TransactionCategory = 'contribution' | 'venue' | 'food' | 'equipment' | 'other'

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  in_consideration: 'Considering',
  invited: 'Invited',
  accepted: 'Accepted',
  declined: 'Declined'
}

export const RSVP_COLORS: Record<RsvpStatus, string> = {
  in_consideration: 'text-smoke-400 bg-smoke-600/20 border-smoke-600/30',
  invited: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  accepted: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  declined: 'text-red-400 bg-red-400/10 border-red-400/20'
}

export const TASK_STAGE_LABELS: Record<TaskStage, string> = {
  pre_event: 'Pre-event',
  day_of: 'Day of',
  post_event: 'Post-event'
}

export const LOCATION_STATUS_LABELS: Record<LocationStatus, string> = {
  considering: 'Considering',
  rejected: 'Rejected',
  chosen: 'Chosen'
}

export const LOCATION_STATUS_COLORS: Record<LocationStatus, string> = {
  considering: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
  chosen: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
}
