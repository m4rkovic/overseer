import {createClient} from '@supabase/supabase-js';
export const db=createClient(import.meta.env.VITE_SUPABASE_URL || 'https://ihbauxyledvtdnzyulzz.supabase.co',import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_xl2ijj6AS6w0QNQs0p7WmA_x6v0Crb2');
