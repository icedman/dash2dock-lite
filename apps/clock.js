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
      this.setcolor(ctx, color, 1); //指针颜色
      ctx.setLineWidth(width);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, len);
      ctx.stroke();
      ctx.restore(); //消除旋转的角度
    }

    setcolor(ctx, colorstr, alpha) {
      const [, cc] = Clutter.Color.from_string(colorstr);
      ctx.setSourceRGBA(cc.red, cc.green, cc.blue, alpha);
    }

    on_draw(canvas, ctx, width, height) {
      const back_color = 'black';
      const hour_color = 'white';
      const minute_color = 'red';

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.translate(size / 2, size / 2); //窗口中心为坐标原点。
      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      let bgSize = size * 0.8;
      ctx.save();
      this.setcolor(ctx, back_color, 1.0); //底
      ctx.arc(0, 0, bgSize / 2 - bgSize / 20, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      const d0 = new Date(); //时间
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
      ); //时针，30度1小时
      this.draw_line(
        ctx,
        minute_color,
        size / 33,
        m0 * 6 * (Math.PI / 180),
        -Math.floor(size / 2.7)
      ); //分针，6度1分钟
      ctx.restore();
      ctx.$dispose(); // 释放context，有用？
    }

    destroy() {}
  }
);
