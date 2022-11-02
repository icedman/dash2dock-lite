function apply_ease(animateIcons) {
  for (let i = 0; i < animateIcons.length; i++) {
    let c = animateIcons[i];
    let l = animateIcons[i - 1] || c;
    let r = animateIcons[i + 1] || c;
    c._pos2 = [...c._pos];

    if (i != 0 && i != animateIcons.length - 1) {
      c._pos2[0] = (l._pos[0] + c._pos[0] * 3 + r._pos[0]) / 5;
    }
    c._pos2[1] = (l._pos[1] + c._pos[1] * 3 + r._pos[1]) / 5;
  }
  for (let i = 0; i < animateIcons.length; i++) {
    animateIcons[i]._pos = animateIcons[i]._pos2;
  }
}

var Animation = (animateIcons, pointer, container, settings) => {
  let dash = container.dash;
  let [px, py] = pointer;
  let first = animateIcons[0]._pos || [0, 0];
  let last = animateIcons[animateIcons.length - 1]._pos || [0, 0];
  let nsz = (settings.iconSize + 16) * settings.scaleFactor;
  let sz = nsz * (4 + 2 * settings.animation_spread);
  let sz_push = nsz * 2;
  let center = [px, first[1]];
  let center_push = [px, first[1] + sz_push * 0.5];

  if (settings._vertical) {
    center = [first[0], py];
    center_push = [first[0] - sz_push * 0.5, py];
  }

  animateIcons.forEach((i) => {
    i._d = nsz;
    let cr = sz / 2;
    let p = i._pos;
    if (!p) return;

    // magnify
    let dx = p[0] - center[0];
    let dst = Math.sqrt(dx * dx); // expensive
    if (dst < sz / 2) {
      let magnify = (cr - dst) / cr / 2;
      i._d *= 1 + magnify * settings.animation_magnify;
      i._targetScale = i._d / nsz;
    }

    // collide
    let dxp = p[0] - center_push[0];
    let dyp = p[1] - center_push[1];
    let dstp = Math.sqrt(dxp * dxp + dyp * dyp); // expensive
    let pr = (nsz * i._targetScale) / 2;
    if (dstp < sz_push / 2 + pr) {
      p[0] = center_push[0] + (dxp / dstp) * (sz_push / 2 + pr);
    }

    // rise
    p[1] -= (i._d - nsz) * settings.animation_rise;
  });

  // spread
  let pad =
    settings.iconSize *
    4 *
    settings.scaleFactor *
    (settings.animation_spread / 2);
  container._targetScale = (dash.width + pad) / dash.width;

  apply_ease(animateIcons);

  let debugDraw = [];
  debugDraw = animateIcons.map((i) => ({
    t: 'circle',
    x: i._pos[0],
    y: i._pos[1],
    d: i._d,
    c: [1, 0, 0, 1],
  }));

  debugDraw.push({
    t: 'circle',
    x: center[0],
    y: center[1],
    d: sz,
    c: [1, 1, 0, 1],
  });

  debugDraw.push({
    t: 'line',
    x: first[0],
    y: first[1],
    x2: last[1],
    y2: last[1],
    c: [1, 0, 1, 1],
  });

  return {
    first,
    last,
    debugDraw,
  };
};
