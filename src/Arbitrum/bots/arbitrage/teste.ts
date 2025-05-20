import { createClient } from '@supabase/supabase-js';

const client = createClient('https://xyz', 'public-anon-key');
console.log(client);
