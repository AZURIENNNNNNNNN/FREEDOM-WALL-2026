import React, { useState, useEffect } from "react";

// ============================================================
//  FILL THESE IN — all 4 are required
// ============================================================
const SUPABASE_URL = "https://wddvrrcelpbcicgvrvra.supabase.co/";        // from Supabase → Settings → API
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZHZycmNlbHBiY2ljZ3ZydnJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDk4MzgsImV4cCI6MjA5NTcyNTgzOH0.jyD4vf90l_nhP_UwWhfOab5283UPUkVF_OPPyumBGwY"; // same page
const ADMIN_EMAIL = "dawnedtilldasc@gmail.com";      // your personal email
const INVITE_CODE = "ARCHERS2026";                 // change this to your secret code!
// ============================================================

const sb = {
  h: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  ah: (t) => ({ "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${t}` }),
  async signUp(email, password, batch) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, { method: "POST", headers: this.h, body: JSON.stringify({ email, password, data: { batch } }) });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: this.h, body: JSON.stringify({ email, password }) });
    return r.json();
  },
  async signOut(t) { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: this.ah(t) }); },
  async getPosts(t, isAdmin) {
    const sel = isAdmin ? "*" : "id,content,batch,upvotes,downvotes,created_at,expires_at";
    const now = new Date().toISOString();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/posts?select=${sel}&expires_at=gt.${now}&order=created_at.desc`, { headers: this.ah(t) });
    return r.json();
  },
  async createPost(t, content, batch, userId, userEmail, expiresHours) {
    const expires = new Date(Date.now() + expiresHours * 3600000).toISOString();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/posts`, { method: "POST", headers: { ...this.ah(t), Prefer: "return=representation" }, body: JSON.stringify({ content, batch, user_id: userId, user_email: userEmail, expires_at: expires }) });
    return r.json();
  },
  async vote(t, postId, type) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=upvotes,downvotes`, { headers: this.ah(t) });
    const [post] = await r.json();
    const field = type === "up" ? "upvotes" : "downvotes";
    await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`, { method: "PATCH", headers: { ...this.ah(t), Prefer: "return=minimal" }, body: JSON.stringify({ [field]: (post[field] || 0) + 1 }) });
  },
  async deletePost(t, postId) { await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`, { method: "DELETE", headers: this.ah(t) }); },
};

function TimeLeft({ expiresAt }) {
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return <span className="pill red">expired</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const color = h < 6 ? "red" : h < 24 ? "amber" : "green";
  return <span className={`pill ${color}`}>{h}h {m}m left</span>;
}

// ── Watermark overlay shown on every card ──────────────────────
function Watermark({ viewerBatch }) {
  return (
    <div className="watermark" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className="wm-text">viewed by {viewerBatch}</span>
      ))}
    </div>
  );
}

function PostCard({ post, isAdmin, onVote, onDelete, viewerBatch }) {
  const score = (post.upvotes || 0) - (post.downvotes || 0);
  return (
    <div className="card">
      <div className="card-accent" />
      <Watermark viewerBatch={viewerBatch} />
      <div className="card-top">
        <span className="batch-badge">Batch '{post.batch || "??"}</span>
        <TimeLeft expiresAt={post.expires_at} />
        {isAdmin && <span className="admin-tag">👁 {post.user_email}</span>}
      </div>
      <p className="card-body">{post.content}</p>
      <div className="card-foot">
        <div className="votes">
          <button className="vbtn up" onClick={() => onVote(post.id, "up")}>▲</button>
          <span className="score" style={{ color: score > 0 ? "var(--gold)" : score < 0 ? "var(--red)" : "var(--muted)" }}>{score}</span>
          <button className="vbtn dn" onClick={() => onVote(post.id, "down")}>▼</button>
        </div>
        <span className="ts">{new Date(post.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        {isAdmin && <button className="del-btn" onClick={() => onDelete(post.id)}>🗑</button>}
      </div>
    </div>
  );
}

function AuthModal({ onAuth }) {
  const [step, setStep] = useState("code");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [batch, setBatch] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  function doShake() { setShake(true); setTimeout(() => setShake(false), 500); }

  function checkCode() {
    if (code.trim().toUpperCase() === INVITE_CODE.toUpperCase()) { setStep("login"); setErr(""); }
    else { setErr("Wrong code. Are you really an Archer? 🏹"); doShake(); }
  }

  async function handleAuth() {
    setErr("");
    if (pw.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      if (step === "signup") {
        if (!batch) { setErr("Enter your ID batch (e.g. ID126)!"); setLoading(false); return; }
        const res = await sb.signUp(email, pw, batch);
        if (res.error) { setErr(res.error.message); setLoading(false); return; }
        setErr("✉️ Check your email to confirm your account!");
      } else {
        const res = await sb.signIn(email, pw);
        if (res.error) { setErr(res.error.message); setLoading(false); return; }
        onAuth(res.access_token, res.user);
      }
    } catch { setErr("Something went wrong. Try again."); }
    setLoading(false);
  }

  return (
    <div className="overlay">
      <div className={`modal ${shake ? "shake" : ""}`}>
        <div className="modal-crest">
          <div className="crest-ring">
            <span className="crest-icon">⚔</span>
          </div>
        </div>
        {step === "code" ? (
          <>
            <h2 className="modal-title">Archer's Wall</h2>
            <p className="modal-sub">De La Salle University</p>
            <p className="modal-hint">Enter the invite code to enter</p>
            <input className="inp code-inp" placeholder="INVITE CODE" value={code}
              onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && checkCode()} autoFocus />
            {err && <p className="errmsg">{err}</p>}
            <button className="btn-primary" onClick={checkCode}>Enter the Wall →</button>
          </>
        ) : (
          <>
            <h2 className="modal-title">{step === "login" ? "Welcome Back, Archer" : "Join the Wall"}</h2>
            <p className="modal-sub">{step === "login" ? "Sign in to your account" : "Create your account"}</p>
            <input className="inp" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} type="email" />
            <input className="inp" placeholder="Password (min 6 chars)" value={pw} onChange={e => setPw(e.target.value)} type="password" onKeyDown={e => e.key === "Enter" && handleAuth()} />
            {step === "signup" && <input className="inp" placeholder="Your ID batch (e.g. ID126)" value={batch} onChange={e => setBatch(e.target.value)} />}
            {err && <p className="errmsg">{err}</p>}
            <button className="btn-primary" onClick={handleAuth} disabled={loading}>{loading ? "Loading…" : step === "login" ? "Sign In →" : "Create Account →"}</button>
            <button className="btn-ghost" onClick={() => { setStep(step === "login" ? "signup" : "login"); setErr(""); }}>{step === "login" ? "No account? Sign up" : "Have an account? Sign in"}</button>
            <button className="btn-ghost sm" onClick={() => setStep("code")}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [expires, setExpires] = useState(48);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("feed");
  const [sort, setSort] = useState("new");

  const isAdmin = session?.user?.email === ADMIN_EMAIL;
  const viewerBatch = session?.user?.user_metadata?.batch || "???";

  useEffect(() => { if (session) fetchPosts(); }, [session, tab]);

  async function fetchPosts() {
    const data = await sb.getPosts(session.token, isAdmin);
    if (Array.isArray(data)) setPosts(data);
  }

  const sorted = [...posts].sort((a, b) =>
    sort === "top"
      ? (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)
      : new Date(b.created_at) - new Date(a.created_at)
  );

  async function submit() {
    if (!content.trim()) return;
    setLoading(true);
    await sb.createPost(session.token, content.trim(), session.user.user_metadata?.batch || "??", session.user.id, session.user.email, expires);
    setContent("");
    await fetchPosts();
    setLoading(false);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@300;400;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --green:       #1a472a;
          --green-mid:   #2d6a4f;
          --green-light: #40916c;
          --green-pale:  #d8f3dc;
          --green-wash:  #f0faf4;
          --gold:        #c9a84c;
          --gold-light:  #f0d080;
          --gold-pale:   #fdf6e3;
          --white:       #ffffff;
          --off:         #f7f9f8;
          --text:        #0e2318;
          --text-mid:    #2d5a3d;
          --muted:       #6b8f74;
          --border:      #c8e6d4;
          --red:         #c0392b;
          --amber:       #d4880f;
          --shadow:      0 4px 24px rgba(26,71,42,0.12);
          --shadow-lg:   0 12px 48px rgba(26,71,42,0.20);
        }

        body {
          background: var(--off);
          font-family: 'Source Sans 3', sans-serif;
          color: var(--text);
          min-height: 100vh;
          background-image:
            radial-gradient(ellipse at 0% 0%, #d8f3dc60 0%, transparent 50%),
            radial-gradient(ellipse at 100% 100%, #fdf6e330 0%, transparent 50%);
        }

        body::before {
          content: '';
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 340px;
          background: linear-gradient(160deg, var(--green) 0%, var(--green-mid) 60%, var(--green-light) 100%);
          clip-path: polygon(0 0, 100% 0, 100% 68%, 0 100%);
          z-index: 0;
        }

        .app { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; padding: 0 1rem 5rem; }

        .site-header {
          padding: 2.5rem 0 2rem;
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 1rem; flex-wrap: wrap;
        }
        .header-left { display: flex; align-items: center; gap: 1.1rem; }
        .shield {
          width: 58px; height: 58px;
          background: var(--gold);
          clip-path: polygon(50% 0%, 100% 15%, 100% 65%, 50% 100%, 0% 65%, 0% 15%);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem;
          box-shadow: 0 4px 16px rgba(201,168,76,0.5);
          flex-shrink: 0;
        }
        .header-text h1 {
          font-family: 'Playfair Display', serif;
          font-size: 2.2rem; font-weight: 900;
          color: var(--white);
          letter-spacing: -0.02em;
          line-height: 1;
          text-shadow: 0 2px 12px rgba(0,0,0,0.25);
        }
        .header-text p { color: var(--gold-light); font-size: 0.82rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 0.2rem; }
        .header-right { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
        .user-chip { font-size: 0.75rem; color: var(--gold-light); background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 50px; padding: 0.28rem 0.75rem; }
        .btn-logout { background: rgba(255,255,255,0.1); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 50px; padding: 0.3rem 0.85rem; font-family: 'Source Sans 3', sans-serif; font-size: 0.78rem; font-weight: 600; color: var(--white); cursor: pointer; transition: all 0.15s; }
        .btn-logout:hover { background: rgba(201,168,76,0.25); border-color: var(--gold); }

        /* ─── Screenshot warning banner ─── */
        .warning-banner {
          background: #7a1a1a;
          border-radius: 12px;
          padding: 0.65rem 1.2rem;
          margin-bottom: 0.75rem;
          display: flex; align-items: center; gap: 0.75rem;
        }
        .warning-banner-text {
          font-size: 0.76rem; font-weight: 700;
          color: #fecaca;
          letter-spacing: 0.04em;
          line-height: 1.5;
        }

        .banner { background: var(--gold); border-radius: 12px; padding: 0.55rem 1.2rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; }
        .banner-text { font-size: 0.78rem; font-weight: 700; color: var(--green); text-transform: uppercase; letter-spacing: 0.1em; }

        .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
        .tab { flex: 1; padding: 0.6rem; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); font-family: 'Source Sans 3', sans-serif; font-weight: 700; font-size: 0.83rem; color: var(--muted); cursor: pointer; transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.06em; }
        .tab.active { background: var(--green); color: var(--white); border-color: var(--green); }

        .compose { background: var(--white); border: 1.5px solid var(--border); border-radius: 16px; padding: 1.4rem 1.5rem; box-shadow: var(--shadow); margin-bottom: 1.25rem; }
        .compose-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 0.75rem; }
        .compose textarea { width: 100%; border: 1.5px solid var(--border); border-radius: 10px; padding: 0.85rem 1rem; font-family: 'Source Sans 3', sans-serif; font-size: 0.95rem; color: var(--text); background: var(--green-wash); resize: none; min-height: 90px; outline: none; transition: border-color 0.15s; line-height: 1.65; }
        .compose textarea:focus { border-color: var(--green-light); box-shadow: 0 0 0 3px rgba(64,145,108,0.1); }
        .compose textarea::placeholder { color: var(--muted); }
        .compose-foot { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.85rem; flex-wrap: wrap; }
        .compose-foot label { font-size: 0.78rem; color: var(--muted); white-space: nowrap; }
        .compose-foot select { border: 1.5px solid var(--border); border-radius: 8px; padding: 0.3rem 0.6rem; font-family: 'Source Sans 3', sans-serif; font-size: 0.8rem; color: var(--text); background: var(--white); outline: none; cursor: pointer; }
        .char-c { font-size: 0.72rem; color: var(--muted); margin-left: auto; }

        .toolbar { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .tlabel { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
        .btn-sm { background: var(--white); color: var(--text-mid); border: 1.5px solid var(--border); border-radius: 50px; padding: 0.35rem 0.9rem; font-family: 'Source Sans 3', sans-serif; font-weight: 700; font-size: 0.76rem; cursor: pointer; transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
        .btn-sm:hover { background: var(--green-pale); border-color: var(--green-light); }
        .btn-sm.active { background: var(--green); color: var(--white); border-color: var(--green); }

        .btn-post { background: linear-gradient(135deg, var(--gold), #a87c28); color: var(--green); border: none; border-radius: 50px; padding: 0.4rem 1.1rem; font-family: 'Source Sans 3', sans-serif; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; box-shadow: 0 3px 12px rgba(201,168,76,0.35); text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; margin-left: auto; }
        .btn-post:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(201,168,76,0.5); }
        .btn-post:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .divider { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.1rem; color: var(--muted); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

        /* ─── Card + watermark ─── */
        .card { position: relative; background: var(--white); border: 1.5px solid var(--border); border-radius: 16px; padding: 1.2rem 1.4rem 1.2rem 1.75rem; margin-bottom: 0.85rem; box-shadow: var(--shadow); transition: transform 0.2s, box-shadow 0.2s; overflow: hidden; animation: rise 0.3s ease both; }
        @keyframes rise { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
        .card-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: linear-gradient(180deg, var(--green), var(--gold)); border-radius: 4px 0 0 4px; }

        /* Watermark — visible in screenshots but subtle when reading */
        .watermark {
          position: absolute;
          inset: 0;
          display: flex; flex-wrap: wrap;
          align-items: center; justify-content: center;
          gap: 1.5rem 2rem;
          padding: 0.5rem;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
          transform: rotate(-20deg) scale(1.3);
        }
        .wm-text {
          font-size: 0.62rem;
          font-weight: 700;
          color: rgba(26,71,42,0.07);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          white-space: nowrap;
          user-select: none;
        }

        .card-top { position: relative; z-index: 1; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .batch-badge { background: var(--green); color: var(--white); border-radius: 50px; padding: 0.2rem 0.7rem; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .pill { border-radius: 50px; padding: 0.18rem 0.6rem; font-size: 0.68rem; font-weight: 700; }
        .pill.green { background: var(--green-pale); color: var(--green); }
        .pill.amber { background: #fef3c7; color: #92400e; }
        .pill.red   { background: #fde8e8; color: var(--red); }
        .admin-tag { font-size: 0.67rem; color: #92400e; background: #fef9c3; border-radius: 50px; padding: 0.18rem 0.55rem; font-weight: 700; }
        .card-body { position: relative; z-index: 1; font-size: 0.97rem; line-height: 1.72; color: var(--text); word-break: break-word; margin-bottom: 0.85rem; }
        .card-foot { position: relative; z-index: 1; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .votes { display: flex; align-items: center; gap: 0.35rem; }
        .vbtn { background: var(--green-wash); border: 1.5px solid var(--border); border-radius: 7px; width: 28px; height: 28px; font-size: 0.65rem; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; color: var(--muted); }
        .vbtn.up:hover { background: var(--green-pale); border-color: var(--green-light); color: var(--green); }
        .vbtn.dn:hover { background: #fde8e8; border-color: var(--red); color: var(--red); }
        .score { font-weight: 700; font-size: 0.9rem; min-width: 22px; text-align: center; }
        .ts { font-size: 0.7rem; color: var(--muted); margin-left: auto; }
        .del-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; opacity: 0.4; transition: opacity 0.15s; }
        .del-btn:hover { opacity: 1; }

        .empty { text-align: center; padding: 3.5rem 1rem; color: var(--muted); }
        .empty-icon { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; opacity: 0.45; }
        .empty p { font-size: 0.9rem; }

        .inp { width: 100%; border: 1.5px solid var(--border); border-radius: 10px; padding: 0.75rem 1rem; font-family: 'Source Sans 3', sans-serif; font-size: 0.92rem; color: var(--text); background: var(--green-wash); outline: none; margin-bottom: 0.6rem; transition: border-color 0.15s; }
        .inp:focus { border-color: var(--green-light); box-shadow: 0 0 0 3px rgba(64,145,108,0.1); }
        .inp::placeholder { color: var(--muted); }
        .code-inp { text-align: center; letter-spacing: 0.3em; font-size: 1.05rem; font-weight: 700; text-transform: uppercase; }

        .btn-primary { background: linear-gradient(135deg, var(--green), var(--green-mid)); color: var(--white); border: none; border-radius: 50px; padding: 0.72rem 1.5rem; font-family: 'Source Sans 3', sans-serif; font-weight: 700; font-size: 0.92rem; cursor: pointer; width: 100%; margin-top: 0.5rem; transition: all 0.15s; box-shadow: 0 4px 16px rgba(26,71,42,0.25); letter-spacing: 0.03em; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(26,71,42,0.35); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .btn-ghost { background: transparent; color: var(--green-mid); border: 1.5px solid var(--border); border-radius: 50px; padding: 0.55rem 1.2rem; font-family: 'Source Sans 3', sans-serif; font-weight: 600; font-size: 0.84rem; cursor: pointer; width: 100%; margin-top: 0.5rem; transition: all 0.15s; }
        .btn-ghost:hover { background: var(--green-wash); border-color: var(--green-light); }
        .btn-ghost.sm { font-size: 0.76rem; padding: 0.4rem 1rem; margin-top: 0.25rem; }

        .overlay { position: fixed; inset: 0; background: rgba(10,35,20,0.75); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
        .modal { background: var(--white); border-radius: 24px; padding: 2.25rem 2rem 2rem; width: 100%; max-width: 380px; box-shadow: 0 24px 64px rgba(26,71,42,0.35); animation: pop 0.35s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes pop { from { opacity:0; transform:scale(0.88) translateY(24px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .modal.shake { animation: shk 0.45s cubic-bezier(0.36,0.07,0.19,0.97); }
        @keyframes shk { 10%,90%{transform:translateX(-3px)} 20%,80%{transform:translateX(5px)} 30%,50%,70%{transform:translateX(-5px)} 40%,60%{transform:translateX(5px)} }
        .modal-crest { display: flex; justify-content: center; margin-bottom: 1.25rem; }
        .crest-ring { width: 68px; height: 68px; border-radius: 50%; background: linear-gradient(135deg, var(--green), var(--green-mid)); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(26,71,42,0.3), 0 0 0 4px var(--gold); }
        .crest-icon { font-size: 1.75rem; filter: brightness(3); }
        .modal-title { font-family: 'Playfair Display', serif; font-size: 1.85rem; font-weight: 900; color: var(--green); text-align: center; letter-spacing: -0.02em; line-height: 1; }
        .modal-sub { font-size: 0.78rem; font-weight: 700; color: var(--gold); text-align: center; text-transform: uppercase; letter-spacing: 0.12em; margin: 0.35rem 0 1.5rem; }
        .modal-hint { font-size: 0.85rem; color: var(--muted); text-align: center; margin-bottom: 1.1rem; }
        .errmsg { color: var(--red); font-size: 0.82rem; text-align: center; margin-bottom: 0.5rem; }

        .site-foot { text-align: center; padding: 2rem 0 1rem; font-size: 0.72rem; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; }
      `}</style>

      {!session && <AuthModal onAuth={(token, user) => setSession({ token, user })} />}

      <div className="app">
        <div className="site-header">
          <div className="header-left">
            <div className="shield">⚔</div>
            <div className="header-text">
              <h1>Archer's Wall</h1>
              <p>De La Salle University · Anonymous Board</p>
            </div>
          </div>
          <div className="header-right">
            {session && <>
              <span className="user-chip">{session.user.email}</span>
              <button className="btn-logout" onClick={() => { sb.signOut(session.token); setSession(null); }}>Sign Out</button>
            </>}
          </div>
        </div>

        {session && <>
          {/* Screenshot warning */}
          <div className="warning-banner">
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>⚠️</span>
            <span className="warning-banner-text">
              Screenshotting and sharing posts is a violation of this space's trust. All posts are watermarked with your ID batch — leaks can be traced back to you.
            </span>
          </div>

          <div className="banner">
            <span style={{ fontSize: "1rem" }}>🏹</span>
            <span className="banner-text">Animo La Salle! — Say it freely. Only your ID batch shows.</span>
          </div>

          {isAdmin && (
            <div className="tabs">
              <button className={`tab ${tab === "feed" ? "active" : ""}`} onClick={() => setTab("feed")}>📋 Feed</button>
              <button className={`tab ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>👑 Admin View</button>
            </div>
          )}

          <div className="compose">
            <div className="compose-label">New Post — Post anonymously</div>
            <textarea placeholder="Speak your truth, Archer..." value={content} onChange={e => setContent(e.target.value.slice(0, 500))} />
            <div className="compose-foot">
              <label>⏱ Expires in</label>
              <select value={expires} onChange={e => setExpires(Number(e.target.value))}>
                <option value={6}>6 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours</option>
              </select>
              <span className="char-c">{content.length}/500</span>
              <button className="btn-post" onClick={submit} disabled={loading || !content.trim()}>{loading ? "Posting…" : "Post 🏹"}</button>
            </div>
          </div>

          <div className="toolbar">
            <span className="tlabel">Sort by</span>
            <button className={`btn-sm ${sort === "new" ? "active" : ""}`} onClick={() => setSort("new")}>🕐 New</button>
            <button className={`btn-sm ${sort === "top" ? "active" : ""}`} onClick={() => setSort("top")}>🔥 Top</button>
            <button className="btn-sm" style={{ marginLeft: "auto" }} onClick={fetchPosts}>↻ Refresh</button>
          </div>

          <div className="divider">⚔ {sorted.length} post{sorted.length !== 1 ? "s" : ""} ⚔</div>

          {sorted.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">🏹</span>
              <p>No posts yet — be the first Archer to speak up.</p>
            </div>
          ) : sorted.map((p, i) => (
            <div key={p.id} style={{ animationDelay: `${i * 0.04}s` }}>
              <PostCard post={p} isAdmin={isAdmin && tab === "admin"}
                viewerBatch={viewerBatch}
                onVote={(id, type) => sb.vote(session.token, id, type).then(fetchPosts)}
                onDelete={(id) => { if (confirm("Delete this post?")) sb.deletePost(session.token, id).then(fetchPosts); }} />
            </div>
          ))}

          <div className="site-foot">Archer's Wall · DLSU · Animo La Salle!</div>
        </>}
      </div>
    </>
  );
}
