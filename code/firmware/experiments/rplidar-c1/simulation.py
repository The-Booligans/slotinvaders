"""Simulated rush hour for gap_logic.py, no hardware needed: `python simulation.py`.

A 2D ray caster: the scan plane is vertical, objects are horizontal segments
(x0, x1, height) as seen from above, plus the floor.
"""
import numpy as np

from gap_logic import Config, RackTracker, calibrate

def simulate_scan(segments, cfg, noise_mm=30, step_deg=0.5, seed=0):
    """Ray-cast a vertical scan plane against horizontal segments (x0, x1, z) plus the floor."""
    rng = np.random.default_rng(seed)
    angles = np.arange(0, 360, step_deg)
    dists = np.zeros_like(angles)
    for i, ang in enumerate(angles):
        a = np.radians(ang - cfg.angle_offset_deg)
        c, s = np.cos(a), np.sin(a)
        if c <= 0:
            continue
        best = cfg.mount_height_m / c                 # floor
        for x0, x1, zz in segments:
            t = (cfg.mount_height_m - zz) / c
            if x0 <= t * s <= x1 and t < best:
                best = t
        if best <= 12.0:
            dists[i] = best * 1000 + rng.normal(0, noise_mm)
    return angles, dists, np.where(dists > 0, 15, 0)


RACK_BAR = (-1.5, 1.5, 0.35)


def person(x):        # head, shoulders, torso, legs as seen by the scan plane
    return [(x - 0.10, x + 0.10, 1.75), (x - 0.25, x + 0.25, 1.45),
            (x - 0.18, x + 0.18, 1.15), (x - 0.15, x + 0.15, 0.70)]


def path(t, keys):
    """Position at time t along (time, x) waypoints, None outside them."""
    ts = [k[0] for k in keys]
    if t < ts[0] or t > ts[-1]:
        return None
    return float(np.interp(t, ts, [k[1] for k in keys]))


PEOPLE = {
    "P1 parks a bike":     [(30, 1.5), (45, -1.1), (75, -1.1), (85, 1.5)],
    "P2 walks through":    [(60, -1.5), (70, 1.5)],
    "P3 parks a scooter":  [(90, 1.5), (100, -0.6), (130, -0.6), (140, 1.5)],
    "P4 walks through":    [(95, 1.5), (105, -1.5)],
    "rider leaves":        [(160, 1.1), (170, -1.5)],
}
EVENTS = {30: "P1 arrives", 45: "P1 stops at a free spot", 50: "P1's bike is in place",
          60: "P2 walks through", 75: "P1 leaves", 90: "P3 arrives",
          95: "P4 walks through", 105: "folded scooter is in place", 130: "P3 leaves",
          160: "motor scooter (tall windshield) parks, rider leaves"}


def scene(t):
    segments = [RACK_BAR]
    if t >= 50:
        segments.append((-1.40, -0.85, 1.05))                   # bike handlebar
    if t >= 105:
        segments.append((-0.75, -0.45, 0.50))                   # folded e-scooter
    if t >= 160:
        segments += [(0.65, 1.35, 0.85), (0.75, 1.15, 1.55)]    # motor scooter seat + windshield
    for keys in PEOPLE.values():
        x = path(t, keys)
        if x is not None:
            segments += person(x)
    return segments


def make_tracker(cfg):
    """Calibrate on the empty rack (scene at t=0) and return a fresh tracker."""
    background = calibrate([simulate_scan(scene(0), cfg, seed=s) for s in range(10)], cfg)
    return RackTracker(cfg, background)


def demo():
    cfg = Config()
    tracker = make_tracker(cfg)
    print("  t  | persons | free | being taken | occupied | event")
    for t in range(0, 421):
        result = tracker.update(*simulate_scan(scene(t), cfg, seed=t), t)
        if t >= 25 and (t % 15 == 0 or t in EVENTS):
            print(f"{t:4d} | {result['persons']:7d} | {result['free']:4d} | "
                  f"{result['being_taken']:11d} | {result['occupied']:8d} | {EVENTS.get(t, '')}")
    print("\nGround truth at the end: bike, folded scooter and motor scooter parked "
          "-> 1 place left in 3 m.")


if __name__ == "__main__":
    demo()
