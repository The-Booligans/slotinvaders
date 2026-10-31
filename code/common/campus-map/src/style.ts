/**
 * One look: a saturated, sunny palette on a floating hex island.
 *
 * Keep everything that drives colour and camera here so the rest of the code
 * reads like layout. Changing a value here changes the whole scene.
 */

export const STYLE = {
  sky: '#5CC2F2',
  sun: { pos: [160, 260, 200] as [number, number, number], intensity: 2.6, colour: '#FFF9EC' },
  ambient: 0.62,
  hemi: ['#BFE8FF', '#7FB24E', 1.3] as [string, string, number],
  rim: { pos: [-220, 140, -180] as [number, number, number], intensity: 0.5, colour: '#52ADE2' },

  grass: '#5FC14E',
  grassAlt: '#6FD15E',
  pavement: '#F3E2BC',
  road: '#C9A471',
  roadMinor: '#DDBE8C',
  parking: '#E0CC9E',

  wall: '#FFF6E4',
  roof: '#A8005C',
  ehWall: '#52ADE2',
  ehRoof: '#2B7EB5',
  pv: '#1E5C84',

  treeTop: '#3FA535',
  treeTrunk: '#8A5A2B',

  island: { side: '#A98F6B', base: '#CFE3EF', radius: 330 },

  camera: {
    dir: [0.371, 0.647, 0.667] as [number, number, number],
    fit: 0.82,
    fov: 36,
    maxPolar: 1.35,
  },
};

/**
 * E+H anchor points — buildings sitting within 25 m of one of these, or inside
 * the two property zones, are painted in the brand blue. Coordinates in metres,
 * measured from the campus origin.
 */
export const EH_ANCHORS: [number, number][] = [
  [69.4, 114.5],
  [20.5, 18.9],
  [-115.7, -147.8],
];
