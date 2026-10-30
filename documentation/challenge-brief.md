# Challenge brief — "Find my Bike Slot" (Endress+Hauser)

Source: https://www.baselhack.ch/challenges/placeholder-endress-hauser (posted 09.09.2026)

## The question

> "How might we help employees quickly find an available bicycle parking slot at our
> company site?"

Employees struggle to locate free parking before arriving; bicycle areas frequently
become crowded with no visibility into availability.

## Goal

Creative **digital, physical, or hybrid** solutions that make bicycle parking "more
convenient, efficient, and transparent."

## Who it's for

Bicycle commuters; and (as hackers) people interested in **machine learning, computer
vision, or embedded programming**.

## Must-haves

**None specified** — teams have explicit creative freedom to deviate from the initial
concept.

## Nice-to-haves

- Real-time or estimated slot availability
- Directions to available parking
- Mobile or web interface
- Privacy-friendly design
- Working prototype with sensors

## No-gos (hard constraints)

- **Storing faces, license plates or other personal data**
- **Identifying or tracking individual persons**

→ This is a privacy-by-design challenge. Any camera pipeline must reduce frames to
occupancy signals and discard the imagery; that story needs to be demonstrable, not
just asserted.

## Provided resources

- **10× ESP32 cameras with boards**
- Reference images of parking slots
- Option to use nearby bicycle parking facilities (for real-world testing)

## Contact

Verein BaselHack, Postfach, 4000 Basel

## Open questions for the challenge owner (Friday)

- Site layout: how many bike areas, how many slots each, indoor/outdoor, lighting at night?
- Power and Wi-Fi availability where cameras would mount? Guest network / captive portal?
- Mounting height and viewing angles available — top-down, oblique?
- Is there an existing employee app / intranet the UI should live in (SSO)?
- Which ESP32-CAM variant exactly (AI-Thinker? ESP32-S3?) and what tooling do they expect?
- Does "no personal data" also rule out _storing_ raw frames server-side transiently?
- Winter/rain: do they need weatherproofing considered in the concept?
- Scale ambition: one pilot area, or a design that generalises across sites?

## Campus facts (Reinach)

From E+H's own newsroom and site pages:

- The 2022 building is **~150 m long** and adds **25,000 m²** of floor space
  (19,000 m³ of concrete, 2,200 t of rebar).
- It houses **Endress+Hauser Flow** (flow measurement centre) and
  **Endress+Hauser Digital Solutions**.
- The Reinach site employs **over 2,000 people**; ~1,050 moved between buildings during
  the expansion, and headcount grew 20% over five years.
- Rooftop PV on the new building: **365 kWp**; the whole site about **1 MWp**.
- Waste-heat recovery via a stratified thermal store; target is to heat two-thirds of
  buildings from recovered heat by 2030.
- Two beehives and pollinator planting on site.
- A visitor centre with the 2,000 m² "Flow Experience" exhibition, ~4,000 visitors/year.

Why this matters for the pitch: **sustainability and social relevance are two of the six
judging criteria**, and E+H already frames the site in those terms. Bicycle commuting
ties directly into their own decarbonisation narrative — that connection is worth making
explicitly rather than pitching a pure sensor demo.

## Site layout as currently understood

Digitised from `campus/overview.png` (see `apps/lab/README.md` for the method).
Two E+H property zones:

- **North zone** — Kägenstrasse 2, between Bruggstrasse and Sternenhofstrasse.
  E+H (Schweiz) AG and E+H International AG. ~200 × 356 m.
- **South zone** — Christoph Merian-Ring 4, the big Flowtec / Digital Solutions campus.
  ~500 × 600 m.

Six bicycle parking areas:

| Area                          | Type           | Approx. size | Capacity |
| ----------------------------- | -------------- | ------------ | -------- |
| Kägenstrasse 2 – Hof          | open rack      | 72 × 42 m    | ?        |
| Flowtec – West                | open rack      | 55 × 64 m    | ?        |
| Christoph Merian-Ring – Ost   | open rack      | 35 × 24 m    | ?        |
| Christoph Merian-Ring – Süd   | open rack      | 37 × 27 m    | ?        |
| Veloparking Digital Solutions | covered garage | 78 × 46 m    | ?        |
| Veloparking Flowtec           | covered garage | 36 × 41 m    | ?        |

**Every capacity is unknown** — the numbers in the prototype are placeholders. Getting
real capacities is the single highest-value question to ask on Friday: the whole UI is
built on "x of y free".

Note that ten cameras across six areas is tight for the two large open racks — expect to
need either several cameras per area or a wide-angle mount. Worth checking sightlines
on site before committing to a layout.
