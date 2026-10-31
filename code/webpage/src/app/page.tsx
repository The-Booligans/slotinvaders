import { CampusMapPanel } from "@/components/CampusMapPanel";
import { StandList } from "@/components/StandList";

const team = [
  "Dobrawa Kiefer",
  "Nila M.",
  "Artur Semenko",
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
        </div>
      </header>

      <main id="top">
        <section className="hero hero--map">
          <div className="hero-map" aria-hidden="true">
            <CampusMapPanel heroDesktop />
          </div>
          <div className="container hero-overlay">
            <div className="hero-copy hero-copy--card">
              <h1>Make finding a velo spot easy.</h1>
              <p className="lead">
                Live counts for every bike parking area on the Endress+Hauser Reinach campus —
                before you even leave your desk.
              </p>
              <div className="hero-ctas">
                <a className="btn" href="#stands">
                  See it live
                </a>
                <a className="link-cta" href="#features">
                  Learn how →
                </a>
              </div>
            </div>
          </div>
          <a className="scroll-cue" href="#stands" aria-label="Scroll to live counts">
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

        <section className="section" id="stands">
          <div className="container">
            <span className="eyebrow">Live counts</span>
            <h2>Every stand on the campus</h2>
            <p className="lead">
              Six stands, one in each parking area, 150 slots in total. Ten sensors keep the
              counts current as the day fills them.
            </p>
            <div className="stands-wrap">
              <StandList />
            </div>
          </div>
        </section>

        <section className="section section--alt" id="features">
          <div className="container">
            <span className="eyebrow">Three ways to use it</span>
            <h2>From a quick browser check to a bike you track</h2>
            <p className="lead">
              Everything works without an account. Signing in only adds the things an account
              enables.
            </p>

            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18" />
                    <path d="M12 3c2.5 2.6 4 6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-6-4-9s1.5-6.4 4-9z" />
                  </svg>
                </div>
                <h3>Just the info</h3>
                <p>
                  Open the page, see every stand&rsquo;s live occupancy. No account, no install,
                  nothing to configure.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="7" y="2.5" width="10" height="19" rx="2.4" />
                    <path d="M11 18.5h2" />
                    <circle cx="12" cy="7.5" r="1.4" />
                    <path d="M9.4 7.5a3.6 3.6 0 0 1 5.2 0" />
                    <path d="M7.6 7.5a6 6 0 0 1 8.8 0" />
                  </svg>
                </div>
                <h3>Remembers your bike</h3>
                <p>
                  Install the app on iOS or Android. A small iBeacon on every stand pings your
                  phone, and when you leave campus the app pins down exactly which rack your bike
                  is on — all on-device, no account, nothing uploaded.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="9" r="3.6" />
                    <path d="M4.5 20c1.5-3.6 4.4-5.4 7.5-5.4s6 1.8 7.5 5.4" />
                  </svg>
                </div>
                <h3>Rank up</h3>
                <p>
                  Sign in and the app starts counting. Days by bike. Kilometres on your bike and
                  e-bike. Earn badges for every three days in a row, every ride under −10°C — more
                  to come.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="device">
          <div className="container">
            <span className="eyebrow">The thing on the stand</span>
            <h2>LiDAR or on-device YOLO, on an ESP32</h2>
            <p className="lead">
              Ten small nodes on six stands. Each one counts on the board and sends a single
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
                    LiDAR — an RPLidar C1 sweeps the row by depth, day or night. 5 in use
                  </span>
                </li>
                <li className="bullet">
                  <span className="bullet__num">03</span>
                  <span className="bullet__text">
                    Camera — an AtomS3R-CAM runs YOLO11n locally; the frame stays in RAM. 5 in use
                  </span>
                </li>
                <li className="bullet">
                  <span className="bullet__num">04</span>
                  <span className="bullet__text">
                    Reports the count over Wi-Fi and HTTPS every few seconds
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
            <h2>Ten sensors → the cloud → every open client</h2>
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
                      10 ESP32 nodes
                    </text>
                    <text
                      x="110"
                      y="156"
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                      fontSize="11.5"
                      fill="#525E6B"
                    >
                      on 6 bike stands
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
                    WI-FI
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
                      Campus Wi-Fi
                    </text>
                    <text
                      x="340"
                      y="156"
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                      fontSize="11.5"
                      fill="#525E6B"
                    >
                      2.4 GHz · TLS
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
                Devices POST their count over Wi-Fi and HTTPS. Cosmos DB keeps the stand catalog,
                the latest count per device and 30 days of readings. Web PubSub pushes every
                stand&rsquo;s status to open clients every 10 seconds. See{" "}
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
