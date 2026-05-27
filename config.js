// ═══════════════════════════════════════════════════════════════
//  ShopChampion — Central Config
//  Edit this file to set your credentials before deploying.
// ═══════════════════════════════════════════════════════════════

// ── Firebase ──────────────────────────────────────────────────
// Get these from Firebase Console → Project Settings → Your apps → Web
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
// Get these from Supabase Dashboard → Project Settings → API
// Use the ANON (public) key here — never the service_role key
const SC_SUPABASE_URL  = "https://dgmzfqwglnafghpfnqau.supabase.co";
const SC_SUPABASE_ANON = "sb_publishable_yxPk_18wrBIPebrJkYn9FQ_91lhKmjE";

// ═══════════════════════════════════════════════════════════════
//  ⚠️  SECURITY RULES — READ BEFORE GOING LIVE
//
//  These keys ARE visible in browser DevTools — that is normal for
//  frontend apps. The real protection is backend security rules.
//
//  FIREBASE FIRESTORE RULES (Firebase Console → Firestore → Rules):
//  ─────────────────────────────────────────────────────────────────
//  rules_version = '2';
//  service cloud.firestore {
//    match /databases/{database}/documents {
//      // Only allow reads — no direct writes from browser
//      match /sc_shops/{shopId}/{document=**} {
//        allow read: if true;
//        allow write: if false;  // writes go via Admin panel only
//      }
//    }
//  }
//
//  SUPABASE ROW LEVEL SECURITY (Supabase Dashboard → Table Editor → RLS):
//  ─────────────────────────────────────────────────────────────────
//  1. Enable RLS on the sc_users table
//  2. Add policy: "Users can only read their own row"
//     USING (phone = current_setting('request.jwt.claims', true)::json->>'phone')
//  3. Block all anon INSERTs except via your trusted flow
//
//  Until RLS is configured, your database is open to anyone
//  who finds these keys. Set up rules immediately after launch.
// ═══════════════════════════════════════════════════════════════
