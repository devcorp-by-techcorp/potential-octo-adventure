import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play, Image } from "lucide-react";
import { imageUrl } from "@/data/studio";
import { heroSlides } from "@/data/hero-slides";
import GalleryViewer from "@/components/landing/GalleryViewer";

export default function SessionHero({ publishedContent, suspended }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [viewer, setViewer] = useState(null);
  const [failed, setFailed] = useState({});
  const touch = useRef(null);
  const swiped = useRef(false);
  const slide = heroSlides[index];
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(query.matches);
    const visibility = () => setHidden(document.hidden);
    query.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      query.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (paused || hovered || focused || hidden || reduced || viewer !== null || suspended) return undefined;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % heroSlides.length), 6500);
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, hidden, reduced, viewer, suspended]);
  function go(next) {
    setIndex((next + heroSlides.length) % heroSlides.length);
    setPaused(true);
  }
  return (
    <section className="hero session-hero" aria-label="Photography session slideshow"
      onClickCapture={event => {
        if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false; }
      }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onTouchStart={event => { const t = event.touches[0]; swiped.current = false; touch.current = { x: t.clientX, y: t.clientY }; }}
      onTouchEnd={event => {
        const t = event.changedTouches[0], start = touch.current;
        touch.current = null;
        if (t && start && Math.abs(t.clientX - start.x) > 48 && Math.abs(t.clientX - start.x) > Math.abs(t.clientY - start.y) * 1.4) { swiped.current = true; go(index + (t.clientX < start.x ? 1 : -1)); }
      }}>
      <div className="hero-copy">
        <img className="hero-brand-banner" src="/brand/logo-banner-gold.png" alt="Illuminate Studios" width="190" height="60" />
        <p className="eyebrow"><span className="hero-place">Melbourne · Australia-wide</span><span className="hero-kicker">{slide.category}</span></p>
        <div className="hero-slide-copy">
        <h1>{slide.title}</h1>
        <p className="hero-description">{index === 0 ? (publishedContent?.hero_description || slide.description) : slide.description}</p>
        </div>
        <div className="hero-session-controls">
          <button className="icon-button bordered" aria-label="Previous session" onClick={() => go(index - 1)}><ArrowLeft size={18} /></button>
          <button className="icon-button bordered" aria-label="Next session" onClick={() => go(index + 1)}><ArrowRight size={18} /></button>
        <div className="hero-session-tabs" aria-label="Choose a photography session">
          {heroSlides.map((item, position) => <button key={item.id} aria-label={`Show ${item.category}`} aria-pressed={position === index} onClick={() => go(position)}><span /></button>)}
        </div>
          <span className="hero-session-count">{String(index + 1).padStart(2, "0")} / {String(heroSlides.length).padStart(2, "0")}</span>
        </div>
        <div className="hero-access-controls">
          <button className="icon-button bordered" aria-label={paused ? "Play session slideshow" : "Pause session slideshow"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>
          <button className="icon-button bordered" aria-label={`View ${slide.category} sample photograph`} onClick={() => setViewer(index)}><Image size={18} /></button>
          <span>Illustrative sample photography · Unsplash</span>
        </div>
        {publishedContent?.hero_footnote && <p className="hero-footnote">{publishedContent.hero_footnote}</p>}
      </div>
      <div className="hero-collage session-hero-media">
        <button className="hero-photo-button" aria-label="Open hero photograph" onClick={() => { if (!swiped.current) setViewer(index); swiped.current = false; }}>
          {heroSlides.map((item, position) => !failed[item.id] && <img key={item.id}
            src={imageUrl(item)} alt={position === index ? item.alt : ""} aria-hidden={position !== index}
            className={position === index ? "is-active" : ""} width="700" height="900"
            loading={position === 0 ? "eager" : "lazy"} fetchPriority={position === 0 ? "high" : "auto"}
            onError={() => setFailed(value => ({ ...value, [item.id]: true }))} />)}
          {failed[slide.id] && <span className="hero-image-unavailable">{slide.category} sample image unavailable</span>}
        </button>
      </div>
      {viewer !== null && <GalleryViewer photos={heroSlides} index={viewer} onChange={setViewer} onClose={() => setViewer(null)} />}
    </section>
  );
}
