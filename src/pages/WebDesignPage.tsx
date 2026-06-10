import { 
  Palette, 
  Zap, 
  Code2,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

function WebDesignPage() {
  return (
    <div className="web-design-page" style={{ position: 'relative' }}>
      <SEO 
        title="High-Performance Website Design"
        description="Bespoke, high-performance website design for technical and industrial firms. We build sites that are fast, secure, and integrated with modern AI capabilities."
        keywords="Web Design, UI/UX, Performance Optimization, Technical Website Design, React Development"
      />

      {/* Decorative Blobs */}
      <div className="blob" style={{ top: '-100px', left: '-100px' }}></div>
      <div className="blob" style={{ top: '40%', right: '-100px', background: 'var(--accent-purple)' }}></div>
      <div className="blob" style={{ bottom: '10%', left: '20%', background: 'var(--accent-teal)' }}></div>

      {/* Hero Section */}
      <section className="hero" style={{ paddingTop: '12rem', textAlign: 'center' }}>
        <div className="container">
          <div className="glass" style={{ display: 'inline-block', padding: '0.5rem 1.5rem', marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--accent-blue)' }}>
            Digital Infrastructure
          </div>
          <h1 style={{ marginBottom: '2rem' }}>Performance-First <br /><span className="gradient-text">Website Design.</span></h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '800px', margin: '0 auto 4rem' }}>
            We build high-stakes digital experiences for Construction, Engineering, and Tech firms that demand speed, security, and precision.
          </p>
          
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '6rem' }}>
            <Link to="/contact" className="btn btn-primary">Start Your Project</Link>
          </div>

          {/* Featured Visual */}
          <div className="img-container" style={{ maxWidth: '1000px', margin: '0 auto', height: '400px' }}>
            <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1200" alt="Web Design and Analytics" />
            <div className="img-overlay"></div>
            <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', textAlign: 'left' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>Beyond Aesthetics</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Websites as high-performance tools</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="container" style={{ paddingBottom: '8rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2>Our Design <span className="gradient-text">Philosophy</span></h2>
          <p style={{ color: 'var(--text-muted)' }}>Merging industrial-grade reliability with modern user experience.</p>
        </div>
        
        <div className="card-grid">
          <div className="glass glow-card" style={{ padding: '2.5rem' }}>
            <div style={{ background: 'rgba(0, 210, 255, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Zap color="var(--accent-blue)" />
            </div>
            <h3>Extreme Performance</h3>
            <p style={{ color: 'var(--text-muted)' }}>Lightning-fast load times and optimized core web vitals. We build with modern stacks like React and Vite for zero-lag experiences.</p>
          </div>
          <div className="glass glow-card" style={{ padding: '2.5rem' }}>
            <div style={{ background: 'rgba(157, 80, 187, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Palette color="var(--accent-purple)" />
            </div>
            <h3>Technical UI/UX</h3>
            <p style={{ color: 'var(--text-muted)' }}>Designing for complex data and professional workflows. We ensure clarity, precision, and ease of use in every interface.</p>
          </div>
          <div className="glass glow-card" style={{ padding: '2.5rem' }}>
            <div style={{ background: 'rgba(0, 242, 254, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Code2 color="var(--accent-teal)" />
            </div>
            <h3>AI Integration</h3>
            <p style={{ color: 'var(--text-muted)' }}>Future-proofing your site with AI-powered features, from intelligent search to automated content management systems.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container" style={{ paddingBottom: '10rem' }}>
        <div className="glass" style={{ padding: '4rem', textAlign: 'center', borderRadius: '24px' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Ready to build your <span className="gradient-text">Digital Presence?</span></h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
            Let's discuss how we can build a site that reflects the technical excellence of your firm.
          </p>
          <Link to="/contact" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            Contact Us <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default WebDesignPage;
