import { BurgerNav } from "@/components/BurgerNav";
import { HeroCampusMap } from "@/components/HeroCampusMap";

const team = [
  "Dobrawa Kiefer",
  "Nila Mönig",
  "Artur Semenenko",
  "Luca Rullo",
  "Samuel Rink",
  "Valentino Rusconi",
  "David Übelacker",
];

function Wordmark({ className = "wm--sm" }: { className?: string }) {
  return (
    <span className={`wm ${className}`} aria-label="Slot + Invaders">
      <span className="wm-text">Slot + Invaders</span>
      <svg className="wm-mark" aria-hidden="true">
        <use href="#bike" />
      </svg>
    </span>
  );
}

export default function Page() {
  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <symbol id="bike" viewBox="0 0 100 100">
            <g fill="#22C55E" transform="translate(23 1) scale(1.6)">
              <rect x="6" y="0" width="3" height="3" />
              <rect x="24" y="0" width="3" height="3" />
              <rect x="9" y="3" width="3" height="3" />
              <rect x="21" y="3" width="3" height="3" />
              <rect x="6" y="6" width="21" height="3" />
              <rect x="3" y="9" width="6" height="3" />
              <rect x="12" y="9" width="9" height="3" />
              <rect x="24" y="9" width="6" height="3" />
              <rect x="0" y="12" width="33" height="3" />
              <rect x="0" y="15" width="3" height="3" />
              <rect x="6" y="15" width="21" height="3" />
              <rect x="30" y="15" width="3" height="3" />
              <rect x="0" y="18" width="3" height="3" />
              <rect x="6" y="18" width="3" height="3" />
              <rect x="24" y="18" width="3" height="3" />
              <rect x="30" y="18" width="3" height="3" />
              <rect x="9" y="21" width="6" height="3" />
              <rect x="18" y="21" width="6" height="3" />
            </g>
            <g
              fill="none"
              stroke="#22D3EE"
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(-7.5 3) scale(1.15)"
            >
              <circle cx="27" cy="68" r="14" />
              <circle cx="73" cy="68" r="14" />
              <path d="M 42 42 L 60 42" />
              <path d="M 42 42 L 50 68" />
              <path d="M 60 42 L 50 68" />
              <path d="M 27 68 L 50 68" />
              <path d="M 27 68 L 42 42" />
              <path d="M 60 42 L 73 68" />
              <path d="M 38 34 L 46 34" />
              <path d="M 60 42 L 60 34" />
              <path d="M 56 34 L 64 34" />
            </g>
          </symbol>
        </defs>
      </svg>

      <header className="site-header">
        <div className="container">
          <a href="#top" aria-label="Slot + Invaders home">
            <Wordmark />
          </a>
          <nav className="site-nav" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#device">Device</a>
            <a href="#architecture">Architecture</a>
            <a href="#privacy">Privacy</a>
            <a href="#team">Team</a>
            <a href="https://github.com/The-Booligans/slotinvaders">GitHub</a>
          </nav>
          <BurgerNav />
        </div>
      </header>

      <main id="top">
        <section className="hero hero--map">
          <div className="hero-map" aria-hidden="true">
            <HeroCampusMap />
          </div>
          <a className="hero-eyebrow hero-eyebrow--top" href="#privacy">
            <svg
              className="hero-eyebrow-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" />
            </svg>
            Privacy first · Trusted by employees
          </a>
          <div className="container hero-overlay">
            <div className="hero-copy hero-copy--card">
              <h1>Make finding a velo spot easy.</h1>
              <p className="lead">
                Live counts for every bike parking area on the Endress+Hauser Reinach campus —
                before you even leave your desk.
              </p>
              <div className="hero-stores" aria-label="Get the app">
                <div className="hero-stores-row">
                  <a className="btn btn--store" href="https://app.slotinvaders.ch">
                    <svg
                      className="btn-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3 12h18" />
                      <path d="M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z" />
                    </svg>
                    Web
                  </a>
                  <a
                    className="btn btn--store"
                    href="/Slot_Invaders_v1.2.apk"
                    download
                    title="Direct Android APK download"
                  >
                    <svg
                      className="btn-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M12 3v12" />
                      <path d="m7 10 5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                    APK
                  </a>
                </div>
                <div className="hero-stores-row">
                  <button
                    type="button"
                    className="btn btn--store btn--disabled"
                    disabled
                    aria-disabled="true"
                    title="Coming soon"
                  >
                    <svg
                      className="btn-icon"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    App Store
                  </button>
                  <button
                    type="button"
                    className="btn btn--store btn--disabled"
                    disabled
                    aria-disabled="true"
                    title="Coming soon"
                  >
                    <svg
                      className="btn-icon"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M3.609 1.814L13.792 12 3.609 22.186a.996.996 0 0 1-.609-.92V2.734a1 1 0 0 1 .609-.92zm10.891 10.894l2.302 2.302-10.937 6.333 8.635-8.635zm3.198-3.199l2.808 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.495 12l2.203-2.491zM5.864 2.658l10.938 6.333-2.302 2.302L5.864 2.658z" />
                    </svg>
                    Play Store
                  </button>
                </div>
              </div>
              <a className="link-cta hero-learn" href="#features">
                Learn how →
              </a>
            </div>
          </div>
          <a className="scroll-cue" href="#features" aria-label="Scroll to features">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </section>

        <section className="section section--alt" id="features">
          <div className="container">
            <span className="eyebrow">Three ways to use it</span>
            <h2>From a quick browser check to a bike you track</h2>
            <p className="lead lead--full">
              Everything works without an account. Signing in only adds the things an account enables.
            </p>

            <div className="feature-grid">
              <article className="feature-card">
                <div className="feature-card__illust" aria-hidden="true">
                  <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
                    <rect width="320" height="180" fill="#e6fafd" />
                    <rect x="36" y="26" width="248" height="128" rx="8" fill="#ffffff" stroke="#0b0b0b" strokeWidth="1.5" />
                    <circle cx="48" cy="40" r="3" fill="#f87171" />
                    <circle cx="60" cy="40" r="3" fill="#fbbf24" />
                    <circle cx="72" cy="40" r="3" fill="#22c55e" />
                    <rect x="88" y="35" width="184" height="10" rx="5" fill="#f3f4f6" />
                    <text x="96" y="43" fontFamily="Barlow, sans-serif" fontSize="7" fill="#525E6B">slotinvaders.ch</text>
                    <line x1="36" y1="56" x2="284" y2="56" stroke="#e5e7eb" />
                    <g transform="translate(52,68)">
                      <circle cx="4" cy="8" r="4.5" fill="#22c55e" />
                      <text x="16" y="12" fontFamily="Barlow, sans-serif" fontSize="11" fontWeight="600" fill="#0b0b0b">Flow Main</text>
                      <text x="216" y="12" fontFamily="Barlow, sans-serif" fontSize="11" fontWeight="700" fill="#22c55e" textAnchor="end">38 free</text>
                      <line x1="0" y1="22" x2="216" y2="22" stroke="#e5e7eb" />
                    </g>
                    <g transform="translate(52,96)">
                      <circle cx="4" cy="8" r="4.5" fill="#f59e0b" />
                      <text x="16" y="12" fontFamily="Barlow, sans-serif" fontSize="11" fontWeight="600" fill="#0b0b0b">Sternenhof</text>
                      <text x="216" y="12" fontFamily="Barlow, sans-serif" fontSize="11" fontWeight="700" fill="#f59e0b" textAnchor="end">4 free</text>
                      <line x1="0" y1="22" x2="216" y2="22" stroke="#e5e7eb" />
                    </g>
                    <g transform="translate(52,124)">
                      <circle cx="4" cy="8" r="4.5" fill="#22c55e" />
                      <text x="16" y="12" fontFamily="Barlow, sans-serif" fontSize="11" fontWeight="600" fill="#0b0b0b">Flow South West</text>
                      <text x="216" y="12" fontFamily="Barlow, sans-serif" fontSize="11" fontWeight="700" fill="#22c55e" textAnchor="end">15 free</text>
                    </g>
                  </svg>
                </div>
                <h3>Just the info</h3>
                <p>
                  Open the page, see every stand&rsquo;s live occupancy. No account, no install,
                  nothing to configure.
                </p>
              </article>

              <article className="feature-card">
                <div className="feature-card__illust" aria-hidden="true">
                  <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
                    <rect width="320" height="180" fill="#e6fafd" />
                    {/* iBeacon on the left */}
                    <g transform="translate(60,90)">
                      <circle cx="0" cy="0" r="10" fill="#22d3ee" stroke="#0b0b0b" strokeWidth="1.5" />
                      <circle cx="0" cy="0" r="4" fill="#ffffff" />
                      <g fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M18 -14 Q28 -6 28 0 Q28 6 18 14" />
                        <path d="M26 -22 Q42 -10 42 0 Q42 10 26 22" />
                        <path d="M34 -30 Q56 -14 56 0 Q56 14 34 30" />
                      </g>
                      <text x="0" y="30" fontFamily="Barlow, sans-serif" fontSize="7" fontWeight="600" fill="#525E6B" textAnchor="middle">iBeacon</text>
                    </g>
                    {/* Phone */}
                    <g transform="translate(180,18)">
                      <rect x="0" y="0" width="110" height="150" rx="14" fill="#ffffff" stroke="#0b0b0b" strokeWidth="1.6" />
                      <rect x="42" y="4" width="26" height="4" rx="2" fill="#0b0b0b" />
                      <rect x="8" y="16" width="94" height="124" rx="6" fill="#f0f9ff" />
                      {/* mini campus shapes */}
                      <path d="M15 46 L35 36 L60 44 L68 60 L55 78 L24 72 Z" fill="#dcfce7" stroke="#22c55e" strokeWidth="1" />
                      <path d="M58 92 L82 82 L96 96 L94 122 L72 128 L58 112 Z" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" />
                      {/* bike pin */}
                      <g transform="translate(66,100)">
                        <path d="M0 0 L-8 -14 Q-8 -24 0 -24 Q8 -24 8 -14 Z" fill="#22d3ee" stroke="#0b0b0b" strokeWidth="1.2" />
                        <circle cx="0" cy="-16" r="4" fill="#ffffff" stroke="#0b0b0b" strokeWidth="0.8" />
                        <circle cx="-1.6" cy="-15" r="1" fill="#0b0b0b" />
                        <circle cx="1.6" cy="-15" r="1" fill="#0b0b0b" />
                        <line x1="-1.6" y1="-15" x2="1.6" y2="-15" stroke="#0b0b0b" strokeWidth="0.6" />
                      </g>
                      {/* you dot */}
                      <circle cx="30" cy="120" r="6" fill="#22d3ee" opacity="0.3" />
                      <circle cx="30" cy="120" r="2.5" fill="#22d3ee" stroke="#ffffff" strokeWidth="1" />
                    </g>
                  </svg>
                </div>
                <h3>Remembers your bike</h3>
                <p>
                  Install the app on iOS or Android. A small iBeacon on every stand pings your
                  phone, and when you leave campus the app pins down exactly which rack your bike
                  is on — all on-device, no account, nothing uploaded.
                </p>
              </article>

              <article className="feature-card">
                <div className="feature-card__illust" aria-hidden="true">
                  <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
                    <rect width="320" height="180" fill="#e6fafd" />
                    {/* Bars chart on the right */}
                    <g transform="translate(160,142)">
                      <line x1="-4" y1="0" x2="130" y2="0" stroke="#cbd5e1" strokeWidth="1" />
                      <rect x="4" y="-28" width="16" height="28" rx="2" fill="#22d3ee" opacity="0.35" />
                      <rect x="26" y="-42" width="16" height="42" rx="2" fill="#22d3ee" opacity="0.55" />
                      <rect x="48" y="-58" width="16" height="58" rx="2" fill="#22d3ee" opacity="0.75" />
                      <rect x="70" y="-72" width="16" height="72" rx="2" fill="#22c55e" />
                      <rect x="92" y="-88" width="16" height="88" rx="2" fill="#22c55e" />
                      <text x="64" y="18" fontFamily="Barlow, sans-serif" fontSize="9" fontWeight="700" fill="#0b0b0b" textAnchor="middle">127 km this week</text>
                    </g>
                    {/* Medal with the invader */}
                    <g transform="translate(70,76)">
                      <path d="M-26 20 L-26 46 L-6 36 L0 52 L6 36 L26 46 L26 20" fill="#22d3ee" stroke="#0b0b0b" strokeWidth="1.5" strokeLinejoin="round" />
                      <circle cx="0" cy="4" r="34" fill="#fde047" stroke="#0b0b0b" strokeWidth="2" />
                      <circle cx="0" cy="4" r="27" fill="none" stroke="#0b0b0b" strokeWidth="0.8" />
                      {/* pixel invader */}
                      <g transform="translate(-13,-10)" fill="#22c55e">
                        <rect x="4" y="0" width="3" height="3" />
                        <rect x="18" y="0" width="3" height="3" />
                        <rect x="7" y="3" width="3" height="3" />
                        <rect x="15" y="3" width="3" height="3" />
                        <rect x="4" y="6" width="17" height="3" />
                        <rect x="1" y="9" width="5" height="3" />
                        <rect x="9" y="9" width="7" height="3" />
                        <rect x="19" y="9" width="5" height="3" />
                        <rect x="0" y="12" width="25" height="3" />
                        <rect x="0" y="15" width="3" height="3" />
                        <rect x="6" y="15" width="13" height="3" />
                        <rect x="22" y="15" width="3" height="3" />
                        <rect x="4" y="18" width="3" height="3" />
                        <rect x="18" y="18" width="3" height="3" />
                      </g>
                    </g>
                    {/* streak chip */}
                    <g transform="translate(52,154)">
                      <rect x="-32" y="-10" width="64" height="20" rx="10" fill="#22c55e" />
                      <text x="0" y="4" fontFamily="Barlow, sans-serif" fontSize="10" fontWeight="700" fill="#ffffff" textAnchor="middle">3-day streak</text>
                    </g>
                  </svg>
                </div>
                <h3>Rank up</h3>
                <p>
                  Sign in and the app starts counting. Days by bike. Kilometres on your bike and
                  e-bike. Earn badges for every three days in a row, every ride under −10°C — more
                  to come.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="device">
          <div className="container">
            <span className="eyebrow">The thing on the stand</span>
            <h2>LiDAR or on-device YOLO, on an ESP32</h2>
            <p className="lead">
              A small node on each bike stand. Each one counts on the board and sends a single
              number.
            </p>

            <div className="device-grid">
              <ul className="bullet-list">
                <li className="bullet">
                  <span className="bullet__num">01</span>
                  <span className="bullet__text">
                    M5Stack AtomS3 (ESP32-S3) counts the bikes on the device
                  </span>
                </li>
                <li className="bullet">
                  <span className="bullet__num">02</span>
                  <span className="bullet__text">
                    LiDAR — an RPLidar C1 sweeps the row by depth, day or night
                  </span>
                </li>
                <li className="bullet">
                  <span className="bullet__num">03</span>
                  <span className="bullet__text">
                    Camera — an AtomS3R-CAM runs YOLO11n locally; the frame stays in RAM
                  </span>
                </li>
                <li className="bullet">
                  <span className="bullet__num">04</span>
                  <span className="bullet__text">
                    Reports the count over LoRaWAN — no site Wi-Fi needed, reaches a gateway hundreds
                    of metres away
                  </span>
                </li>
                <li className="bullet">
                  <span className="bullet__num">05</span>
                  <span className="bullet__text">
                    Runs on battery or a small solar panel — no mains, no cabling, mount it anywhere
                  </span>
                </li>
              </ul>

              <div className="device-illustration" aria-hidden="true">
                <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
                  <line x1="30" y1="280" x2="290" y2="280" stroke="#D4DADF" strokeWidth="1" />
                  <g>
                    <rect
                      x="110"
                      y="90"
                      width="110"
                      height="28"
                      fill="#FFFFFF"
                      stroke="#000"
                      strokeWidth="1.6"
                    />
                    <line x1="137.5" y1="90" x2="137.5" y2="118" stroke="#000" strokeWidth="1" />
                    <line x1="165" y1="90" x2="165" y2="118" stroke="#000" strokeWidth="1" />
                    <line x1="192.5" y1="90" x2="192.5" y2="118" stroke="#000" strokeWidth="1" />
                    <line x1="110" y1="104" x2="220" y2="104" stroke="#000" strokeWidth="0.8" />
                  </g>
                  <line x1="165" y1="118" x2="165" y2="140" stroke="#000" strokeWidth="1.6" />
                  <rect
                    x="130"
                    y="140"
                    width="70"
                    height="80"
                    rx="3"
                    fill="#FFFFFF"
                    stroke="#000"
                    strokeWidth="1.6"
                  />
                  <circle cx="188" cy="152" r="2.6" fill="#22D3EE" />
                  <line x1="140" y1="200" x2="190" y2="200" stroke="#000" strokeWidth="0.8" />
                  <line x1="140" y1="206" x2="190" y2="206" stroke="#000" strokeWidth="0.8" />
                  <line x1="140" y1="212" x2="190" y2="212" stroke="#000" strokeWidth="0.8" />
                  <rect
                    x="140"
                    y="162"
                    width="40"
                    height="22"
                    fill="none"
                    stroke="#000"
                    strokeWidth="0.8"
                  />
                  <text
                    x="160"
                    y="177"
                    textAnchor="middle"
                    fontFamily="Barlow, sans-serif"
                    fontSize="9"
                    fontWeight="600"
                    fill="#000"
                    letterSpacing="1"
                  >
                    ESP32
                  </text>
                  <rect x="162" y="220" width="6" height="60" fill="#000" />
                  <path
                    d="M 70 280 Q 70 260 90 260 Q 110 260 110 280"
                    stroke="#000"
                    strokeWidth="1.6"
                    fill="none"
                  />
                  <path
                    d="M 210 280 Q 210 260 230 260 Q 250 260 250 280"
                    stroke="#000"
                    strokeWidth="1.6"
                    fill="none"
                  />
                  <g stroke="#22D3EE" strokeWidth="2.2" fill="none" strokeLinecap="round">
                    <path d="M 215 150 Q 232 142 248 150" />
                    <path d="M 220 136 Q 244 123 268 136" />
                    <path d="M 225 122 Q 256 104 288 122" />
                  </g>
                  <line x1="195" y1="140" x2="208" y2="128" stroke="#000" strokeWidth="1.6" />
                  <circle cx="208" cy="128" r="2.4" fill="#000" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--alt" id="architecture">
          <div className="container">
            <span className="eyebrow">Under the hood</span>
            <h2>Sensors on bike stands → the cloud → every open client</h2>
            <p className="lead">
              A classic edge-to-cloud fan-out. Nothing exotic, nothing proprietary.
            </p>

            <div className="arch">
              <div className="arch-diagram">
                <svg
                  viewBox="0 0 1120 260"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="Architecture diagram"
                >
                  <defs>
                    <marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#000" />
                    </marker>
                  </defs>

                  <g>
                    <rect
                      x="20"
                      y="80"
                      width="180"
                      height="100"
                      fill="#FFFFFF"
                      stroke="#000"
                      strokeWidth="1.4"
                    />
                    <text
                      x="110"
                      y="106"
                      textAnchor="middle"
                      fontFamily="Barlow, sans-serif"
                      fontSize="10"
                      fontWeight="700"
                      fill="#22D3EE"
                      letterSpacing="2"
                    >
                      01 · EDGE
                    </text>
                    <text
                      x="110"
                      y="134"
                      textAnchor="middle"
                      fontFamily="Barlow, sans-serif"
                      fontSize="17"
                      fontWeight="600"
                      fill="#000"
                    >
                      ESP32 nodes
                    </text>
                    <text
                      x="110"
                      y="156"
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                      fontSize="11.5"
                      fill="#525E6B"
                    >
                      on bike stands
                    </text>
                    <g fill="#22D3EE">
                      {Array.from({ length: 10 }, (_, i) => (
                        <rect key={i} x={50 + i * 12} y="166" width="6" height="6" />
                      ))}
                    </g>
                  </g>

                  <line
                    x1="202"
                    y1="130"
                    x2="248"
                    y2="130"
                    stroke="#000"
                    strokeWidth="1.4"
                    markerEnd="url(#arrow)"
                  />
                  <text
                    x="225"
                    y="118"
                    textAnchor="middle"
                    fontFamily="Barlow, sans-serif"
                    fontSize="10"
                    fill="#525E6B"
                    letterSpacing="1"
                  >
                    LORAWAN
                  </text>

                  <g>
                    <rect
                      x="250"
                      y="80"
                      width="180"
                      height="100"
                      fill="#FFFFFF"
                      stroke="#000"
                      strokeWidth="1.4"
                    />
                    <text
                      x="340"
                      y="106"
                      textAnchor="middle"
                      fontFamily="Barlow, sans-serif"
                      fontSize="10"
                      fontWeight="700"
                      fill="#22D3EE"
                      letterSpacing="2"
                    >
                      02 · INGRESS
                    </text>
                    <text
                      x="340"
                      y="134"
                      textAnchor="middle"
                      fontFamily="Barlow, sans-serif"
                      fontSize="17"
                      fontWeight="600"
                      fill="#000"
                    >
                      LoRaWAN gateway
                    </text>
                    <text
                      x="340"
                      y="156"
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                      fontSize="11.5"
                      fill="#525E6B"
                    >
                      868 MHz · AES-128
                    </text>
                  </g>

                  <line
                    x1="432"
                    y1="130"
                    x2="478"
                    y2="130"
                    stroke="#000"
                    strokeWidth="1.4"
                    markerEnd="url(#arrow)"
                  />
                  <text
                    x="455"
                    y="118"
                    textAnchor="middle"
                    fontFamily="Barlow, sans-serif"
                    fontSize="10"
                    fill="#525E6B"
                    letterSpacing="1"
                  >
                    HTTPS
                  </text>

                  <g>
                    <rect
                      x="480"
                      y="80"
                      width="180"
                      height="100"
                      fill="#FFFFFF"
                      stroke="#000"
                      strokeWidth="1.4"
                    />
                    <text
                      x="570"
                      y="106"
                      textAnchor="middle"
                      fontFamily="Barlow, sans-serif"
                      fontSize="10"
                      fontWeight="700"
                      fill="#22D3EE"
                      letterSpacing="2"
                    >
                      03 · COMPUTE
                    </text>
                    <text
                      x="570"
                      y="134"
                      textAnchor="middle"
                      fontFamily="Barlow, sans-serif"
                      fontSize="17"
                      fontWeight="600"
                      fill="#000"
                    >
                      Azure Functions
                    </text>
                    <text
                      x="570"
                      y="156"
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                      fontSize="11.5"
                      fill="#525E6B"
                    >
                      Node 22 · /v1/readings
                    </text>
                  </g>

                  <line
                    x1="662"
                    y1="130"
                    x2="708"
                    y2="130"
                    stroke="#000"
                    strokeWidth="1.4"
                    markerEnd="url(#arrow)"
                  />

                  <g>
                    <rect
                      x="710"
                      y="80"
                      width="180"
                      height="100"
                      fill="#FFFFFF"
                      stroke="#000"
                      strokeWidth="1.4"
                    />
                    <text
                      x="800"
                      y="106"
                      textAnchor="middle"
                      fontFamily="Barlow, sans-serif"
                      fontSize="10"
                      fontWeight="700"
                      fill="#22D3EE"
                      letterSpacing="2"
                    >
                      04 · STATE &amp; FANOUT
                    </text>
                    <text
                      x="800"
                      y="134"
                      textAnchor="middle"
                      fontFamily="Barlow, sans-serif"
                      fontSize="17"
                      fontWeight="600"
                      fill="#000"
                    >
                      Cosmos DB
                    </text>
                    <text
                      x="800"
                      y="156"
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                      fontSize="11.5"
                      fill="#525E6B"
                    >
                      + Web PubSub · 10 s
                    </text>
                  </g>

                  <line
                    x1="892"
                    y1="130"
                    x2="938"
                    y2="130"
                    stroke="#000"
                    strokeWidth="1.4"
                    markerEnd="url(#arrow)"
                  />
                  <text
                    x="915"
                    y="118"
                    textAnchor="middle"
                    fontFamily="Barlow, sans-serif"
                    fontSize="10"
                    fill="#525E6B"
                    letterSpacing="1"
                  >
                    WebSocket
                  </text>

                  <g>
                    <rect
                      x="940"
                      y="80"
                      width="160"
                      height="100"
                      fill="#FFFFFF"
                      stroke="#000"
                      strokeWidth="1.4"
                    />
                    <text
                      x="1020"
                      y="106"
                      textAnchor="middle"
                      fontFamily="Barlow, sans-serif"
                      fontSize="10"
                      fontWeight="700"
                      fill="#22D3EE"
                      letterSpacing="2"
                    >
                      05 · CLIENTS
                    </text>
                    <text
                      x="1020"
                      y="134"
                      textAnchor="middle"
                      fontFamily="Barlow, sans-serif"
                      fontSize="17"
                      fontWeight="600"
                      fill="#000"
                    >
                      Web · iOS · Android
                    </text>
                    <text
                      x="1020"
                      y="156"
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                      fontSize="11.5"
                      fill="#525E6B"
                    >
                      every open viewer
                    </text>
                  </g>
                </svg>
              </div>
              <p className="arch-caption">
                Devices send their count over LoRaWAN — battery- or solar-powered, no site Wi-Fi,
                no cabling. A gateway relays the uplinks over HTTPS to the backend. Cosmos DB keeps
                the stand catalog, the latest count per device and 30 days of readings. Web PubSub
                pushes every stand&rsquo;s status to open clients every 10 seconds. See{" "}
                <code>architecture.md</code> for details.
              </p>
            </div>
          </div>
        </section>

        <section className="section section--alt" id="privacy">
          <div className="container">
            <span className="eyebrow">Privacy by design</span>
            <h2>No faces, no plates, no tracking — not even yours</h2>

            <div className="privacy-grid">
              <div className="privacy-block">
                <h3>
                  <span className="label">On the device</span> Counting on the board
                </h3>
                <p>
                  LiDAR measures depth, not light. The cameras run YOLO on the board and keep the
                  frame in RAM. Only one integer — how many bikes the device sees — is sent as a
                  reading.
                </p>
              </div>
              <div className="privacy-block">
                <h3>
                  <span className="label">In the cloud</span> Counts only
                </h3>
                <p>
                  The readings API accepts counts and rejects unknown fields. Cosmos DB holds the
                  stand catalog, counts and timestamps — no images, no people, no bike identities.
                  A camera&rsquo;s last frame can go to the team&rsquo;s debug viewer, held in
                  memory only and never stored.
                </p>
              </div>
            </div>

            <div className="callout">
              <span className="dot" />
              The challenge is explicit: no identifying individuals. We go further.
            </div>
          </div>
        </section>

        <section className="section" id="roadmap">
          <div className="container">
            <span className="eyebrow">Roadmap</span>
            <h2>What ships today — and what&rsquo;s next</h2>
            <p className="lead lead--full">
              The hackathon build already covers the whole live-counts path end to end. The next
              version turns the single &ldquo;Rank up&rdquo; card into a proper home for every
              rider.
            </p>

            <div className="roadmap-grid">
              <article className="roadmap-col roadmap-col--now">
                <header className="roadmap-col__head">
                  <span className="roadmap-col__badge">Shipping now · v1</span>
                  <h3>Working today</h3>
                </header>
                <ul className="roadmap-list">
                  <li>
                    <strong>Live stand counts.</strong> Every area on the campus, updated every few
                    seconds over LoRaWAN + the backend WebSocket.
                  </li>
                  <li>
                    <strong>3D campus map.</strong> One coloured pin per area, free count in a
                    badge, glides between stands when you tap one.
                  </li>
                  <li>
                    <strong>No account, no install.</strong> The web app at{" "}
                    <code>app.slotinvaders.ch</code> works for anyone with a browser.
                  </li>
                  <li>
                    <strong>Native Android and native iOS.</strong> Same Capacitor build wrapped
                    for both platforms.
                  </li>
                  <li>
                    <strong>Remembers your bike.</strong> One tiny iBeacon per stand, all-local
                    matching, nothing uploaded.
                  </li>
                  <li>
                    <strong>Privacy by design.</strong> Only the integer count leaves the sensor —
                    no images, no identities, no tracking.
                  </li>
                </ul>
              </article>

              <article className="roadmap-col roadmap-col--next">
                <header className="roadmap-col__head">
                  <span className="roadmap-col__badge">Next version</span>
                  <h3>Coming next</h3>
                </header>
                <ul className="roadmap-list">
                  <li>
                    <strong>Personalisation.</strong> Save your home stand, hide the ones you never
                    use, pin your favourites to the top of the list.
                  </li>
                  <li>
                    <strong>Pick your preferred spot.</strong> Mark a specific bay you aim for,
                    and the map tells you whether it&rsquo;s free before you set off.
                  </li>
                  <li>
                    <strong>Gamification.</strong> Deeper streaks, team challenges, friendly
                    leaderboards for the Reinach campus, seasonal badges.
                  </li>
                  <li>
                    <strong>Analytics.</strong> Your weekly km, days-by-bike history, best times
                    of day to find a slot — and a team view for departments that want it.
                  </li>
                  <li>
                    <strong>Store listings live.</strong> App Store and Play Store builds out of
                    review and installable in two taps.
                  </li>
                  <li>
                    <strong>More sensors, more stands.</strong> The architecture is already
                    multi-site; adding a new stand is one YAML entry and a sync.
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--alt" id="try">
          <div className="container">
            <span className="eyebrow">Hands on</span>
            <h2>Try it out yourself</h2>
            <p className="lead">
              The app is up and running. Open it in your browser, or sideload the APK on
              your Android phone — the live counts on this page come from the same backend.
            </p>
            <div className="try-ctas">
              <a className="btn" href="https://app.slotinvaders.ch">
                <svg
                  className="btn-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18" />
                  <path d="M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z" />
                </svg>
                Open the web app
              </a>
              <a className="btn" href="/Slot_Invaders_v1.2.apk" download>
                <svg
                  className="btn-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Download APK
              </a>
            </div>
            <p className="try-note">
              App Store and Play Store coming soon — we did submit the builds, but they
              haven&rsquo;t been approved in time 🙃
            </p>
          </div>
        </section>

        <section className="section" id="team">
          <div className="container">
            <span className="eyebrow">The team</span>
            <h2>The Booligans</h2>
            <p className="lead">Seven people, 48 hours, one working stack.</p>

            <div className="team-grid">
              {team.map((name) => (
                <div key={name} className="team-card">
                  <span className="dot" aria-hidden="true" />
                  <span className="name">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-row">
            <Wordmark />
            <div className="footer-links">
              <a href="https://github.com/The-Booligans/slotinvaders">GitHub</a>
              <a href="https://opensource.org/licenses/MIT">License (MIT)</a>
              <a href="https://baselhack.ch">BaselHack 2026</a>
            </div>
          </div>
          <div className="footer-micro">
            Built in 48 hours at BaselHack 2026 by The Booligans. MIT licensed.
          </div>
        </div>
      </footer>
    </>
  );
}
