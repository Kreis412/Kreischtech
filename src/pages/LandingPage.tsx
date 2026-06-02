import { 
  Shield, 
  Cpu, 
  BarChart3, 
  Zap, 
  Users, 
  Truck, 
  Search, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div className="landing-page" style={{ position: 'relative' }}>
      {/* Decorative Blobs */}
      <div className="blob" style={{ top: '-100px', left: '-100px' }}></div>
      <div className="blob" style={{ top: '40%', right: '-100px', background: 'var(--accent-purple)' }}></div>
      <div className="blob" style={{ bottom: '10%', left: '20%', background: 'var(--accent-teal)' }}></div>

      {/* Hero Section */}
      <section className="hero" style={{ paddingTop: '12rem', textAlign: 'center' }}>
        <div className="container">
          <div className="glass" style={{ display: 'inline-block', padding: '0.5rem 1.5rem', marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--accent-blue)' }}>
            Kreischtech AI Consulting
          </div>
          <h1 style={{ marginBottom: '2rem' }}>Secure, Local AI Built for the <br /><span className="gradient-text">Jobsite and the Boardroom.</span></h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '800px', margin: '0 auto 4rem' }}>
            We help Construction & Engineering firms deploy sovereign AI that protects your bids, blueprints, and data.
          </p>
          
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '6rem' }}>
            <a href="#packages" className="btn btn-primary">View Packages</a>
            <Link to="/beliefs" className="btn glass" style={{ border: '1px solid var(--glass-border)', color: 'white', textDecoration: 'none' }}>Our Beliefs</Link>
          </div>

          {/* Hero Image / Visual */}
          <div className="img-container" style={{ maxWidth: '1000px', margin: '0 auto', height: '400px' }}>
            <img src="https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=1200" alt="Construction Tech" />
            <div className="img-overlay"></div>
            <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', textAlign: 'left' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>Intelligent Infrastructure</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Deploying local LLMs at the Edge</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Framework */}
      <section id="services" className="container">
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2>Our Strategic <span className="gradient-text">Framework</span></h2>
          <p style={{ color: 'var(--text-muted)' }}>Proven methodology for AI integration in high-stakes environments.</p>
        </div>
        
        <div className="card-grid">
          <div className="glass glow-card" style={{ padding: '2.5rem' }}>
            <div style={{ background: 'rgba(0, 210, 255, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <BarChart3 color="var(--accent-blue)" />
            </div>
            <h3>Strategic Implementation</h3>
            <p style={{ color: 'var(--text-muted)' }}>AI roadmapping and high-level execution for construction leaders. We bridge the gap between vision and operational reality.</p>
          </div>
          <div className="glass glow-card" style={{ padding: '2.5rem' }}>
            <div style={{ background: 'rgba(157, 80, 187, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Cpu color="var(--accent-purple)" />
            </div>
            <h3>Technical Implementation</h3>
            <p style={{ color: 'var(--text-muted)' }}>Deploying local LLMs and RAG systems directly into your workflows (BIM, site reports, and safety logs).</p>
          </div>
          <div className="glass glow-card" style={{ padding: '2.5rem' }}>
            <div style={{ background: 'rgba(0, 242, 254, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Users color="var(--accent-teal)" />
            </div>
            <h3>Enablement & Transformation</h3>
            <p style={{ color: 'var(--text-muted)' }}>Staff training and organizational change management to ensure AI adoption delivers measurable ROI on every project.</p>
          </div>
        </div>
      </section>

      {/* Visual Break Section */}
      <section style={{ padding: '4rem 0' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          <div className="img-container" style={{ height: '500px' }}>
            <img src="https://images.unsplash.com/photo-1504307651254-35680f3346d4?auto=format&fit=crop&q=80&w=800" alt="Site Analysis" />
            <div className="img-overlay"></div>
          </div>
          <div>
            <h2 style={{ textAlign: 'left', marginBottom: '1.5rem' }}>Built for the <span className="gradient-text">Physical World</span></h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2rem' }}>
              Unlike generalist AI consultants, we understand that in construction, there is no "undo" button. Our implementations are grounded in BIM accuracy and jobsite reality.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                "On-premise LLM deployments",
                "Private RAG for BIM & Bids",
                "Offline-capable site intelligence",
                "Custom predictive maintenance models"
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <CheckCircle2 size={18} color="var(--accent-blue)" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The Construction Edge */}
      <section style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
        <div className="container">
          <h2>The <span className="gradient-text">Construction Edge</span></h2>
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            {[
              { icon: <Shield size={20} />, title: "Secure Data Handling", desc: "Protecting proprietary blueprints and bids." },
              { icon: <Zap size={20} />, title: "Offline-Capable AI", desc: "Intelligence for remote project sites." },
              { icon: <Truck size={20} />, title: "Smart Asset Management", desc: "Equipment usage and predictive maintenance." },
              { icon: <Search size={20} />, title: "Intelligent Site Evaluation", desc: "Automated hazard detection and analysis." },
              { icon: <CheckCircle2 size={20} />, title: "Compliance Automation", desc: "Streamlined safety logs and documentation." }
            ].map((item, idx) => (
              <div key={idx} className="glow-card" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', borderRadius: '16px' }}>
                <div style={{ color: 'var(--accent-blue)', marginTop: '0.2rem' }}>{item.icon}</div>
                <div>
                  <h4 style={{ marginBottom: '0.5rem' }}>{item.title}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="container">
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2>Value-Based <span className="gradient-text">Packages</span></h2>
          <p style={{ color: 'var(--text-muted)' }}>Transparent implementation tiers built for ROI.</p>
        </div>

        <div className="card-grid">
          {/* Foundation */}
          <div className="glass glow-card" style={{ padding: '3rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>Pilot</div>
            <h3>The Foundation</h3>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '1.5rem 0', color: 'var(--accent-blue)' }}>Entry-Level Implementation</div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Rapid local AI setup and basic advisory to prove value in 30 days.</p>
            <Link to="/pricing" className="btn glass" style={{ width: '100%', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)', textAlign: 'center', textDecoration: 'none' }}>View Pricing Details</Link>
          </div>

          {/* Framework */}
          <div className="glass glow-card" style={{ padding: '3rem', position: 'relative', overflow: 'hidden', border: '1px solid var(--accent-blue)' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--gradient-primary)', padding: '0.2rem 1.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'white', borderBottomLeftRadius: '12px' }}>MOST POPULAR</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: '1rem', textTransform: 'uppercase' }}>Growth</div>
            <h3>The Framework</h3>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '1.5rem 0', color: 'white' }}>Full Jobsite Integration</div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Full technical implementation and team enablement across your fleet.</p>
            <Link to="/pricing" className="btn btn-primary" style={{ width: '100%', textAlign: 'center', textDecoration: 'none' }}>View Pricing Details</Link>
          </div>

          {/* Skyline */}
          <div className="glass glow-card" style={{ padding: '3rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>Enterprise</div>
            <h3>The Skyline</h3>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '1.5rem 0', color: 'var(--accent-teal)' }}>Enterprise Transformation</div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Continuous transformation and custom model fine-tuning for industry leaders.</p>
            <Link to="/pricing" className="btn glass" style={{ width: '100%', border: '1px solid var(--glass-border)', textAlign: 'center', textDecoration: 'none' }}>View Pricing Details</Link>
          </div>
        </div>
      </section>

      {/* Footer / Contact CTA */}
      <footer id="contact" style={{ padding: '8rem 0 4rem', textAlign: 'center' }}>
        <div className="container">
          <div className="glass" style={{ padding: '4rem', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '1rem' }}>Ready to <span className="gradient-text">Secure Your Future?</span></h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>Schedule a consultation for a security-first AI roadmap tailored to your construction operations.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link to="/contact" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                Book Consultation <ArrowRight size={18} />
              </Link>
            </div>
          </div>
          <div style={{ marginTop: '6rem', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
            <div>© 2026 Kreischtech AI Consulting. All rights reserved.</div>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <span style={{ cursor: 'pointer' }}>Privacy Policy</span>
              <span style={{ cursor: 'pointer' }}>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
