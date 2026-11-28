import React, { useState } from 'react';
import { 
  BookOpen, Sparkles, Terminal, Code2, ShieldCheck, Upload, 
  GitPullRequest, ArrowRight, CheckCircle2, Copy, Rocket, 
  Key, Layers, RefreshCw, FileText, Check, HelpCircle 
} from 'lucide-react';

const Docs = () => {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [activeTab, setActiveTab] = useState('newApp'); // 'newApp' | 'updateApp'

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const newAppWorkflow = `name: CStore Push-to-Deploy (New App)

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Build Android Release APK
        run: |
          chmod +x ./gradlew
          ./gradlew assembleRelease

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: app/build/outputs/apk/release/*.apk
          name: Release \${{ github.ref_name }}
          draft: false
`;

  const updateAppWorkflow = `name: Build & Release Android APK

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-and-release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Build Android Release APK
        run: |
          chmod +x ./gradlew
          ./gradlew assembleRelease

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: app/build/outputs/apk/release/*.apk
          name: Release \${{ github.ref_name }}
          draft: false
`;

  return (
    <div className="docs-page fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* ── 1. Header ──────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', margin: '1rem 0 2.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '4px 14px', borderRadius: '20px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', marginBottom: '0.75rem' }}>
          <BookOpen size={14} color="#a5b4fc" />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Developer Documentation & Guides
          </span>
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
          CStore Platform Architecture & CI/CD
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '680px', margin: '0.5rem auto 0', lineHeight: 1.6 }}>
          Learn how to launch "Coming Soon" teasers, link them with GitHub Actions, chunk 500MB APKs directly into Supabase, and push live releases seamlessly.
        </p>
      </div>

      {/* ── 2. Core Architecture Highlights ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
        
        <div className="glass" style={{ padding: '1.5rem', borderRadius: '18px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a5b4fc', marginBottom: '1rem' }}>
            <Sparkles size={20} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '0.4rem' }}>
            Direct Storage Engine
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
            100% direct client-to-storage pipeline. APKs upload and download straight through Supabase Object Storage, bypassing intermediary Node.js proxies.
          </p>
        </div>

        <div className="glass" style={{ padding: '1.5rem', borderRadius: '18px', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', marginBottom: '1rem' }}>
            <Upload size={20} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '0.4rem' }}>
            Parallel 500MB Chunking
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
            Files exceeding 9MB are sliced into binary parts and uploaded in parallel streams. Downloads assemble chunks in-memory via HTML5 Blob streams.
          </p>
        </div>

        <div className="glass" style={{ padding: '1.5rem', borderRadius: '18px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', marginBottom: '1rem' }}>
            <Rocket size={20} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '0.4rem' }}>
            Zero-Form Teaser Linking
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
            Create a Coming Soon teaser first. When CI/CD runs, it automatically transfers the icon, description, and developer credit from the teaser to the live app!
          </p>
        </div>
      </div>

      {/* ── 3. Step-by-Step Guide: Link Coming Soon & Updates to GitHub ────── */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '3px 10px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '0.5rem' }}>
            <Terminal size={13} color="#fbbf24" />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
              Step-by-Step Walkthrough
            </span>
          </div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'white', margin: 0 }}>
            How to Link Coming Soon Teasers & App Updates to GitHub
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.35rem 0 0' }}>
            Follow these 4 straightforward steps to connect your Android project with CStore's automated deployment pipeline.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Step 1 */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>
                1
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', margin: 0 }}>
                Create Coming Soon Teaser on CStore Dashboard
              </h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 0.85rem' }}>
              Go to your <strong style={{ color: 'white' }}>User Dashboard (/dashboard)</strong> and click <strong style={{ color: '#a5b4fc' }}>"+ Create Coming Soon Teaser"</strong>.
            </p>
            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.9rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.85rem', color: '#cbd5e1' }}>
              <div>• <strong>App Name:</strong> Enter your exact app name (e.g. <code>MSM Cloud Backup</code>). <em>This is the key used by CI/CD to link to this teaser.</em></div>
              <div style={{ marginTop: '0.3rem' }}>• <strong>App Icon:</strong> Upload your logo (PNG/JPG). It will be preserved for the final live store card!</div>
              <div style={{ marginTop: '0.3rem' }}>• <strong>Short Tagline & Detailed Description:</strong> Describe features and release highlights.</div>
              <div style={{ marginTop: '0.3rem' }}>• <strong>Target Version:</strong> e.g. <code>v1.0.0-beta</code>.</div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>
                2
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', margin: 0 }}>
                Add GitHub Actions Repository Secret
              </h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 0.85rem' }}>
              In your GitHub Repository, navigate to <strong style={{ color: 'white' }}>Settings ➔ Secrets and variables ➔ Actions ➔ New repository secret</strong>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 700 }}>SECRET NAME</div>
                <code style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 800 }}>CSTORE_DEPLOY_TOKEN</code>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Your Supabase service role key or deploy token.</div>
              </div>
              <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 700 }}>TARGET SUPABASE URL</div>
                <code style={{ fontSize: '0.82rem', color: '#f8fafc' }}>https://cvbjoexzfwesgiapdcve.supabase.co</code>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Already configured as default in the script.</div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: '18px', border: '1px solid rgba(99, 102, 241, 0.3)', background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.04) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>
                  3
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', margin: 0 }}>
                    Add GitHub Workflow File
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Save in your repo at <code>.github/workflows/cstore-publish.yml</code>
                  </span>
                </div>
              </div>

              {/* Tab Selector: New App vs Update App */}
              <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '10px' }}>
                <button
                  onClick={() => setActiveTab('newApp')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeTab === 'newApp' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                    color: activeTab === 'newApp' ? '#a5b4fc' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🚀 New App (Teaser Link)
                </button>
                <button
                  onClick={() => setActiveTab('updateApp')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeTab === 'updateApp' ? 'rgba(245, 158, 11, 0.3)' : 'transparent',
                    color: activeTab === 'updateApp' ? '#fbbf24' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🔄 App Version Update
                </button>
              </div>
            </div>

            <div style={{ position: 'relative', background: '#070d1e', borderRadius: '14px', padding: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.08)', overflowX: 'auto' }}>
              <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                <button
                  onClick={() => copyToClipboard(activeTab === 'newApp' ? newAppWorkflow : updateAppWorkflow, 3)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    background: copiedIndex === 3 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    border: copiedIndex === 3 ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                    color: copiedIndex === 3 ? '#10b981' : 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  {copiedIndex === 3 ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  <span>{copiedIndex === 3 ? 'Copied YAML!' : 'Copy Workflow'}</span>
                </button>
              </div>

              <pre style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem', color: '#93c5fd', lineHeight: 1.6 }}>
                {activeTab === 'newApp' ? newAppWorkflow : updateAppWorkflow}
              </pre>
            </div>
          </div>

          {/* Step 4 */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>
                4
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', margin: 0 }}>
                Push Tag to Trigger Automatic Publishing
              </h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 0.85rem' }}>
              Whenever you're ready to publish, simply commit and push a Git tag matching your version:
            </p>
            <div style={{ background: '#070d1e', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem', color: '#a5b4fc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <code>git tag v1.0.0-beta && git push origin v1.0.0-beta</code>
              <button
                onClick={() => copyToClipboard('git tag v1.0.0-beta && git push origin v1.0.0-beta', 4)}
                style={{ background: 'transparent', border: 'none', color: copiedIndex === 4 ? '#10b981' : '#94a3b8', cursor: 'pointer' }}
                title="Copy Command"
              >
                {copiedIndex === 4 ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <div style={{ marginTop: '0.85rem', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              ⚡ <strong>What happens next:</strong> GitHub Actions triggers ➔ Gradle builds your APK ➔ creates your GitHub Release. Then on your <strong>CStore Dashboard</strong>, simply click <strong>"Link / Import APK & Go Live"</strong> on your card to chunk-upload the APK into Supabase Storage with real-time progress and launch to the store!
            </div>
          </div>

        </div>
      </section>

      {/* ── 4. Frequently Asked Questions ─────────────────────────────────── */}
      <section>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <HelpCircle size={20} color="#818cf8" /> CI/CD Common Questions
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
          <div className="glass" style={{ padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: 'white', margin: '0 0 0.4rem', fontSize: '0.95rem' }}>
              Q: Does manual upload still work?
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
              Yes! You can always upload an APK manually anytime from your <strong style={{ color: '#a5b4fc' }}>Developer Dashboard</strong>. The Explore page is strictly for browsing and viewing details.
            </p>
          </div>

          <div className="glass" style={{ padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: 'white', margin: '0 0 0.4rem', fontSize: '0.95rem' }}>
              Q: How does CStore know it's an Update?
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
              If an app with that exact <code>--name</code> already exists in the live catalog, CStore automatically saves the current version in <code>app_versions</code> and updates the live listing to your new version.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Docs;
