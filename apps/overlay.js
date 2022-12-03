// adapted from https://github.com/jderose9/dash-to-panel
// adapted from https://github.com/micheleg/dash-to-dock

const { Clutter, GObject, GLib, PangoCairo, Pango } = imports.gi;
const Cairo = imports.cairo;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Drawing = Me.imports.drawing.Drawing;

var DebugOverlay = GObject.registerClass(
  {},
  class DebugOverlay extends Clutter.Actor {
    _init(x, y) {
      super._init();

      this._width = x ? x : 400;
      this._height = y ? y : 400;

      this.state = {
        color: [0.8, 0.25, 0.15, 1],
      };

      this._canvas = new Clutter.Canvas();
      this._canvas.connect('draw', this.on_draw.bind(this));
      this._canvas.invalidate();
      this._canvas.set_size(this._width, this._height);
      this.set_size(this._width, this._height);
      this.set_content(this._canvas);
      this.reactive = false;
    }

    redraw() {
      this._canvas.invalidate();
    }

    set_state(s) {
      this.state = s;
      this.redraw();
    }

    on_draw(canvas, ctx, width, height) {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      ctx.save();

      // ctx.translate(width / 2, height / 2);
      // Drawing.draw_line(
      //   ctx,
      //   this.state.color,
      //   1,
      //   0,
      //   0,
      //   this._width,
      //   this._height
      // );

      if (this.onDraw) {
        this.onDraw(ctx);
      }

      // let bgSize = size * 0.7;
      // let offset = size - bgSize;
      // Drawing.draw_circle(ctx, this.state.color, 0, 0, bgSize);

      ctx.restore();

      ctx.$dispose();
    }

    destroy() {}
  }
);
