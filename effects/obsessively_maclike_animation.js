function distribute_icons(icons) {
  if (icons.length < 2) return;

  // collide
  for (let i = 0; i < icons.length - 1; i++) {
    let dw = icons[i]._d / 2 + icons[i + 1]._d / 2;
    let dx = icons[i + 1]._pos[0] - icons[i]._pos[0];
    if (icons[i + 1]._pos[0] < icons[i]._pos[0]) {
      icons[i + 1]._pos2[0] = icons[i]._pos2[0] - dw;
    } else {
      icons[i + 1]._pos2[0] = icons[i]._pos2[0] + dw;
    }

    // icons[i + 1]._pos2[0] += icons[i + 1]._pos[0];
    // icons[i + 1]._pos2[0] /= 2;
  }
}

var Animation = (animateIcons, pointer, container, settings) => {
  let dash = container.dash;
  let [px, py] = pointer;
  let first = animateIcons[0]._pos || [0, 0];
  let second = animateIcons[1]._pos || [0, 0];
  let last = animateIcons[animateIcons.length - 1]._pos || [0, 0];
  let nsz = second[0] - first[0];

  let sz = nsz * (4 + 2 * settings.animation_spread);
  let szr = sz / 2;
  let center = [px, first[1]];

  // spread
  let pad = 0;
  // settings.iconSize *
  // ((3*settings.animation_magnify)) *
  // settings.scaleFactor;
  // container._targetScale = (dash.width + pad) / dash.width;

  let leftIcons = [];
  let rightIcons = [];
  let leftFreeze = false;

  // compute diameter
  animateIcons.forEach((i) => {
    i._d = nsz;

    let dx = i._pos[0] - center[0];
    i._pos2 = [...i._pos];

    if (!leftFreeze) {
      leftIcons.push(i);
    }

    let dst = dx * dx;
    if (dst < szr * szr) {
      let dd = 1.0 - Math.abs(dx) / szr;
      i._d =
        nsz +
        nsz * 0.8 * settings.animation_magnify * settings.scaleFactor * dd;
      if (dst < nsz * nsz) {
        i._pos2[0] += (dx / 2) * (nsz / i._d);
        leftFreeze = true;
        rightIcons = [];
      }
    }

    rightIcons.push(i);
    i._targetScale = i._d / nsz;

    // rise
    i._pos2[1] -= (i._d - nsz) * settings.animation_rise;
  });

  distribute_icons(leftIcons.reverse());
  distribute_icons(rightIcons);

  // commit
  animateIcons.forEach((i) => {
    i._pos = i._pos2;
  });

  let debugDraw = [];
  debugDraw = animateIcons.map((i) => ({
    t: 'circle',
    x: i._pos[0],
    y: i._pos[1],
    d: i._d,
    c: [1, 0, 0, 1],
  }));

  // debugDraw = debugDraw.splice(0,2);

  debugDraw.push({
    t: 'circle',
    x: center[0],
    y: center[1],
    d: sz,
    c: [1, 1, 0, 1],
  });

  // debugDraw.push({
  //   t: 'line',
  //   x: first[0],
  //   y: first[1],
  //   x2: last[1],
  //   y2: last[1],
  //   c: [1, 0, 1, 1],
  // });

  return {
    first,
    last,
    debugDraw,
  };
};
