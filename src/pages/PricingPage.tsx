import { 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  Zap,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

function PricingPage() {
  const packages = [
    {
      title: "Digital Presence",
      subtitle: "Web Design / Growth",
      price: "10k+",
      desc: "High-performance, bespoke web infrastructure designed for technical firms.",
      features: ["Custom React/Vite Build", "SEO & Performance Tuning", "Responsive UI/UX Design"]
    },
    {
      title: "Intelligent Infrastructure",
      subtitle: "AI Integration / Scale",
      price: "50k+",
      desc: "Full-scale AI deployment and custom web integration for your operational data.",
      features: ["Local LLM & RAG Setup", "Technical Workflow Integration", "AI-Powered Site Search", "Equipment & Safety Tooling"],
      popular: true
    },
    {
      title: "Individualized Pricing",
      subtitle: "Custom / Enterprise",
      price: "Bespoke",
      desc: "Fully tailored digital transformation and custom model development for industry leaders.",
      features: ["Custom Model Fine-Tuning", "Strategic Multi-Site Rollout", "24/7 Priority Support", "Dedicated Partnership Lead"]
    }
  ];

  return (
    <div className="pricing-page" style={{ paddingTop: '8rem', position: 'relative' }}>
      <SEO 
        title="AI Consulting Packages & Pricing"
        description="Explore our value-based implementation tiers, from rapid pilot programs to full enterprise AI transformation."
        keywords="AI Pricing, Construction AI Consulting, AI Implementation Cost"
      />
      <div className="blob" style={{ top: '10%', right: '5%', background: 'var(--accent-teal)' }}></div>
      
      <div className="container">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)', textDecoration: 'none', marginBottom: '2rem', fontWeight: 600 }}>
          <ArrowLeft size={20} /> Back to Home
        </Link>

        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 4rem' }}>
          <h1 style={{ marginBottom: '1.5rem' }}>Bespoke <span className="gradient-text">Investment</span></h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
            We don't believe in one-size-fits-all AI. Every construction project has a unique digital footprint, data structure, and security requirement. 
            Our pricing is calculated on a **case-by-case basis** to ensure the ROI aligns perfectly with your specific operational goals.
          </p>
        </div>

        <div className="card-grid" style={{ marginBottom: '6rem' }}>
          {packages.map((pkg, idx) => (
            <div key={idx} className="glass glow-card" style={{ padding: '3rem', position: 'relative', border: pkg.popular ? '1px solid var(--accent-blue)' : '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}>
              {pkg.popular && (
                <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--gradient-primary)', padding: '0.2rem 1.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'white', borderBottomLeftRadius: '12px' }}>RECOMMENDED</div>
              )}
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>{pkg.subtitle}</div>
              <h3>{pkg.title}</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1.5rem 0', color: 'var(--accent-blue)' }}>Case-by-Case Basis</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', minHeight: '3rem' }}>{pkg.desc}</p>
              
              <ul style={{ listStyleType: 'none', padding: 0, margin: '0 0 2.5rem', color: 'var(--text-muted)', fontSize: '0.95rem', flexGrow: 1 }}>
                {pkg.features.map((feat, fIdx) => (
                  <li key={fIdx} style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} color="var(--accent-blue)" /> {feat}
                  </li>
                ))}
              </ul>
              
              <Link to="/contact" className={pkg.popular ? "btn btn-primary" : "btn glass"} style={{ width: '100%', textAlign: 'center', textDecoration: 'none', border: pkg.popular ? 'none' : '1px solid var(--glass-border)' }}>
                Request Exact Quote
              </Link>
            </div>
          ))}
        </div>

        {/* ROI Logic */}
        <section className="glass" style={{ padding: '4rem', marginBottom: '8rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2>The Kreischtech <span className="gradient-text">AI</span> ROI Model</h2>
            <p style={{ color: 'var(--text-muted)' }}>Why our clients view our solutions as an asset, not an expense.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '3rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--accent-blue)', marginBottom: '1.5rem' }}><TrendingUp size={40} style={{ margin: '0 auto' }} /></div>
              <h4>Efficiency Gain</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Automating site reports and BIM auditing typically saves project managers 10-15 hours per week.</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--accent-purple)', marginBottom: '1.5rem' }}><ShieldCheck size={40} style={{ margin: '0 auto' }} /></div>
              <h4>Risk Mitigation</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Early hazard detection and automated compliance can reduce insurance premiums and OSHA liabilities.</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--accent-teal)', marginBottom: '1.5rem' }}><Zap size={40} style={{ margin: '0 auto' }} /></div>
              <h4>Zero Rework</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>AI-driven blueprint-to-site verification eliminates costly construction errors before concrete is poured.</p>
            </div>
          </div>
        </section>

        <div style={{ textAlign: 'center', paddingBottom: '6rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Need a <span className="gradient-text">Custom Plan?</span></h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
            For multi-national firms or complex infrastructure projects, we offer fully tailored strategic transformation partnerships.
          </p>
          <Link to="/contact" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            Contact for Enterprise RFP <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
