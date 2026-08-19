const VIEWPORT_GAP = 8;
const ANCHOR_GAP = 8;

export interface MenuAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function placeMenuBesideAnchor(
  anchor: MenuAnchor,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const maxLeft = viewportWidth - width - VIEWPORT_GAP;
  const maxTop = viewportHeight - height - VIEWPORT_GAP;
  const centredLeft = clamp((anchor.left + anchor.right - width) / 2, VIEWPORT_GAP, maxLeft);
  const centredTop = clamp((anchor.top + anchor.bottom - height) / 2, VIEWPORT_GAP, maxTop);

  const candidates = [
    { left: anchor.right + ANCHOR_GAP, top: centredTop },
    { left: anchor.left - width - ANCHOR_GAP, top: centredTop },
    { left: centredLeft, top: anchor.bottom + ANCHOR_GAP },
    { left: centredLeft, top: anchor.top - height - ANCHOR_GAP },
  ];
  const fits = candidates.find(position =>
    position.left >= VIEWPORT_GAP
    && position.top >= VIEWPORT_GAP
    && position.left + width <= viewportWidth - VIEWPORT_GAP
    && position.top + height <= viewportHeight - VIEWPORT_GAP
  );
  if (fits) return fits;

  // Extremely small viewports may fit neither axis. Keep the box usable and
  // bias it toward the side with the most room rather than docking it.
  const fallback = viewportWidth - anchor.right >= anchor.left
    ? candidates[0]
    : candidates[1];
  return {
    left: clamp(fallback.left, VIEWPORT_GAP, maxLeft),
    top: clamp(fallback.top, VIEWPORT_GAP, maxTop),
  };
}
