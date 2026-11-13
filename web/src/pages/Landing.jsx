import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Menu,
  Pause,
  Play,
  Sparkles,
  CalendarDays,
  FileText,
  ClipboardList,
  Image,
  X,
} from "lucide-react";
import { privateApi } from "@/lib/studio-api";
import {
  collections,
  experience,
  imageUrl,
  photos,
  studioEmail,
} from "@/data/studio";
import SessionHero from "@/components/landing/SessionHero";
import BookingForm from "@/components/landing/BookingForm";
import GalleryViewer from "@/components/landing/GalleryViewer";
import LumaChat from "@/components/landing/LumaChat";
import "@/components/landing/marketing.css";

export default function Landing() {
  const [publishedContent, setPublishedContent] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    privateApi("/public/content", { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setPublishedContent(result.content);
    }).catch(() => { /* The approved bundled copy remains available during an outage. */ });
    return () => controller.abort();
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [booking, setBooking] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [failedPhotos, setFailedPhotos] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [session, setSession] = useState(null);
  const reel = useRef(null);
  const [reelPaused, setReelPaused] = useState(false);
  const [reelHovered, setReelHovered] = useState(false);
  const [reelFocused, setReelFocused] = useState(false);
  const [reducedMotionEnabled, setReducedMotionEnabled] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotionEnabled(query.matches);
    updateMotion();
    query.addEventListener("change", updateMotion);
    const updateVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      query.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);
  useEffect(() => {
    if (reelPaused || reelHovered || reelFocused || reducedMotionEnabled || selectedPhoto !== null || !pageVisible) return undefined;
    const timer = window.setInterval(() => {
      const element = reel.current;
      if (!element || element.scrollWidth <= element.clientWidth + 1) return;
      const frames = [...element.querySelectorAll(".reel-frame")];
      const next = frames.find((frame) => frame.offsetLeft - element.offsetLeft > element.scrollLeft + 8);
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 8;
      element.scrollTo({ left: atEnd ? 0 : (next?.offsetLeft ?? frames[0]?.offsetLeft ?? 0) - element.offsetLeft, behavior: "smooth" });
    }, 3500);
    return () => window.clearInterval(timer);
  }, [reelPaused, reelHovered, reelFocused, reducedMotionEnabled, selectedPhoto, pageVisible]);
  function openBooking(initial = {}) {
    setBooking(initial);
    setChatOpen(false);
    setMenuOpen(false);
  }
  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollReel = (direction) =>
    reel.current?.scrollBy({
      left: direction * reel.current.clientWidth * 0.7,
      behavior: reducedMotion() ? "instant" : "smooth",
    });
  return (
    <div className="studio-page" onContextMenu={event => {
      if (!event.target.closest('input, textarea, select, [contenteditable="true"]')) event.preventDefault();
    }} onDragStart={event => { if (event.target.tagName === "IMG") event.preventDefault(); }}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="studio-header marketing-header">
        <a className="marketing-brand" href="#" aria-label="Illuminate Studios home">
          <img src="/brand/lens-gold.png" alt="" width="28" height="28" />
          <span>Illuminate Studios</span>
        </a>
        <div className="header-actions">
          <button className="icon-button bordered" aria-label="Ask Luma" onClick={() => setChatOpen(true)}><Sparkles size={18} /></button>
          <button className="studio-button secondary header-reserve" onClick={() => openBooking()}><CalendarDays size={16} />Reserve a date</button>
          <Link className="studio-button primary" to="/client">Sign in</Link>
          <button className="icon-button bordered menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
        <nav className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation" id="main-navigation">
          {[["Portfolio", "#portfolio"], ["Experience", "#experience"], ["Investment", "#investment"], ["Print collection", "#prints"]].map(([label, href]) => <a key={label} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
        </nav>
      </header>
      <main id="main-content">
        <SessionHero publishedContent={publishedContent} suspended={Boolean(booking) || chatOpen || selectedPhoto !== null} />
        <section className="portfolio-section marketing-reel" id="portfolio" aria-labelledby="portfolio-title">
          <div className="section-heading marketing-container">
            <div><p className="eyebrow">Selected frames</p><h2 id="portfolio-title">Recent work</h2></div>
            <div className="reel-controls">
              <button className="icon-button bordered" aria-label={reelPaused ? "Play portfolio slideshow" : "Pause portfolio slideshow"} aria-pressed={reelPaused} onClick={() => setReelPaused(value => !value)}>{reelPaused ? <Play size={18} /> : <Pause size={18} />}</button>
              <button className="icon-button bordered" aria-label="Scroll gallery left" onClick={() => scrollReel(-1)}><ArrowLeft size={18} /></button>
              <button className="icon-button bordered" aria-label="Scroll gallery right" onClick={() => scrollReel(1)}><ArrowRight size={18} /></button>
            </div>
          </div>
          <div className="gallery-reel" ref={reel} tabIndex={0} role="region" aria-label="Portfolio gallery reel" onMouseEnter={() => setReelHovered(true)} onMouseLeave={() => setReelHovered(false)} onFocusCapture={() => setReelFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setReelFocused(false); }}>
            {photos.map((photo, index) => <button className="reel-frame" key={photo.id} onClick={() => setSelectedPhoto(index)} aria-label={`View ${photo.title}`}>
              {failedPhotos[photo.id] ? <span className="sample-unavailable">{photo.category} sample image unavailable</span> : <img src={imageUrl(photo, 700)} alt={photo.alt} loading="lazy" width="480" height="600" onError={() => setFailedPhotos(value => ({ ...value, [photo.id]: true }))} />}
              <span><small>{photo.category}</small>{photo.title}</span>
            </button>)}
          </div>
          <p className="gallery-note marketing-container">Illustrative sample photography · Unsplash.</p>
        </section>
        <section className="experience-section marketing-container" id="experience" aria-labelledby="experience-title">
          <p className="eyebrow">How it runs</p><h2 id="experience-title">From first note to delivered gallery</h2>
          <div className="experience-grid">
            {experience.map((step, index) => { const Icon = [Sparkles, FileText, ClipboardList, Image][index]; return <article key={step.title}>
              <div className="process-meta"><Icon size={18} /><span className="step-number">0{index + 1}</span></div>
              <h3>{step.title}</h3><p>{step.text}</p>
            </article>; })}
          </div>
        </section>
        <section className="investment-section marketing-container" id="investment" aria-labelledby="investment-title">
          <p className="eyebrow">Collections</p><h2 id="investment-title">Three ways to work together</h2>
          <div className="collections-grid">
            {collections.map(item => <article key={item.id} className={`collection-card ${item.id === "signature" ? "featured" : ""}`}>
              <div className="collection-heading"><h3>{item.name}</h3>{item.id === "signature" && <span className="collection-badge">Most chosen</span>}</div>
              <p className="collection-audience">{item.forWhom}</p>
              <ul>{item.includes.map(text => <li key={text}><Check size={14} aria-hidden="true" />{text}</li>)}</ul>
              <button className={`studio-button ${item.id === "signature" ? "primary" : "secondary"}`} onClick={() => openBooking({ collection: item.id })}>Enquire about {item.name}<ArrowRight size={16} /></button>
            </article>)}
          </div>
          <p className="investment-note">Final pricing, availability and inclusions are confirmed in your studio proposal. An enquiry does not reserve a date.</p>
        </section>
        <section className="print-section marketing-container" id="prints" aria-labelledby="print-title">
          <p className="eyebrow">Print collection</p><h2 id="print-title">Frames off the screen</h2>
          <p className="print-note">Archival cotton-rag prints, hand-mounted and studio-signed. Available with every collection.</p>
          <div className="print-preview-grid">{[photos[2], photos[3], photos[4]].map(photo => <figure key={photo.id}>{failedPhotos[photo.id] ? <span className="sample-unavailable">{photo.category} sample image unavailable</span> : <img src={imageUrl(photo, 600)} alt={photo.alt} loading="lazy" width="600" height="800" onError={() => setFailedPhotos(value => ({ ...value, [photo.id]: true }))} />}</figure>)}</div>
          <p className="gallery-note">Illustrative sample photography · Unsplash.</p>
          {publishedContent && (publishedContent.philosophy_title !== "Not just how it looked. How it felt." || publishedContent.philosophy_description !== "Beautiful light. Honest expression. The people you love, exactly as they are. These are the things we want you to remember.") && <aside className="published-studio-note"><h3>{publishedContent.philosophy_title}</h3><p>{publishedContent.philosophy_description}</p></aside>}
        </section>
      </main>
      <footer className="studio-footer marketing-footer">
        <div className="marketing-footer-inner">
          <div className="footer-identity"><span>Illuminate Studios</span><a href={`mailto:${studioEmail}`}>{studioEmail}</a><p>Melbourne · Australia-wide</p><Link to="/studio">Studio access</Link></div>
          <div className="footer-actions">
            <button className="studio-button primary" onClick={() => openBooking()}><CalendarDays size={16} />Reserve a date</button>
            <button className="studio-button secondary" onClick={() => setChatOpen(true)}><Sparkles size={18} />Ask Luma</button>
            <Link className="studio-button secondary" to="/client">Client sign-in<ArrowRight size={16} /></Link>
          </div>
        </div>
      </footer>
      <LumaChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onBook={openBooking}
        session={session}
        setSession={setSession}
      />
      {!chatOpen && (
        <button
          className="luma-launcher"
          onClick={() => setChatOpen(true)}
          aria-label="Chat with Luma, AI booking assistant"
        >
          <Sparkles size={19} />
          <span>Ask Luma</span>
        </button>
      )}
      {booking && (
        <BookingForm
          initial={booking}
          sessionId={
            session?.booking_state === "collecting" ? session.session_id : null
          }
          onClose={() => setBooking(null)}
          onSubmitted={() => {
            if (session)
              setSession({
                ...session,
                draft: {},
                booking_state: "awaiting_studio_confirmation",
              });
          }}
        />
      )}
      {selectedPhoto !== null && (
        <GalleryViewer
          index={selectedPhoto}
          onChange={setSelectedPhoto}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </div>
  );
}
