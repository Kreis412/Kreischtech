import './Hub.css';

const appUrl = 'https://contractorsight-pilot.onrender.com/';
const consultingEmail = 'mailto:kreischtech@gmail.com?subject=KreischTech%20consulting%20inquiry';
const testUrl = 'https://play.google.com/apps/testing/com.kreischtech.contractorsight';

export default function App() {
  return <div className="hub">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="hub-nav"><a className="brand" href="/" aria-label="KreischTech home"><img src="/contractorsight-logo.png" alt="" /><span>KreischTech<small>AI consulting and software</small></span></a><a className="nav-open" href={appUrl}>Open web app <span aria-hidden="true">↗</span></a></header>
    <main id="main">
      <section className="consulting-hero" aria-labelledby="consulting-title">
        <p className="eyebrow">KREISCHTECH AI CONSULTING</p>
        <h1 id="consulting-title">AI consulting and business planning for small businesses</h1>
        <p className="intro">We help owners build business plans, bring AI into the tools they already use, and automate repetitive work. Start with a new business idea or a process that takes too much of your team's time.</p>
        <div className="hub-actions">
          <a className="hub-button primary" href={consultingEmail}>Talk about your project</a>
          <a className="hub-button secondary" href="#contractorsight">Explore ContractorSight</a>
        </div>
      </section>
      <section className="hub-features" aria-labelledby="services-title">
        <h2 id="services-title">Consulting services</h2>
        <div className="feature-grid">
          <article><h3>Business planning</h3><p>Turn your idea into a written plan with target customers, startup costs, revenue assumptions, and milestones.</p></article>
          <article><h3>AI integration</h3><p>Choose AI tools for your business and set them up for tasks such as drafting internal documents, organizing project notes, and answering common questions.</p></article>
          <article><h3>Automation and training</h3><p>Streamline repeat work like intake, follow-ups, and reporting. Give your team practical training and a process for reviewing AI output.</p></article>
        </div>
      </section>
      <section className="hub-hero product-hero" id="contractorsight" aria-labelledby="product-title">
        <div><p className="eyebrow">CONTRACTORSIGHT BY KREISCHTECH</p><h2 id="product-title">Turn jobsite photos into project plans</h2><p className="intro">Turn jobsite photos into useful observations, cost estimates, and next steps. Keep your projects moving—from the first walkthrough to the work ahead.</p><div className="hub-actions"><a className="hub-button primary" href={appUrl}>Open ContractorSight <span aria-hidden="true">↗</span></a><a className="hub-button secondary" href="#android">Get it on Android <span aria-hidden="true">↓</span></a></div><p className="fine">Use the web app on your phone, tablet, or computer.</p><a className="product-hunt-badge" href="https://www.producthunt.com/products/contractorsight-by-kreischtech?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-contractorsight-by-kreischtech" target="_blank" rel="noopener noreferrer"><img alt="ContractorSight by KreischTech - Turn jobsite photos into clearer plans and estimates | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1276538&amp;theme=light&amp;t=1792010592836" /></a></div>
        <div className="hero-art"><img src="/contractorsight-feature.png" alt="ContractorSight: turn jobsite photos into clearer plans" /></div>
      </section>
      <section className="hub-features" aria-labelledby="features-title"><p className="eyebrow">FROM PHOTO TO PLAN</p><h2 id="features-title">Less paperwork. More forward progress.</h2><div className="feature-grid">
        <article><span className="feature-number">01 / OBSERVE</span><h3>Start with a photo</h3><p>Analyze visible jobsite conditions, flag potential concerns, and add your own measurements and notes.</p></article>
        <article><span className="feature-number">02 / PLAN</span><h3>Build out the details</h3><p>Develop estimated costs and material lists as you collect information. Ask Joe for help thinking through the next step.</p></article>
        <article><span className="feature-number">03 / ORGANIZE</span><h3>Keep the job together</h3><p>Bring project photos, work items, crews, and costs into one place, accessible from the field or your desk.</p></article>
      <article><span className="feature-number">04 / CONNECT</span><h3>Keep your customers informed</h3><p>Share progress, selected photos, milestones and expected completion through a private customer link. Exchange simple project messages while keeping internal finances private. No customer account or app download needed.</p></article></div><p className="judgment">You stay in charge. AI observations and estimates need your review; they do not certify structural safety, code compliance, or buildability.</p></section>
      <section className="access-section" id="get-started" aria-labelledby="access-title"><p className="eyebrow">CHOOSE HOW YOU WORK</p><h2 id="access-title">Your jobsite. Your device.</h2><div className="access-grid">
        <article className="access-card"><span className="badge">WEB APP</span><h3>Open it. Get to work.</h3><p>Use ContractorSight in your browser on Android, iPhone, tablet, or computer. Sign in to your account to access your workspace.</p><a className="hub-button primary" href={appUrl}>Launch web app <span aria-hidden="true">↗</span></a><p className="fine">No app-store download required. Plans and AI allowances are shown in the app.</p></article>
        <article className="access-card" id="android"><span className="badge muted">GOOGLE PLAY · TESTING</span><h3>Help shape the Android app.</h3><p>Our US open-testing release has been submitted for Google review. Check the invitation below for availability.</p><a className="hub-button secondary" href={testUrl}>Check Google Play test access <span aria-hidden="true">↗</span></a><p className="fine">Use your Google Play account. Access may be limited until Google approves the open test. Already an internal tester? Leave that program before joining another test.</p></article>
      </div></section>
      <section className="hub-support"><div><p className="eyebrow">BUILT WITH CONTRACTORS</p><h2>Have a question or an idea?</h2><p>Tell us what would make your next job easier. Having work done? Recommend ContractorSight to your contractor for clearer progress updates and a simple place to ask questions.</p></div><a className="hub-button secondary" href="mailto:kreischtech@gmail.com">Contact KreischTech</a></section>
    </main>
    <footer className="hub-footer"><div><strong>KreischTech</strong><p>Kreischtech Contractors LLC, doing business as KreischTech</p></div><a href="mailto:kreischtech@gmail.com">kreischtech@gmail.com</a></footer>
  </div>;
}
