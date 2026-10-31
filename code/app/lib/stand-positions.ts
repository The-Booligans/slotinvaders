// Where each API stand sits on the 3D campus map (campus metres, +x east /
// +y north). The backend has no positions yet (stands.yaml `location` is a
// TODO), so these are approximate: most reuse the stand points marked in
// @slotinvaders/campus-map, matched by zone and kind. Fix them here once the
// real spots are confirmed. A stand missing here is listed without a pin.

export const STAND_POSITIONS: Record<string, [number, number]> = {
  // north zone, Kägenstrasse 2 (campus point "flow-garage-north")
  "kaegen-hof-1": [-16.4, 28.9],
  // south zone, Christoph Merian-Ring 4
  "velo-ds-1": [13.5, -97.4], // campus point "flow-main"
  "velo-flow-1": [-0.5, -109.4], // campus point "flow-garage-south"
  "flow-west-1": [-15, -40], // west edge of the south zone
  "cmr-sued-1": [38.7, -145.3], // campus point "flow-south-west"
  "cmr-ost-1": [79.6, -145.1], // campus point "flow-south-east"
};
