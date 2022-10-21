// adapted from https://github.com/jderose9/dash-to-panel
// adapted from https://github.com/micheleg/dash-to-dock

const { Clutter, GObject, GLib, PangoCairo, Pango } = imports.gi;
const Cairo = imports.cairo;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Drawing = Me.imports.apps.drawing.Drawing;

let size = 400;

var xDot = GObject.registerClass(
  {
    Properties: {},
    Signals: {},
  },
  class xDot extends Clutter.Actor {
    _init(x) {
      super._init();

      if (x) size = x;

      this._canvas = new Clutter.Canvas();
      this._canvas.connect('draw', this.on_draw.bind(this));
      this._canvas.invalidate();
      this._canvas.set_size(size, size);
      this.set_size(size, size);
      this.set_content(this._canvas);
      this.reactive = false;

      this.state = {};

      this._padding = 8;
      this._barHeight = 6;
    }

    redraw() {
      this._canvas.invalidate();
    }

    set_state(s) {
      // count deep compare
      if (
        !this.state ||
        this.state.count != s.count ||
        this.state.color != s.color ||
        this.state.style != s.style
      ) {
        this.state = s;
        this.redraw();
      }
    }

    on_draw(canvas, ctx, width, height) {
      if (!this.state || !this.state.color || !this.state.count) return;

      const dot_color = this.state.color;

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      ctx.save();

      switch (this.state.style) {
        case 1:
          this._draw_dots(ctx, this.state);
          break;
        case 2:
          this._draw_dashes(ctx, this.state);
          break;
        case 3:
          this._draw_squares(ctx, this.state);
          break;
        case 4:
          this._draw_segmented(ctx, this.state);
          break;
        case 5:
          this._draw_solid(ctx, this.state);
          break;
        case 0: // default
        default:
          this._draw_default(ctx, this.state);
      }
      ctx.restore();

      ctx.$dispose();
    }

    destroy() {}

    _draw_segmented(ctx, state) {
      let height = this._barHeight;
      let width = size - this._padding * 2;
      ctx.translate(this._padding, size - height);

      let sz = width / 20;
      let spacing = Math.ceil(width / 18); // separation between the dots
      let dashLength = Math.ceil(
        (width - (state.count - 1) * spacing) / state.count
      );
      let lineLength =
        width - sz * (state.count - 1) - spacing * (state.count - 1);

      for (let i = 0; i < state.count; i++) {
        ctx.newSubPath();
        ctx.rectangle(i * dashLength + i * spacing, 0, dashLength, height);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, 1.0);
      ctx.fill();
    }

    _draw_solid(ctx, state) {
      let height = this._barHeight;
      let width = size - this._padding * 2;
      ctx.translate(this._padding, size - height);

      let sz = width / 20;

      ctx.newSubPath();
      ctx.rectangle(0, 0, size, sz);
      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, 1.0);
      ctx.fill();
    }

    _draw_dashes(ctx, state) {
      let height = this._barHeight;
      let width = size - this._padding * 2;

      let sz = width / 20;
      let spacing = Math.ceil(width / 18); // separation between the dots
      let dashLength = Math.floor(width / 4) - spacing;

      ctx.translate(
        Math.floor(
          (size - state.count * dashLength - (state.count - 1) * spacing) / 2
        ),
        size - height
      );

      for (let i = 0; i < state.count; i++) {
        ctx.newSubPath();
        ctx.rectangle(i * dashLength + i * spacing, 0, dashLength, sz);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, 1.0);
      ctx.fill();
    }

    _draw_squares(ctx, state) {
      let height = this._barHeight + 2;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 18); // separation between the dots
      let dashLength = height;

      ctx.translate(
        Math.floor(
          (size - state.count * dashLength - (state.count - 1) * spacing) / 2
        ),
        size - height
      );

      for (let i = 0; i < state.count; i++) {
        ctx.newSubPath();
        ctx.rectangle(i * dashLength + i * spacing, 0, dashLength, height);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, 1.0);
      ctx.fill();
    }

    _draw_dots(ctx, state) {
      let height = this._barHeight;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 18); // separation between the dots
      let radius = height;

      ctx.translate(
        Math.floor(
          (size - state.count * radius - (state.count - 1) * spacing) / 2
        ),
        size - height
      );

      for (let i = 0; i < state.count; i++) {
        ctx.newSubPath();
        ctx.arc(
          (2 * i + 1) * radius + i * radius,
          -radius,
          radius,
          0,
          2 * Math.PI
        );
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, 1.0);
      ctx.fill();
    }

    _draw_default(ctx, state) {
      this._draw_dots(ctx, { ...state, count: 1 });
    }
  }
);
