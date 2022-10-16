// from gnome-shell-cairo clock extension

const { Clutter, GObject, GLib, PangoCairo, Pango } = imports.gi;
const Cairo = imports.cairo;

let size = 400;

var xCalendar = GObject.registerClass(
  {
    Properties: {},
    Signals: {},
  },
  class xCalendar extends Clutter.Actor {
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
      this.set_color(ctx, color, 1); //指针颜色
      ctx.setLineWidth(width);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, len);
      ctx.stroke();
      ctx.restore(); //消除旋转的角度
    }

    draw_rounded_rect(
      ctx,
      color,
      x,
      y,
      h_size,
      v_size,
      line_width,
      border_radius
    ) {
      ctx.save();
      this.set_color(ctx, color, 1); //色
      ctx.translate(x, y);
      ctx.setLineWidth(line_width);
      ctx.moveTo(border_radius, 0);
      ctx.lineTo(h_size - border_radius, 0);
      // ctx.lineTo(h_size, border_radius);
      ctx.curveTo(h_size - border_radius, 0, h_size, 0, h_size, border_radius);
      ctx.lineTo(h_size, v_size - border_radius);
      // ctx.lineTo(h_size - border_radius, h_size);
      ctx.curveTo(
        h_size,
        v_size - border_radius,
        h_size,
        v_size,
        h_size - border_radius,
        v_size
      );
      ctx.lineTo(border_radius, v_size);
      // ctx.lineTo(0, h_size - border_radius);
      ctx.curveTo(border_radius, v_size, 0, v_size, 0, v_size - border_radius);
      ctx.lineTo(0, border_radius);
      ctx.curveTo(0, border_radius, 0, 0, border_radius, 0);
      ctx.fill();
      ctx.restore(); //消除旋转的角度
    }

    draw_text(ctx, showtext, font = 'DejaVuSans 42') {
      ctx.save();
      let pl = PangoCairo.create_layout(ctx);
      pl.set_text(showtext, -1);
      pl.set_font_description(Pango.FontDescription.from_string(font));
      PangoCairo.update_layout(ctx, pl);
      let [w, h] = pl.get_pixel_size();
      ctx.relMoveTo(-w / 2, -h / 2);
      PangoCairo.show_layout(ctx, pl);
      ctx.relMoveTo(w / 2, 0);
      ctx.restore();
      return [w, h];
    }

    set_color(ctx, colorstr, alpha) {
      const [, cc] = Clutter.Color.from_string(colorstr);
      ctx.setSourceRGBA(cc.red, cc.green, cc.blue, alpha);
    }

    on_draw(canvas, ctx, width, height) {
      const hd_color = 'red';
      const bg_color = 'white';
      const day_color = 'black';
      const date_color = 'red';

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.translate(size / 2, size / 2);
      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      let bgSize = size * 0.7;
      let offset = size - bgSize;

      const d0 = new Date();

      this.draw_rounded_rect(
        ctx,
        bg_color,
        -size / 2 + offset / 2,
        -size / 2 + offset / 2,
        bgSize,
        bgSize,
        1,
        8
      );
      this.set_color(ctx, date_color, 1.0);
      ctx.moveTo(0, 12);
      this.draw_text(ctx, `${d0.getDate()}`, 'DejaVuSans 36');

      let dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      this.set_color(ctx, day_color, 1.0);
      ctx.moveTo(0, -22);
      this.draw_text(ctx, `${dayNames[d0.getDay()]}`, 'DejaVuSans 16');

      ctx.$dispose();
    }

    destroy() {}
  }
);
