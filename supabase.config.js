/* ============================================================
   Supabase config — static (CDN) build
   ------------------------------------------------------------
   Is file ko khulke public rakha ja sakta hai kyunki isme sirf
   ANON key hoti hai (client-side use ke liye banti hai).

   KAISE FILL KAREIN:
   1. Supabase dashboard > Project Settings > API se
      "Project URL" aur "anon public key" copy karein.
   2. Niche dono strings mein real values daal dein.
   3. SERVICE_ROLE key Kabhi bhi yahan mat daalo.

   .env.example mein bhi ye hi values list kiya gaya hai
   (deployment ke liye reference).
   ============================================================ */
var SUPABASE_URL = 'https://jdttpafqxeusfuswgduk.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdHRwYWZxeGV1c2Z1c3dnZHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMTQzNTIsImV4cCI6MjEwNTg5MDM1Mn0.PBAXa7xZO62u8TxvEm9HWghr9Xhi50E5Bc_R5lCHMgA';