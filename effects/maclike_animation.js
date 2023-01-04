function gen_frames(settings) {
  let {
    iconsCount,
    iconSize,
    iconSpacing,
    scaleFactor,
    pointer,
    width,
    height,
    dashWidth,
    debugDraw,
  } = settings;

  let frames = [];
  for (let i = 0; i < iconsCount; i++) {
    frames.push({
      idx: i,
      x: 0,
      y: 0,
      l: iconSpacing,
      r: 0,
      p: 1,
    });
  }

  function total_length() {
    let tl = 0;
    frames.forEach((f) => {
      tl += f.l;
    });
    return tl;
  }

  function reposition() {
    let tl = total_length();
    let r1 = dashWidth / 2 - tl / 2;
    frames.forEach((f) => {
      f.r = r1;
      r1 += f.l;
    });
  }

  reposition();

  if (pointer) {
    let left = [];
    let center = [];
    let right = [];

    let thresh = iconSpacing * 3.5;
    let thresh2 = thresh / 2;
    let cx = pointer[0];
    let cy = pointer[1];

    let doLeft = true;
    let doRight = false;
    let totalP = 0;

    let pp = cx;
    if (settings.vertical) {
      pp = cy;
    }

    frames.forEach((f) => {
      let ir = f.r + f.l / 2;
      let dr = ir - pp;
      dr = Math.sqrt(dr * dr);
      f.p = 1;
      f._p = 1;
      if (dr < thresh2) {
        f.in = true;
        let p = 1 - dr / thresh2;
        f.p = 1 + p * 0.7;
        f._p = 1 + (0.5 + settings.animation_magnify * 0.6) * p;
        totalP += f.p;
        doLeft = false;
        center.push(f);
      } else {
        if (!doLeft) {
          doRight = true;
        }
      }
      if (doLeft) {
        left.push(f);
      }
      if (doRight) {
        right.push(f);
      }
    });

    if (totalP > 0) {
      let tw = (iconsCount + 1) * iconSpacing;
      let r1 = dashWidth / 2 - tw / 2;
      let leftX = r1;
      left.forEach((f) => {
        f.r = r1;
        r1 += f.l;
        leftX = r1;
      });
      r1 = dashWidth / 2 + tw / 2 - right.length * iconSpacing;
      right.forEach((f) => {
        f.r = r1;
        r1 += f.l;
      });
      let rightX =
        leftX + (iconsCount - left.length - right.length + 1) * iconSpacing;
      let area = rightX - leftX;

      let usedArea = 0;
      center.forEach((f) => {
        f.r = leftX;
        f.l = Math.floor(area * (f.p / totalP));
        leftX += f.l;
        usedArea += f.l;
      });

      let diff = area - usedArea;
      center[0].l += diff;
    }

    if (settings.vertical) {
      debugDraw.push({
        t: 'circle',
        x: settings.x + iconSize / 2,
        y: settings.y + cy,
        d: thresh,
        c: [1, 1, 0, 1],
      });
    } else {
      debugDraw.push({
        t: 'circle',
        x: settings.x + cx,
        y: settings.y + iconSize / 2,
        d: thresh,
        c: [1, 1, 0, 1],
      });
    }
  }

  frames.forEach((f) => {
    f.l = Math.floor(f.l);
  });

  return frames;
}

var Animation = (animateIcons, pointer, settings) => {
  if (!animateIcons.length) return;
  let _firstIcon = animateIcons[0];
  let _lastIcon = animateIcons[animateIcons.length - 1];
  let first = _firstIcon._pos || [0, 0];
  let last = _lastIcon._pos || [0, 0];

  let dashWidth = settings.width;
  if (settings.vertical) {
    dashWidth = settings.height;
  }

  // spread and magnify cap
  let spread = settings.animation_spread;
  let magnify = settings.animation_magnify;
  if (spread < 0.2) {
    magnify *= 0.8;
  }
  if (magnify > 0.5 && spread < 0.55) {
    spread = 0.55 + spread * 0.2;
  }
  let iconSpacing =
    settings.iconSpacing +
    settings.iconSpacing * (settings.vertical ? 0.1 : 0.2) * spread;

  // spacing cap
  if (
    iconSpacing * (settings.iconsCount + 1) >
    dashWidth / settings.scaleFactor
  ) {
    iconSpacing = dashWidth / settings.scaleFactor / (settings.iconsCount + 1);
  }

  let debugDraw = [];
  let frames = gen_frames({
    ...settings,
    dashWidth,
    iconSpacing: Math.floor(iconSpacing * settings.scaleFactor),
    pointer: [
      settings.pointer[0] - settings.x,
      settings.pointer[1] - settings.y,
    ],
    iconsCount: settings.iconsCount + 2,
    debugDraw,
  });
  let lastIdx = frames.length - 1;
  let padLeft = Math.floor(frames[0].l);
  let padRight = Math.floor(frames[lastIdx].l);
  frames = frames.filter((i) => {
    return i.idx != 0 && i.idx != lastIdx;
  });

  // todo.. vertical
  if (settings.vertical) {
    frames.forEach((i) => {
      debugDraw.push({
        t: 'circle',
        y: i.r + settings.y + i.l / 2,
        x:
          i.x +
          settings.x +
          settings.iconSize +
          (i.l - settings.iconSize) /
            (settings.dock_position == 'left' ? 2 : -2),
        d: i.l,
        c: [1, 0, 0, 1],
      });
    });
  } else {
    frames.forEach((i) => {
      debugDraw.push({
        t: 'circle',
        x: i.r + settings.x + i.l / 2,
        y: i.y + settings.y + settings.iconSize - (i.l - settings.iconSize) / 2,
        d: i.l,
        c: [1, 0, 0, 1],
      });
    });
  }

  let idx = 0;
  animateIcons.forEach((a) => {
    let f = frames[idx++];
    if (f && f.p > 1) {
      f.p *= 0.6 * (1 + magnify);

      // rise
      let sz = settings.iconSize * f.p - settings.iconSize;
      if (sz > 0) {
        if (settings.vertical) {
          if (settings.position == 'right') {
            a._pos[0] -= sz * 0.8 * settings.animation_rise;
          } else {
            a._pos[0] += sz * 0.8 * settings.animation_rise;
          }
        } else {
          a._pos[1] -= sz * 0.8 * settings.animation_rise;
        }
      }
    }
    a._targetScale = f._p;
    a._targetSpread = f.l;
  });

  return {
    first,
    last,
    padLeft,
    padRight,
    iconSpacing,
    debugDraw,
  };
};
