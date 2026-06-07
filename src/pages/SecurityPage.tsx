import { 
  ShieldCheck, 
  Lock, 
  Server, 
  EyeOff, 
  HardHat,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

function SecurityPage() {
  return (
    <div className="security-page" style={{ paddingTop: '8rem', position: 'relative' }}>
      <SEO 
        title="Data Security & Sovereign AI"
        description="Learn how we protect your proprietary blueprints and bids using on-premise LLM deployments and offline-capable site intelligence."
        keywords="Data Security AI, On-premise LLM, Private AI, Construction Data Protection"
      />
      <div className="blob" style={{ top: '20%', left: '-100px', background: 'var(--accent-blue)' }}></div>
      <div className="blob" style={{ bottom: '20%', right: '-100px', background: 'var(--accent-purple)' }}></div>

      <div className="container">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)', textDecoration: 'none', marginBottom: '2rem', fontWeight: 600 }}>
          <ArrowLeft size={20} /> Back to Home
        </Link>
        
        <div style={{ maxWidth: '800px', marginBottom: '4rem' }}>
          <h1 style={{ marginBottom: '1rem' }}>Our <span className="gradient-text">Security-First</span> Philosophy</h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
            In construction, your blueprints, bids, and contract intelligence are your competitive edge. 
            At Kreischtech AI, we believe AI adoption should never require you to sacrifice that edge to a third-party cloud.
          </p>
        </div>

        {/* Visual Callout */}
        <div className="img-container" style={{ height: '300px', marginBottom: '4rem' }}>
          <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc51?auto=format&fit=crop&q=80&w=1200" alt="Secure Servers" />
          <div className="img-overlay"></div>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2.5rem' }}>Your Data. <span className="gradient-text">Your Infrastructure.</span></h2>
          </div>
        </div>

        <div className="card-grid" style={{ marginBottom: '6rem' }}>
          <div className="glass glow-card" style={{ padding: '2.5rem' }}>
            <div style={{ background: 'rgba(0, 210, 255, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Server color="var(--accent-blue)" />
            </div>
            <h3>Local-First Architecture</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              We deploy models on your own hardware or VPC. Your data never leaves your infrastructure, eliminating the risk of training leaks on public cloud models.
            </p>
          </div>
          
          <div className="glass glow-card" style={{ padding: '2.5rem' }}>
            <div style={{ background: 'rgba(157, 80, 187, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Lock color="var(--accent-purple)" />
            </div>
            <h3>Zero-Knowledge Integration</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Our RAG systems index your local documentation (BIM, Site Logs, PDF bids) without ever syncing them to external servers.
            </p>
          </div>

          <div className="glass glow-card" style={{ padding: '2.5rem' }}>
            <div style={{ background: 'rgba(0, 242, 254, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <EyeOff color="var(--accent-teal)" />
            </div>
            <h3>Air-Gapped Capability</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              For remote project sites with limited connectivity, our AI operates fully offline, ensuring security and availability anywhere.
            </p>
          </div>
        </div>

        <section className="glass" style={{ padding: '4rem', marginBottom: '6rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2>Enterprise-Grade <span className="gradient-text">Protections</span></h2>
            <p style={{ color: 'var(--text-muted)' }}>Mitigating risks across every layer of your digital transformation.</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '3rem' }}>
            <div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}><ShieldCheck size={20} color="var(--accent-blue)" /> IP Safeguarding</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Protecting proprietary construction algorithms, architectural blueprints, and bid history from competitive intelligence gathering.</p>
            </div>
            <div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}><HardHat size={20} color="var(--accent-blue)" /> Compliance & Liability</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ensuring AI-generated safety logs and site evaluations meet OSHA and regional regulatory standards without data leaks.</p>
            </div>
            <div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}><CheckCircle2 size={20} color="var(--accent-blue)" /> Security Audits</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Every implementation includes a comprehensive data-leakage audit and a custom hardware security roadmap.</p>
            </div>
          </div>
        </section>

        <div style={{ textAlign: 'center', paddingBottom: '6rem' }}>
          <h2 style={{ marginBottom: '2rem' }}>Ready for a <span className="gradient-text">Security Audit?</span></h2>
          <Link to="/contact" className="btn btn-primary" style={{ textDecoration: 'none' }}>Schedule Your Audit</Link>
        </div>
      </div>
    </div>
  );
}

export default SecurityPage;
