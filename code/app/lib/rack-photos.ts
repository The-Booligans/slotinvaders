// One onsite photo per rack, bundled from public/racks/<area id>.webp.
// An area missing here has no photo button or panel image.

const AREAS_WITH_PHOTO = [
  "flow-main",
  "sternenhof",
  "flow-garage-south",
  "flow-sw",
  "flow-se",
  "flow-garage-north",
];

export function rackPhotoUrl(areaId: string): string | null {
  return AREAS_WITH_PHOTO.includes(areaId) ? `/racks/${areaId}.webp` : null;
}
