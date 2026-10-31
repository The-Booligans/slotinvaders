import numpy as np
import pytest

from gap_logic import Config, RackTracker, calibrate, count_free, runs, to_xz
from simulation import RACK_BAR, make_tracker, person, scene, simulate_scan

CFG = Config()
BIKE = (-1.45, -0.90, 1.05)          # handlebar seen from above, at the row start
FOLDED_SCOOTER = (-1.45, -1.15, 0.50)


def run(tracker, scene_at, start, end):
    """Feed one simulated scan per second from start to end (inclusive)."""
    result = None
    for t in range(start, end + 1):
        result = tracker.update(*simulate_scan(scene_at(t), CFG, seed=t), t)
    return result


@pytest.fixture
def tracker():
    background = calibrate([simulate_scan([RACK_BAR], CFG, seed=s) for s in range(10)], CFG)
    return RackTracker(CFG, background)


# --- geometry ---------------------------------------------------------------

def test_beam_straight_down_hits_floor_below_lidar():
    x, z = to_xz([0.0], [2300.0], [15], CFG)
    assert x[0] == pytest.approx(0.0)
    assert z[0] == pytest.approx(0.0)


def test_upward_beams_and_invalid_returns_are_dropped():
    x, _ = to_xz([180.0, 10.0, 20.0], [1000.0, 0.0, 2000.0], [15, 15, 0], CFG)
    assert x.size == 0


def test_runs_turns_consecutive_bins_into_metres():
    mask = np.zeros(CFG.n_bins, bool)
    mask[2:5] = True
    lo, hi = runs(mask, CFG)[0]
    assert (lo, hi) == pytest.approx((-1.3, -1.0))


# --- counting ---------------------------------------------------------------

def test_empty_row_holds_capacity():
    assert count_free([], CFG) == CFG.capacity == 5


def test_narrow_object_still_reserves_one_bike_width():
    assert count_free([(-0.02, 0.02)], CFG) == 4


def test_wide_object_reserves_its_own_width():
    assert count_free([(-1.5, -0.5)], CFG) == 3


def test_parking_in_the_middle_of_a_gap_wastes_space():
    assert count_free([(-0.5, 0.5)], CFG) == 2


# --- tracker over time ------------------------------------------------------

def test_empty_rack_reports_everything_free(tracker):
    result = run(tracker, lambda t: [RACK_BAR], 0, 30)
    assert result == {"free": 5, "being_taken": 0, "occupied": 0, "persons": 0}


def test_new_bike_is_taken_at_once_and_confirmed_after_stable_time(tracker):
    early = run(tracker, lambda t: [RACK_BAR, BIKE], 0, 5)
    assert (early["free"], early["being_taken"]) == (4, 1)
    late = run(tracker, lambda t: [RACK_BAR, BIKE], 6, 70)
    assert (late["free"], late["being_taken"], late["occupied"]) == (4, 0, 1)


def test_folded_scooter_below_bike_height_is_detected(tracker):
    result = run(tracker, lambda t: [RACK_BAR, FOLDED_SCOOTER], 0, 70)
    assert (result["free"], result["occupied"]) == (4, 1)


def test_passerby_reserves_nothing(tracker):
    def walking(t):
        return [RACK_BAR] + person(-1.5 + 3.0 * t / 10)
    for t in range(0, 11):
        result = tracker.update(*simulate_scan(walking(t), CFG, seed=t), t)
        assert result["being_taken"] == 0
    assert run(tracker, lambda t: [RACK_BAR], 11, 20)["free"] == 5


def test_person_waiting_on_a_free_spot_marks_it_as_being_taken(tracker):
    standing = lambda t: [RACK_BAR] + person(-0.6)
    assert run(tracker, standing, 0, 5)["being_taken"] == 0
    result = run(tracker, standing, 6, 15)
    assert (result["persons"], result["being_taken"]) == (1, 1)


def test_claim_expires_when_the_person_leaves_without_parking(tracker):
    run(tracker, lambda t: [RACK_BAR] + person(-0.6), 0, 20)
    result = run(tracker, lambda t: [RACK_BAR], 21, 100)
    assert (result["free"], result["being_taken"]) == (5, 0)


def test_tall_parked_vehicle_stops_counting_as_a_person():
    scooter = [(0.65, 1.35, 0.85), (0.75, 1.15, 1.55)]  # seat and windshield
    tracker = make_tracker(CFG)
    early = run(tracker, lambda t: [RACK_BAR] + scooter, 0, 30)
    assert early["persons"] == 1
    late = run(tracker, lambda t: [RACK_BAR] + scooter, 31, 260)
    assert (late["persons"], late["being_taken"]) == (0, 0)
    assert late["free"] == 3


def test_rush_hour_ends_with_one_free_place():
    tracker = make_tracker(CFG)
    result = run(tracker, scene, 0, 420)
    assert result == {"free": 1, "being_taken": 0, "occupied": 4, "persons": 0}
