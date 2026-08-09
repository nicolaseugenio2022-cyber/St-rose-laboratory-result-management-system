const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

const supabase = createClient(url, key);

(async () => {
  try {
    const start = Date.now();
    const res = await supabase.from('patient_report_sessions').select('id', { head: true, count: 'exact' }).limit(1);
    const elapsed = Date.now() - start;
    console.log('ok', { elapsed, error: res.error || null, count: res.count ?? null });
  } catch (err) {
    console.error('caught', (err && err.message) ? { message: err.message } : err);
    process.exitCode = 2;
  }
})();
