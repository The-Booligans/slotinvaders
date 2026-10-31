// Where each area sits on the 3D campus map (campus metres, +x east /
// +y north). The app shows areas, not stands, so one point per area. The
// backend has no positions yet (stands.yaml `location` is a TODO), so these
// are taken from the stand points marked in @slotinvaders/campus-map
// (`campus.json#stands`). Fix them here once the real spots are confirmed.
// An area missing here is listed without a pin.

export const AREA_POSITIONS: Record<string, [number, number]> = {
  "flow-main": [13.5, -97.4],
  sternenhof: [-112.6, 112.3],
  "flow-garage-south": [-0.5, -109.4],
  "flow-sw": [38.7, -145.3],
  "flow-se": [79.6, -145.1],
  "flow-garage-north": [-16.4, 28.9],
};
