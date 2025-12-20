'use strict';

/*
t - current time
b - beginning value
c - change in value
d - duration
*/

//----------------------
/* PennerEasing */
//----------------------
export const Linear = {
  easeNone: (t, b, c, d) => {
    return (c * t) / d + b;
  },
  easeIn: (t, b, c, d) => {
    return (c * t) / d + b;
  },
  easeOut: (t, b, c, d) => {
    return (c * t) / d + b;
  },
  easeInOut: (t, b, c, d) => {
    return (c * t) / d + b;
  },
};

export const Bounce = {
  easeIn: (t, b, c, d) => {
    return c - Bounce.easeOut(d - t, 0, c, d) + b;
  },

  easeOut: (t, b, c, d) => {
    if ((t /= d) < 1 / 2.75) {
      return c * (7.5625 * t * t) + b;
    } else if (t < 2 / 2.75) {
      let postFix = (t -= 1.5 / 2.75);
      return c * (7.5625 * postFix * t + 0.75) + b;
    } else if (t < 2.5 / 2.75) {
      let postFix = (t -= 2.25 / 2.75);
      return c * (7.5625 * postFix * t + 0.9375) + b;
    } else {
      let postFix = (t -= 2.625 / 2.75);
      return c * (7.5625 * postFix * t + 0.984375) + b;
    }
  },

  easeInOut: (t, b, c, d) => {
    if (t < d / 2) return Bounce.easeIn(t * 2, 0, c, d) * 0.5 + b;
    else return Bounce.easeOut(t * 2 - d, 0, c, d) * 0.5 + c * 0.5 + b;
  },
};

var Back = {
  easeIn: (t, b, c, d) => {
    let s = 1.70158;
    let postFix = (t /= d);
    return c * postFix * t * ((s + 1) * t - s) + b;
  },

  easeOut: (t, b, c, d) => {
    let s = 1.70158;
    return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
  },

  easeInOut: (t, b, c, d) => {
    let s = 1.70158;
    if ((t /= d / 2) < 1)
      return (c / 2) * (t * t * (((s *= 1.525) + 1) * t - s)) + b;
    let postFix = (t -= 2);
    return (c / 2) * (postFix * t * (((s *= 1.525) + 1) * t + s) + 2) + b;
  },
};

//----------------------
/* AHEasing */
//----------------------

// constants
const MPI = Math.PI;
const MPI_2 = Math.PI / 2;
const MPI_4 = Math.PI / 4;

// helpers (optional, mirrors C macros)
const MABS = Math.abs;
const MMIN = Math.min;
const MMAX = Math.max;
const MSQRT = Math.sqrt;
const MSIN = Math.sin;
const MCOS = Math.cos;
const MACOS = Math.acos;
const MTAN = Math.tan;
const MATAN2 = Math.atan2;
const MPOW = Math.pow;
const MFLOOR = Math.floor;
const MCEIL = Math.ceil;
const MROUND = Math.round;

// Linear
function LinearInterpolation(p) {
  return p;
}

// Quadratic
export const QuadraticEaseIn = function (p) {
  return p * p;
};

export const QuadraticEaseOut = function (p) {
  return -(p * (p - 2));
};

export const QuadraticEaseInOut = function (p) {
  if (p < 0.5) {
    return 2 * p * p;
  } else {
    return -2 * p * p + 4 * p - 1;
  }
};

// Cubic
export const CubicEaseIn = function (p) {
  return p * p * p;
};

export const CubicEaseOut = function (p) {
  const f = p - 1;
  return f * f * f + 1;
};

export const CubicEaseInOut = function (p) {
  if (p < 0.5) {
    return 4 * p * p * p;
  } else {
    const f = 2 * p - 2;
    return 0.5 * f * f * f + 1;
  }
};

// Quartic
function QuarticEaseIn(p) {
  return p * p * p * p;
}

function QuarticEaseOut(p) {
  const f = p - 1;
  return f * f * f * (1 - p) + 1;
}

function QuarticEaseInOut(p) {
  if (p < 0.5) {
    return 8 * p * p * p * p;
  } else {
    const f = p - 1;
    return -8 * f * f * f * f + 1;
  }
}

// Quintic
function QuinticEaseIn(p) {
  return p * p * p * p * p;
}

function QuinticEaseOut(p) {
  const f = p - 1;
  return f * f * f * f * f + 1;
}

function QuinticEaseInOut(p) {
  if (p < 0.5) {
    return 16 * p * p * p * p * p;
  } else {
    const f = 2 * p - 2;
    return 0.5 * f * f * f * f * f + 1;
  }
}

// Sine
function SineEaseIn(p) {
  return Math.sin((p - 1) * MPI_2) + 1;
}

function SineEaseOut(p) {
  return Math.sin(p * MPI_2);
}

function SineEaseInOut(p) {
  return 0.5 * (1 - Math.cos(p * MPI));
}

// Circular
function CircularEaseIn(p) {
  return 1 - Math.sqrt(1 - p * p);
}

function CircularEaseOut(p) {
  return Math.sqrt((2 - p) * p);
}

function CircularEaseInOut(p) {
  if (p < 0.5) {
    return 0.5 * (1 - Math.sqrt(1 - 4 * (p * p)));
  } else {
    return 0.5 * (Math.sqrt(-(2 * p - 3) * (2 * p - 1)) + 1);
  }
}

// Exponential
function ExponentialEaseIn(p) {
  return p === 0 ? p : Math.pow(2, 10 * (p - 1));
}

function ExponentialEaseOut(p) {
  return p === 1 ? p : 1 - Math.pow(2, -10 * p);
}

function ExponentialEaseInOut(p) {
  if (p === 0 || p === 1) return p;

  if (p < 0.5) {
    return 0.5 * Math.pow(2, 20 * p - 10);
  } else {
    return -0.5 * Math.pow(2, -20 * p + 10) + 1;
  }
}

// Elastic
function ElasticEaseIn(p) {
  return Math.sin(13 * MPI_2 * p) * Math.pow(2, 10 * (p - 1));
}

function ElasticEaseOut(p) {
  return Math.sin(-13 * MPI_2 * (p + 1)) * Math.pow(2, -10 * p) + 1;
}

function ElasticEaseInOut(p) {
  if (p < 0.5) {
    return 0.5 * Math.sin(13 * MPI_2 * (2 * p)) * Math.pow(2, 10 * (2 * p - 1));
  } else {
    return (
      0.5 *
      (Math.sin(-13 * MPI_2 * (2 * p - 1 + 1)) *
        Math.pow(2, -10 * (2 * p - 1)) +
        2)
    );
  }
}

// Back
function BackEaseIn(p) {
  return p * p * p - p * Math.sin(p * MPI);
}

function BackEaseOut(p) {
  const f = 1 - p;
  return 1 - (f * f * f - f * Math.sin(f * MPI));
}

function BackEaseInOut(p) {
  if (p < 0.5) {
    const f = 2 * p;
    return 0.5 * (f * f * f - f * Math.sin(f * MPI));
  } else {
    const f = 1 - (2 * p - 1);
    return 0.5 * (1 - (f * f * f - f * Math.sin(f * MPI))) + 0.5;
  }
}

// Bounce
export const BounceEaseIn = function (p) {
  return 1 - BounceEaseOut(1 - p);
};

export const BounceEaseOut = function (p) {
  if (p < 4 / 11) {
    return (121 * p * p) / 16;
  } else if (p < 8 / 11) {
    return (363 / 40) * p * p - (99 / 10) * p + 17 / 5;
  } else if (p < 9 / 10) {
    return (4356 / 361) * p * p - (35442 / 1805) * p + 16061 / 1805;
  } else {
    return (54 / 5) * p * p - (513 / 25) * p + 268 / 25;
  }
};

export const BounceEaseInOut = function (p) {
  if (p < 0.5) {
    return 0.5 * BounceEaseIn(p * 2);
  } else {
    return 0.5 * BounceEaseOut(p * 2 - 1) + 0.5;
  }
};
