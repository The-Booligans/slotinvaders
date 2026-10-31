// Where each API stand sits on the 3D campus map (campus metres, +x east /
// +y north). The backend has no positions yet (stands.yaml `location` is a
// TODO), so these are taken from the stand points marked in
// @slotinvaders/campus-map (`campus.json#stands`). Fix them here once the
// real spots are confirmed. A stand missing here is listed without a pin.

export const STAND_POSITIONS: Record<string, [number, number]> = {
  "flow-main-1": [13.5, -97.4],
  "sternenhof-1": [-112.6, 112.3],
  "flow-garage-south-1": [-0.5, -109.4],
  "flow-sw-1": [38.7, -145.3],
  "flow-se-1": [79.6, -145.1],
  "flow-garage-north-1": [-16.4, 28.9],
};
