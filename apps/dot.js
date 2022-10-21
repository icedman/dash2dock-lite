// from gnome-shell-cairo clock extension

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
    }

    redraw() {
      this._canvas.invalidate();
    }

    set_state(s) {
      // count deep compare
      if (!this.state ||this.state.count != s.count || this.state.color != s.color || this.state.style != s.style) {
        this.state = s;
        this.redraw();
      }
    }

    on_draw(canvas, ctx, width, height) {
      if (!this.state || !this.state.color || !this.state.count) return;

      const dot_color = this.state.color;

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.translate(size / 2, size / 2);
      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      // background
      /*
      ctx.save();
      // Drawing.draw_line(ctx, dot_color, 2, 0, 0, size, size);
      Drawing.draw_rounded_rect(
        ctx,
        dot_color,
        -size/2,
        -size/2,
        size,
        size,
        2,
        8
      );
      ctx.restore();
      */

      let style = {
        length: 8,
        distance: 24,
        width: 4
      };

      ctx.save();
      let count = this.state.count;
      if (count > 3) count = 3;
      let space = (style.length * count) + (style.distance * (count - 1));
      let sw = space / count;
      for(let i=0; i<count; i++) {
        let x = -space/2 + (sw * i) + (sw/2);
        let y = size/2 - style.width/2;
        Drawing.draw_line(ctx, this.state.color, style.width, x-style.length/2, y, x+style.length/2, y);
      }
      ctx.restore();

      ctx.$dispose();
    }

    destroy() {}
  }
);
