import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SecurityPage from './pages/SecurityPage';
import BeliefsPage from './pages/BeliefsPage';
import ContactPage from './pages/ContactPage';
import PricingPage from './pages/PricingPage';

function App() {
  return (
    <Router>
      <div className="app">
        {/* Global Navigation */}
        <nav className="glass" style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '1200px', zIndex: 1000, padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-1px' }}>
            Kreischtech <span className="gradient-text">AI</span>
          </Link>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <Link to="/" style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.9rem' }}>Services</Link>
            <Link to="/security" style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.9rem' }}>Data Security</Link>
            <Link to="/pricing" style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.9rem' }}>Pricing</Link>
            <Link to="/beliefs" style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.9rem' }}>Our Beliefs</Link>
            <Link to="/contact" className="btn btn-primary" style={{ padding: '0.4rem 1.2rem', fontSize: '0.9rem', textDecoration: 'none' }}>Get Started</Link>
          </div>
        </nav>

        {/* Page Content */}
        <Routes>
          <Route path="/" element={<LandingPage />} />
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
