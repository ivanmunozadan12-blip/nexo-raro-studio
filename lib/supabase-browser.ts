'use client';
import { createClient } from '@supabase/supabase-js';
let client:any;
export function supabase(){if(!client){client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}return client;}
