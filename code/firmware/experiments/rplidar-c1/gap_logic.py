"""Gap logic for an overhead RPLidar C1 (vertical scan plane along the rack row), v2.

Pipeline for every rotation of the lidar:
  1. polar -> (x, z)        x = position along the row, z = height above ground
  2. bin the row            10 cm bins; per bin a robust top height, or "unobserved"
  3. compare to background  background = profile of the empty rack (floor, rack bars)
  4. classify each bin      free / occupied / tall / unobserved (hidden behind something)
  5. tall: person or parked tall and unchanged for minutes = parked (scooter windshield)
  6. per-bin memory         a bin changes its state only after it looked the same for stable_s;
                            hidden bins and bins under a person keep their last known state
  7. "being taken"          a person staying on a free spot (claim_s), or a new object that is
                            not confirmed yet, removes that place from the free count at once
  8. count                  reserve >= one bike width per object, count bike widths in the gaps

The backend only accepts one integer per device (`occupied` in POST /v1/readings),
so summary() also returns occupied = capacity - free; places being taken count as
occupied there.

With the real sensor: calibrate() with scans of the empty rack, then feed every
rotation into RackTracker.update() (angles in degrees, distances in mm, quality),
e.g. from the `rplidarc1` library. Without hardware: `python simulation.py`.
"""
from dataclasses import dataclass

import numpy as np

FREE, OCC, NONE = 0, 1, -1


@dataclass
class Config:
    mount_height_m: float = 2.3    # lidar centre above ground (measure on site)
    angle_offset_deg: float = 0.0  # lidar angle that points straight down (calibrate)
    row_start_m: float = -1.5      # usable row, measured along x from the point below the lidar
    row_end_m: float = 1.5
    bin_m: float = 0.10            # width of one row section
    min_quality: int = 1           # drop invalid returns
    occ_above_bg_m: float = 0.10   # this much above the empty-rack profile = something is there
    tall_m: float = 1.40           # above this: a person, or a tall parked vehicle
    static_tall_s: float = 180     # tall and present this long = parked vehicle, not a person
    stable_s: float = 60           # a bin must look the same this long before its state changes
    claim_s: float = 10            # a person on a free spot this long = place is being taken
    claim_timeout_s: float = 120   # a claim is dropped this long after the person left
    tall_grace_s: float = 5        # brief gaps in a tall reading (edges, noise) do not reset it
    bike_width_m: float = 0.55     # space one parked bike needs
    margin_m: float = 0.05         # extra clearance on each side of an object

    @property
    def n_bins(self):
        return int(round((self.row_end_m - self.row_start_m) / self.bin_m))

    @property
    def capacity(self):
        """Bikes that fit into the watched part of the row when it is empty."""
        return int((self.row_end_m - self.row_start_m) / self.bike_width_m + 1e-6)


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def to_xz(angles_deg, dist_mm, quality, cfg):
    """Polar (angle, distance) -> Cartesian (x along row, z height above ground)."""
    a = np.radians(np.asarray(angles_deg, float) - cfg.angle_offset_deg)
    d = np.asarray(dist_mm, float) / 1000.0
    ok = (d > 0) & (np.asarray(quality) >= cfg.min_quality) & (np.cos(a) > 0)  # downward half only
    a, d = a[ok], d[ok]
    return d * np.sin(a), cfg.mount_height_m - d * np.cos(a)


def bin_heights(x, z, cfg):
    """Top height per row bin; NaN where the lidar sees nothing (hidden behind something)."""
    idx = np.floor((x - cfg.row_start_m) / cfg.bin_m).astype(int)
    keep = (idx >= 0) & (idx < cfg.n_bins)
    idx, z = idx[keep], z[keep]
    heights = np.full(cfg.n_bins, np.nan)
    for b in range(cfg.n_bins):
        zz = np.sort(z[idx == b])
        if zz.size:
            heights[b] = zz[-2] if zz.size >= 2 else zz[0]   # 2nd highest: robust to one outlier
    return heights


def calibrate(scans, cfg):
    """Empty-rack profile from a few scans: median top height per bin."""
    stack = np.array([bin_heights(*to_xz(*scan, cfg), cfg) for scan in scans])
    return np.nan_to_num(np.nanmedian(stack, axis=0), nan=0.0)


def runs(mask, cfg):
    """Consecutive True bins -> list of (start, end) in metres."""
    out, start = [], None
    for b, on in enumerate(list(mask) + [False]):
        if on and start is None:
            start = b
        elif not on and start is not None:
            out.append((cfg.row_start_m + start * cfg.bin_m, cfg.row_start_m + b * cfg.bin_m))
            start = None
    return out


def count_free(objects, cfg):
    """Reserve at least one bike width per object, then count bike widths in the gaps."""
    blocked = sorted((c - h, c + h) for c, h in
                     (((lo + hi) / 2, max(hi - lo, cfg.bike_width_m) / 2 + cfg.margin_m)
                      for lo, hi in objects))
    free, cursor = 0, cfg.row_start_m
    for lo, hi in blocked + [(cfg.row_end_m, cfg.row_end_m)]:
        if lo > cursor:
            free += int((min(lo, cfg.row_end_m) - cursor) / cfg.bike_width_m + 1e-6)
        cursor = max(cursor, hi)
    return free


# ---------------------------------------------------------------------------
# Per-bin memory
# ---------------------------------------------------------------------------

class RackTracker:
    def __init__(self, cfg, background):
        n = cfg.n_bins
        self.cfg, self.bg = cfg, background
        self.stable = np.full(n, FREE)          # confirmed state
        self.cand = np.full(n, NONE)            # state that is waiting for confirmation
        self.cand_since = np.zeros(n)
        self.tall_since = np.full(n, np.nan)
        self.tall_last = np.full(n, np.nan)
        self.person_since = np.full(n, np.nan)
        self.claimed = np.zeros(n, bool)        # "being taken" because a person stayed here
        self.claimed_at = np.full(n, np.nan)
        self.claim_free_since = np.full(n, np.nan)
        self.person_now = np.zeros(n, bool)

    def update(self, angles_deg, dist_mm, quality, t):
        c = self.cfg
        heights = bin_heights(*to_xz(angles_deg, dist_mm, quality, c), c)
        tall = np.nan_to_num(heights, nan=0.0) > c.tall_m

        # pass 1: how long has each bin been tall?
        for b in range(c.n_bins):
            if tall[b]:
                if np.isnan(self.tall_since[b]):
                    # the edge of an already known tall object inherits its age
                    neighbours = [self.tall_since[n] for n in (b - 1, b + 1)
                                  if 0 <= n < c.n_bins and not np.isnan(self.tall_since[n])]
                    self.tall_since[b] = min(neighbours, default=t)
                self.tall_last[b] = t
            elif not np.isnan(self.tall_last[b]) and t - self.tall_last[b] > c.tall_grace_s:
                self.tall_since[b] = self.tall_last[b] = np.nan
        recent = ~np.isnan(self.tall_since) & (t - np.nan_to_num(self.tall_since) < c.static_tall_s)
        self.person_now = tall & recent
        # arms, bags and the bike someone is pushing stick out next to the head and shoulders
        near_person = self.person_now | np.r_[False, self.person_now[:-1]] | np.r_[self.person_now[1:], False]

        # pass 2: update each bin
        for b, h in enumerate(heights):
            # claims expire some time after the person left, even if the spot stays hidden
            if self.claimed[b] and t - self.claimed_at[b] > c.claim_timeout_s:
                self.claimed[b] = False
            if not self.person_now[b]:
                self.person_since[b] = np.nan         # nobody standing here right now
            if np.isnan(h):
                continue                              # hidden: keep what we knew
            if self.person_now[b]:
                self._person(b, t)
                continue
            if near_person[b] or (recent[b] and not tall[b]):
                continue                              # next to a person, or one just left: wait
            if tall[b]:
                obs = OCC                             # tall for minutes = parked vehicle
            else:
                # hysteresis: once something is seen, it must clearly vanish to count as gone
                looks_occ = OCC in (self.stable[b], self.cand[b])
                limit = c.occ_above_bg_m / 2 if looks_occ else c.occ_above_bg_m
                obs = OCC if h - self.bg[b] > limit else FREE
            self._observe(b, obs, t)
        return self.summary()

    def _person(self, b, t):
        # a person hides what is below; the confirmation clock of that bin just pauses
        if np.isnan(self.person_since[b]):
            self.person_since[b] = t
        if self.stable[b] == FREE and t - self.person_since[b] >= self.cfg.claim_s:
            self.claimed[b] = True
            self.claimed_at[b] = t                    # refreshed while the person stays
            self.claim_free_since[b] = np.nan

    def _observe(self, b, obs, t):
        if obs == self.stable[b]:
            self.cand[b] = NONE
        elif obs != self.cand[b]:
            self.cand[b], self.cand_since[b] = obs, t
        elif t - self.cand_since[b] >= self.cfg.stable_s:
            self.stable[b], self.cand[b] = obs, NONE
        if self.claimed[b]:                           # a claim ends when the spot is confirmed
            if self.stable[b] == OCC:                 # taken, or confirmed free again
                self.claimed[b] = False
            elif obs == FREE:
                if np.isnan(self.claim_free_since[b]):
                    self.claim_free_since[b] = t
                if t - self.claim_free_since[b] >= self.cfg.stable_s:
                    self.claimed[b] = False
            else:
                self.claim_free_since[b] = np.nan

    def summary(self):
        occ = self.stable == OCC
        taking = (self.claimed | (self.cand == OCC)) & ~occ
        free_confirmed = count_free(runs(occ, self.cfg), self.cfg)
        free = count_free(runs(occ | taking, self.cfg), self.cfg)
        return {"free": free,
                "being_taken": free_confirmed - free,
                "occupied": self.cfg.capacity - free,
                "persons": len(runs(self.person_now, self.cfg))}
