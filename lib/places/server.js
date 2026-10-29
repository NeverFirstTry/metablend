// The app's one instance of our places data (server only: the service key).
import { supabase } from '../supabase.js'
import { makePlaces } from './db.js'

export const places = makePlaces(supabase)
