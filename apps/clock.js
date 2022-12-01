// adapted from gnome-shell-cairo clock extension

const { Clutter, GObject, GLib, PangoCairo, Pango } = imports.gi;
const Cairo = imports.cairo;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Drawing = Me.imports.drawing.Drawing;

let size = 400;

var Clock = GObject.registerClass(
  {},
  // todo St.DrawingArea
  class Clock extends Clutter.Actor {
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
    }

    redraw() {
      this._canvas.invalidate();
    }

    on_draw(canvas, ctx, width, height) {
      const back_color = 'black';
      const hour_color = 'white';
      const minute_color = 'red';

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.translate(size / 2, size / 2);
      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      let bgSize = size * 0.84;
      // ctx.save();
      // // Drawing.set_color(ctx, back_color, 1.0);
      // Drawing.set_color_rgba(ctx, 0.2, 0.2, 0.2, 1.0);
      // ctx.arc(0, 0, bgSize / 2 - bgSize / 20, 0, 2 * Math.PI);
      // ctx.fill();
      // ctx.restore();

      Drawing.draw_circle(ctx, [0.2, 0.2, 0.2, 1.0], 0, 0, bgSize);

      const d0 = new Date();
      let h0 = d0.getHours();
      const m0 = d0.getMinutes();

      ctx.save();
      ctx.moveTo(0, 0);
      Drawing.draw_rotated_line(
        ctx,
        hour_color,
        size / 20,
        (h0 * 30 + (m0 * 30) / 60) * (Math.PI / 180),
        -Math.floor(size / 3.7)
      );
      Drawing.draw_rotated_line(
        ctx,
        minute_color,
        size / 33,
        m0 * 6 * (Math.PI / 180),
        -Math.floor(size / 2.7)
      );
      ctx.restore();
      ctx.$dispose();
    }

    destroy() {}
  }
);
