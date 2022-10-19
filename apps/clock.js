// from gnome-shell-cairo clock extension

const { Clutter, GObject, GLib, PangoCairo, Pango } = imports.gi;
const Cairo = imports.cairo;

let size = 400;

var xClock = GObject.registerClass(
  {
    Properties: {},
    Signals: {},
  },
  class xClock extends Clutter.Actor {
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

    draw_line(ctx, color, width, angle, len) {
      ctx.save();
      ctx.rotate(angle);
      this.set_color(ctx, color, 1);
      ctx.setLineWidth(width);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, len);
      ctx.stroke();
      ctx.restore();
    }

    set_color(ctx, colorstr, alpha) {
      const [, cc] = Clutter.Color.from_string(colorstr);
      ctx.setSourceRGBA(cc.red, cc.green, cc.blue, alpha);
    }

    set_color_rgba(ctx, red, green, blue, alpha) {
      ctx.setSourceRGBA(red, green, blue, alpha);
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
      ctx.save();
      // this.set_color(ctx, back_color, 1.0);
      this.set_color_rgba(ctx, 0.2, 0.2, 0.2, 1.0);
      ctx.arc(0, 0, bgSize / 2 - bgSize / 20, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      const d0 = new Date();
      let h0 = d0.getHours();
      const m0 = d0.getMinutes();

      ctx.save();
      ctx.moveTo(0, 0);
      this.draw_line(
        ctx,
        hour_color,
        size / 20,
        (h0 * 30 + (m0 * 30) / 60) * (Math.PI / 180),
        -Math.floor(size / 3.7)
      );
      this.draw_line(
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
