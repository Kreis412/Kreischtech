import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Calendar,
  Send,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';

function ContactPage() {
  return (
    <div className="contact-page" style={{ paddingTop: '8rem', position: 'relative' }}>
      <div className="blob" style={{ top: '15%', right: '-100px', background: 'var(--accent-blue)' }}></div>
      <div className="blob" style={{ bottom: '15%', left: '-100px', background: 'var(--accent-purple)' }}></div>

      <div className="container">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)', textDecoration: 'none', marginBottom: '2rem', fontWeight: 600 }}>
          <ArrowLeft size={20} /> Back to Home
        </Link>

        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 4rem' }}>
          <h1 style={{ marginBottom: '1.5rem' }}>Get in <span className="gradient-text">Touch</span></h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
            Ready to secure your jobsite with local AI? Schedule an appointment or send us a message to start your security-first roadmap.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '4rem', marginBottom: '6rem' }}>
          {/* Contact Info & Appointments */}
          <div>
            <div className="glass" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '2rem' }}>Contact Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ color: 'var(--accent-blue)' }}><Mail size={20} /></div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email us at</div>
                    <div>krtcbuilds@outlook.com</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ color: 'var(--accent-blue)' }}><Phone size={20} /></div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Call us at</div>
                    <div>440-645-4924</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ color: 'var(--accent-blue)' }}><MapPin size={20} /></div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Visit us</div>
                    <div>Ashtabula, Ohio</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass glow-card" style={{ padding: '2.5rem' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Calendar size={24} color="var(--accent-blue)" /> Book an Appointment
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Select a time for a 30-minute introductory consultation with our Strategic Implementation team.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'].map((time) => (
                  <button key={time} className="btn glass" style={{ border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                    <Clock size={14} style={{ marginRight: '8px' }} /> {time}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>View Full Calendar</button>
            </div>
          </div>

          {/* Contact Form */}
          <div className="glass" style={{ padding: '3rem' }}>
            <h3 style={{ marginBottom: '2rem' }}>Send a Message</h3>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>First Name</label>
                  <input type="text" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '8px', color: 'white' }} placeholder="John" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Last Name</label>
                  <input type="text" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '8px', color: 'white' }} placeholder="Doe" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Email Address</label>
                <input type="email" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '8px', color: 'white' }} placeholder="john@company.com" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Company Name</label>
                <input type="text" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '8px', color: 'white' }} placeholder="Acme Construction" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Project Scope</label>
                <select style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '8px', color: 'white' }}>
                  <option>The Foundation (Pilot)</option>
                  <option>The Framework (Growth)</option>
                  <option>The Skyline (Enterprise)</option>
                  <option>Custom Strategic Advisory</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>How can we help?</label>
                <textarea style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '8px', color: 'white', minHeight: '120px' }} placeholder="Tell us about your project requirements..."></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}>
                Send Inquiry <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;
