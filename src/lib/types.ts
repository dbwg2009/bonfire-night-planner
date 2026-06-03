export interface Event {
  id: string
  year: number
  name: string
  date: string
  status: 'planning' | 'active' | 'archived'
  meeting_location: string
  meeting_location_coords?: string
  event_location: string
  event_location_coords?: string
  conflict_event_enabled: boolean
  conflict_event_name?: string
  food_split_ratio: number // 0.0-1.0, default 0.6 for "both" guests
  food_buffer_factor: number // default 1.1 (10% buffer)
  // Light level overrides — if set, these override the SunCalc auto-calculated times
  light_walk_by?: string      // "Start walk by this time" — shown as key warning on weather widget
  light_fireworks_after?: string  // "Fireworks after this time"
  light_notes?: string        // Any extra light/timing notes for the organiser
  lat?: number                // Event location lat for weather + light calculations
  lon?: number                // Event location lon
  contribution_link?: string  // Payment URL (monzo.me, etc.) shown to guests
  contribution_match_ratio: number // 0 = no match, 0.5 = match 50%, etc.
  created_at: string
  updated_at: string
}

export interface Organiser {
  id: string
  name: string
  color: string
  is_owner: boolean
  permissions: OrgPermissions
  event_id: string
  created_at: string
}

export interface OrgPermissions {
  guest_management: boolean
  finance: boolean
  check_in: boolean
  tasks_and_settings: boolean
}

export interface Guest {
  id: string
  name: string
  rsvp_status: 'pending' | 'accepted' | 'declined'
  dietary: ('burger' | 'sausage')[]
  dietary_restrictions: string[]   // allergens / things they can't eat
  dietary_notes?: string           // freeform e.g. "severe nut allergy — epipen"
  pickup_time?: string
  emergency_contact?: string
  on_whatsapp: boolean
  notes?: string
  conflict_event: boolean
  event_id: string
  created_at: string
  updated_at: string
}

export interface CheckIn {
  id: string
  guest_id: string
  location: 'meeting' | 'destination'
  checked_in: boolean
  checked_in_at?: string
  event_id: string
}

export interface Task {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  owner?: string
  stage: 'pre_event' | 'day_of' | 'post_event'
  due_date?: string
  notes?: string
  event_id: string
  created_at: string
  updated_at: string
}

export interface ScheduleItem {
  id: string
  title: string
  activity_type?: string
  start_time?: string
  end_time?: string
  location?: string
  owner?: string
  notes?: string
  sort_order: number
  event_id: string
}

export interface Transaction {
  id: string
  description: string
  category: 'contribution' | 'venue' | 'food' | 'equipment' | 'other'
  budget_amount?: number
  actual_amount?: number
  transaction_date?: string
  paid_by?: string
  notes?: string
  transaction_type: 'expense' | 'contribution'
  event_id: string
  created_at: string
}

export interface Location {
  id: string
  name: string
  address?: string
  map_url?: string
  status: 'considering' | 'rejected' | 'chosen'
  pros: string[]
  cons: string[]
  capacity?: number
  parking?: 'none' | 'limited' | 'ample'
  accessibility?: string
  walk_time_from_meeting?: number
  fire_permission: boolean
  fireworks_permission: boolean
  notes?: string
  event_id: string
  created_at: string
}

export interface ConflictScheduleItem {
  id: string
  title: string
  start_time?: string
  end_time?: string
  location?: string
  transport?: string
  notes?: string
  sort_order: number
  event_id: string
}

export interface FoodCalculation {
  burger_only_count: number
  sausage_only_count: number
  both_count: number
  neither_count: number
  recommended_burgers: number
  recommended_sausages: number
  buy_burgers: number
  buy_sausages: number
  buy_burger_buns: number
  buy_hot_dog_buns: number
  total_bread_products: number
  split_ratio: number
  buffer_factor: number
}

export interface WeatherForecast {
  date: string
  temp_max: number
  temp_min: number
  temp_avg: number
  precipitation_probability: number
  wind_speed: number
  weather_code: number
  weather_description: string
  source: string
  confidence: number
}

export interface CombinedWeather {
  date: string
  temp_max: number
  temp_min: number
  temp_avg: number
  precipitation_probability: number
  wind_speed: number
  weather_description: string
  confidence: number
  sources: string[]
}

export interface SunData {
  sunrise: Date
  sunset: Date
  goldenHourStart: Date
  goldenHourEnd: Date
  civilTwilightEnd: Date
  nauticalTwilightEnd: Date
  dusk: Date
}

export interface AuthState {
  organiser: Organiser | null
  token: string | null
}

export interface Milestone {
  id: string
  event_id: string
  name: string
  description: string
  amount: number        // cumulative target in pence
  emoji: string
  icon_preset: string
  icon_image: string    // base64
  important: boolean
  created_at: string
  updated_at: string
}

export interface MilestonesResponse {
  milestones: Milestone[]
  total_raised: number  // in pence
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}
