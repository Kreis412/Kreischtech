import { 
  Target, 
  HandMetal, 
  Heart, 
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';

function BeliefsPage() {
  const beliefs = [
    {
      icon: <Target size={32} />,
      title: "Data Sovereignty",
      desc: "Your data is your capital. We believe that proprietary bids, BIM models, and site intelligence should never be used to train a third-party's public model. Your AI should remain your property."
    },
    {
      icon: <ShieldAlert size={32} />,
      title: "Operational Integrity",
      desc: "In construction, errors cost lives and millions in rework. We believe AI must be grounded in physical reality (BIM, site scans) rather than statistical probability, eliminating 'hallucinations' in critical logs."
    },
    {
      icon: <HandMetal size={32} />,
      title: "Human-Centric Superpowers",
      desc: "We don't build AI to replace the foreman; we build it to give them a superpower. Our tools are designed to automate the 'grind' so your team can focus on the 'craft'."
    },
    {
      icon: <Heart size={32} />,
      title: "Local-First Innovation",
      desc: "We believe the most powerful innovation happens at the 'Edge.' Local AI is faster, more secure, and works where the job is—even if that's a disconnected jobsite in a remote area."
    }
  ];

  return (
    <div className="beliefs-page" style={{ paddingTop: '8rem', position: 'relative' }}>
      <div className="blob" style={{ top: '10%', right: '5%' }}></div>
      <div className="blob" style={{ bottom: '10%', left: '5%', background: 'var(--accent-teal)' }}></div>
      
      <div className="container">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)', textDecoration: 'none', marginBottom: '2rem', fontWeight: 600 }}>
          <ArrowLeft size={20} /> Back to Home
        </Link>

        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 6rem' }}>
          <h1 style={{ marginBottom: '1.5rem' }}>Our <span className="gradient-text">Core Beliefs</span></h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
            KaiAI was founded on the principle that the construction industry deserves technology that respects its privacy, values its data, and understands the weight of a physical build.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '3rem', marginBottom: '8rem' }}>
          {beliefs.map((belief, idx) => (
            <div key={idx} className="glass glow-card" style={{ padding: '3rem' }}>
              <div style={{ color: 'var(--accent-blue)', marginBottom: '1.5rem' }}>{belief.icon}</div>
              <h3 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>{belief.title}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>{belief.desc}</p>
            </div>
          ))}
        </div>

        {/* Visual Element */}
        <section className="glass" style={{ padding: '4rem', textAlign: 'center', marginBottom: '6rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ marginBottom: '1rem' }}>Built for the <span className="gradient-text">Long Term</span></h2>
            <p style={{ maxWidth: '600px', margin: '0 auto 2rem', color: 'var(--text-muted)' }}>
              We aren't chasing the next hype cycle. We are building the foundational intelligence that will power the next 100 years of construction infrastructure.
            </p>
          </div>
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            background: 'url(https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=1200) center/cover',
            opacity: 0.1,
            zIndex: 0
          }}></div>
        </section>

        <div style={{ textAlign: 'center', paddingBottom: '6rem' }}>
          <h2 style={{ marginBottom: '2rem' }}>Ready to <span className="gradient-text">Partner with Us?</span></h2>
          <Link to="/contact" className="btn btn-primary" style={{ textDecoration: 'none' }}>Book Your Strategy Session</Link>
        </div>
      </div>
    </div>
  );
}

export default BeliefsPage;
