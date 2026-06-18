// ═══════════════════════════════════════════════════════════════
//  ShopChampion — Central Config
//  Edit this file to set your credentials before deploying.
// ═══════════════════════════════════════════════════════════════

// ── Firebase ──────────────────────────────────────────────────
const SC_FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAdNjL9gCptnAbJ6ZVm9BZ61rKfBtwc1Qc",
  authDomain:        "shop-champion.firebaseapp.com",
  projectId:         "shop-champion",
  storageBucket:     "shop-champion.firebasestorage.app",
  messagingSenderId: "81324128909",
  appId:             "1:81324128909:web:cc023f5c031c505bfe00c4",
  measurementId:     "G-YCX9WJ4DP5"
};

// ── Supabase ──────────────────────────────────────────────────
// ⚠️  IMPORTANT: Use the LEGACY JWT key (eyJ...), NOT the new Publishable key (sb_publishable_...)
// Where to find it:
//   Supabase Dashboard → Project Settings → API
//   → Click "Legacy anon, service_role API keys" tab
//   → Copy the "anon" key that starts with eyJ...
//
// The new "Publishable" key (sb_publishable_...) does NOT work with direct REST API calls.

const SC_SUPABASE_URL  = "https://dgmzfqwglnafghpfnqau.supabase.co";
const SC_SUPABASE_ANON = "PASTE_YOUR_LEGACY_JWT_ANON_KEY_HERE"; // ← eyJ... from Legacy tab

// ═══════════════════════════════════════════════════════════════
//  ⚠️  SECURITY RULES — READ BEFORE GOING LIVE
// ═══════════════════════════════════════════════════════════════
