// Pure-CSS crossfade + Ken Burns slideshow: no timers, no JS state, so it
// stays cheap regardless of how long the hero stays mounted.
const SLIDE_COUNT = 4;

export function HeroBackgroundSlides() {
  return (
    <div className="hp-hero-slides" aria-hidden="true">
      {Array.from({ length: SLIDE_COUNT }, (_, i) => (
        <div key={i} className={`hp-hero-slide hp-hero-slide-${i + 1}`} />
      ))}
      <div className="hp-hero-scrim" />
    </div>
  );
}
