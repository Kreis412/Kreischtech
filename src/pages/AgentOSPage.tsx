import { 
  Cpu, 
  Target, 
  Sparkles, 
  Mail, 
  Smartphone, 
  Globe2, 
  ShieldCheck, 
  Check, 
  Download,
  Landmark
} from 'lucide-react';
import SEO from '../components/SEO';

function AgentOSPage() {
  const gumroadUrl = "https://kreischtech.gumroad.com/l/weieu";

  return (
    <div className="agentos-page" style={{ position: 'relative', paddingTop: '8rem', paddingBottom: '6rem' }}>
      <SEO 
        title="AgentOS — Autonomous 5-Agent AI Agency in a Box"
        description="Launch an autonomous 5-agent AI client acquisition agency from your laptop in under 2 minutes. Zero coding, zero recurring monthly API fees."
        keywords="AI Agency, AgentOS, Autonomous Agents, AI Business in a Box, B2B Lead Generation, Ollama Agency"
      />

      {/* Decorative Blobs */}
      <div className="blob" style={{ top: '-100px', left: '-100px' }}></div>
      <div className="blob" style={{ top: '35%', right: '-100px', background: 'var(--accent-purple)' }}></div>
      <div className="blob" style={{ bottom: '10%', left: '10%', background: 'var(--accent-teal)' }}></div>

      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
        
        {/* HERO SECTION */}
        <section style={{ textAlign: 'center', marginBottom: '6rem' }}>
          <div className="glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', marginBottom: '2rem', fontSize: '0.85rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
            <Sparkles size={16} />
            <span>Turnkey Software Release &bull; Sell the Shovels</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: '2rem', letterSpacing: '-1.5px' }}>
            Launch a 5-Agent <br />
            <span className="gradient-text">Autonomous AI Agency</span> <br />
            From Your Laptop in 2 Minutes.
          </h1>

          <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '780px', margin: '0 auto 3rem', lineHeight: 1.6 }}>
            The self-hosted software suite that hunts high-ticket commercial clients, calculates tailored revenue leakage via local AI, and rings your phone when owners want to buy. <strong>Zero monthly cloud token bills. 100% private.</strong>
          </p>

          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '3rem' }}>
            <a href={gumroadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.75rem', borderRadius: '16px' }}>
              <Download size={20} />
              <span>Get AgentOS Lifetime Access — $197</span>
            </a>
            <a href="#features" className="btn glass" style={{ padding: '1rem 2rem', fontSize: '1.1rem', color: 'white', textDecoration: 'none', borderRadius: '16px' }}>
              How It Works
            </a>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#00f2fe" />
              <span>Zero Coding Required</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} color="#00d2ff" />
              <span>100% Local AI (Ollama Llama 3.1)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Smartphone size={18} color="#9d50bb" />
              <span>Instant Mobile Phone Alerts</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe2 size={18} color="#00f2fe" />
              <span>Global Market & Niche Engine</span>
            </div>
          </div>
        </section>

        {/* 5 AGENTS ARCHITECTURE */}
        <section id="features" style={{ marginBottom: '8rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--accent-blue)', fontWeight: 700 }}>Under The Hood</span>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem' }}>Meet Your 5 Autonomous Agents</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0.75rem auto 0' }}>
              Five specialized agents coordinate in a 24/7 continuous loop to run your agency from prospect to closing script.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            
            <div className="glass glow-card" style={{ padding: '2rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(0, 210, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--accent-blue)' }}>
                <Cpu size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Agent 1: Lead Orchestrator</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                The master manager. Schedules continuous background cycles, manages SQLite database persistence, and coordinates task hand-offs.
              </p>
            </div>

            <div className="glass glow-card" style={{ padding: '2rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(157, 80, 187, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--accent-purple)' }}>
                <Target size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Agent 2: Global Prospect Hunter</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Scans and benchmarks high-ticket commercial firms across North America and international metros. Pinpoints operational bottlenecks.
              </p>
            </div>

            <div className="glass glow-card" style={{ padding: '2rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(0, 242, 254, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--accent-teal)' }}>
                <Sparkles size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Agent 3: Solution Specialist</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Connects to your local Ollama engine (Llama 3.1) to draft compelling, customized 1-page financial leakage audits for every business.
              </p>
            </div>

            <div className="glass glow-card" style={{ padding: '2rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(0, 210, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--accent-blue)' }}>
                <Mail size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Agent 4: Outreach Engine</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Automates CAN-SPAM compliant B2B introductory pitches with built-in deduplication protection so you never double-message a lead.
              </p>
            </div>

            <div className="glass glow-card" style={{ padding: '2rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: '#f59e0b' }}>
                <Smartphone size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Agent 5: Deal & Alert Dispatcher</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Monitors responses and fires mobile push alerts straight to your phone with complete company briefs and 2-minute phone scripts to close.
              </p>
            </div>

            <div className="glass glow-card" style={{ padding: '2rem', border: '1px solid rgba(0, 210, 255, 0.3)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(0, 210, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--accent-blue)' }}>
                <Landmark size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>+ Bonus: Capital & Grant Agent</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Tracks non-dilutive government innovation grants ($100k–$250k) and maintains a 10-slide investor seed pitch deck for your agency.
              </p>
            </div>

          </div>
        </section>

        {/* PRICING SECTION */}
        <section id="pricing" style={{ marginBottom: '8rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--accent-blue)', fontWeight: 700 }}>Simple, Transparent Pricing</span>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem' }}>Own the Complete Agency in a Box</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0.75rem auto 0' }}>
              No recurring SaaS subscription. Download the package, own it forever, keep 100% of the client retainers you close.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'stretch' }}>
            
            {/* TIER 1 */}
            <div className="glass" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Starter Pack</span>
                <div style={{ margin: '1rem 0' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900 }}>$147</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> / one-time</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Ideal for launching in 1 specific city or niche.</p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Core 5-Agent Suite</span></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Local Ollama AI Integration</span></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>1 Local Market Focus</span></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Visual Dashboard (Localhost)</span></li>
                </ul>
              </div>
              <a href={gumroadUrl} target="_blank" rel="noopener noreferrer" className="btn glass" style={{ marginTop: '2rem', padding: '0.85rem', textAlign: 'center', textDecoration: 'none', color: 'white', fontWeight: 700, borderRadius: '12px' }}>
                Select Starter
              </a>
            </div>

            {/* TIER 2 (FEATURED) */}
            <div className="glass" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '2px solid var(--accent-blue)', position: 'relative', transform: 'scale(1.03)', boxShadow: '0 0 35px rgba(0, 210, 255, 0.2)' }}>
              <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: 'var(--gradient-primary)', padding: '0.25rem 1rem', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Most Popular &bull; Founder Lifetime
              </div>

              <div>
                <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--accent-blue)', fontWeight: 800 }}>Complete AgencyOS</span>
                <div style={{ margin: '1rem 0' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 900 }}>$197</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> / lifetime</span>
                </div>
                <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '2rem' }}>The exact setup: Full source code, all global markets, and phone alerts.</p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><strong>Full 5-Agent Autonomous Loop</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Global Market Engine (US, UK, CA)</span></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Mobile Phone Alerts (Carrier SMS + Push)</span></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Gmail SMTP Engine with Deduplication</span></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Capital & Grant Funding Agent</span></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>1-Click Launchers (`.bat` & Web UI)</span></li>
                </ul>
              </div>
              <a href={gumroadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: '2rem', padding: '1rem', textAlign: 'center', textDecoration: 'none', fontWeight: 800, borderRadius: '12px', fontSize: '1rem' }}>
                Get Instant Founder Access &rarr;
              </a>
            </div>

            {/* TIER 3 */}
            <div className="glass" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Agency White-Label</span>
                <div style={{ margin: '1rem 0' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900 }}>$497</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> / one-time</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Re-brand AgentOS with your agency logo and resell to clients.</p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Everything in Founder Lifetime</span></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Full White-Label Commercial Rights</span></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Deploy for up to 10 paying clients</span></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#00f2fe" /><span>Priority Developer Architecture Support</span></li>
                </ul>
              </div>
              <a href={gumroadUrl} target="_blank" rel="noopener noreferrer" className="btn glass" style={{ marginTop: '2rem', padding: '0.85rem', textAlign: 'center', textDecoration: 'none', color: 'white', fontWeight: 700, borderRadius: '12px' }}>
                Select White-Label
              </a>
            </div>

          </div>
        </section>

        {/* FAQ SECTION */}
        <section style={{ maxWidth: '800px', margin: '0 auto 6rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Frequently Asked Questions</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Do I need a high-end computer to run AgentOS?</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                No. AgentOS connects natively to open-weight models via Ollama (Llama 3.1 8B or 3.2 3B) which run comfortably on any modern laptop or desktop PC.
              </p>
            </div>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Are there any monthly API or software fees?</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                None. You buy AgentOS once, download the package, and run it directly on your machine. Because it uses local AI inference and your own Gmail SMTP, there are zero recurring token fees.
              </p>
            </div>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Can I use this for niches outside of construction?</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Yes! The built-in Global Market Engine has presets for Commercial Roofing, HVAC, Excavation, Concrete, Auto Fleet Repair, and can be customized to any high-ticket service niche in seconds.
              </p>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="glass" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: '32px', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem' }}>Ready to Launch Your Autonomous Agency?</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 2.5rem', fontSize: '1.1rem' }}>
            Get the full source code, mission control dashboard, and 5 autonomous agents today.
          </p>
          <a href={gumroadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.1rem', fontWeight: 800, textDecoration: 'none', borderRadius: '16px' }}>
            Get Instant Access for $197 &rarr;
          </a>
        </section>

      </div>
    </div>
  );
}

export default AgentOSPage;
