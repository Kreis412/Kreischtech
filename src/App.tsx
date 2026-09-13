import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AgentOSPage from './pages/AgentOSPage';
import LandingPage from './pages/LandingPage';
import SecurityPage from './pages/SecurityPage';
import BeliefsPage from './pages/BeliefsPage';
import ContactPage from './pages/ContactPage';
import PricingPage from './pages/PricingPage';
import WebDesignPage from './pages/WebDesignPage';

function App() {
  const gumroadUrl = "https://kreischtech.gumroad.com/l/agentos";

  return (
    <Router>
      <div className="app">
        {/* Global Navigation */}
        <nav className="glass" style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', width: '92%', maxWidth: '1200px', zIndex: 1000, padding: '0.85rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 900, fontSize: '1.4rem', letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Kreischtech <span className="gradient-text">AI</span>
          </Link>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link to="/" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700 }}>AgentOS Software</Link>
            <Link to="/consulting" style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.9rem' }}>Consulting</Link>
            <Link to="/web-design" style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.9rem' }}>Web Design</Link>
            <Link to="/security" style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.9rem' }}>Data Security</Link>
            <Link to="/pricing" style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.9rem' }}>Pricing</Link>
            <a href={gumroadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '0.45rem 1.2rem', fontSize: '0.85rem', fontWeight: 800, textDecoration: 'none', borderRadius: '10px' }}>
              Buy AgentOS ($197)
            </a>
          </div>
        </nav>

        {/* Page Content */}
        <Routes>
          <Route path="/" element={<AgentOSPage />} />
          <Route path="/agentos" element={<AgentOSPage />} />
          <Route path="/consulting" element={<LandingPage />} />
          <Route path="/web-design" element={<WebDesignPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/beliefs" element={<BeliefsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/pricing" element={<PricingPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
