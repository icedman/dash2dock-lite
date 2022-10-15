#!/usr/bin/gjs

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Gdk = '4.0';
const { Clutter, Gdk, Gio, GLib, GObject, Gtk, Pango } = imports.gi;
const Cairo = imports.cairo;

let size = 400;
let alarm_h = null;
let alarm_m = null;
const MAX = size / 2 - size / 12;
const MIN = size / 10;
let rotate_angle = 0;
let timeoutClock = null;
//~ let effect = 0;

var xClock = GObject.registerClass(
  {
    Properties: {},
    Signals: {},
  },
  class xClock extends Clutter.Actor {
    _init(x) {
      super._init();

      if (x) size = x;
      this.hover_degree = 0;
      this.alarm_degree = 0;
      this.IsCenter = false;
      this.alarm_active = false;

      this._canvas = new Clutter.Canvas();
      this._canvas.connect('draw', this.on_draw.bind(this));
      this._canvas.invalidate();
      this._canvas.set_size(size, size);
      this.set_size(size, size);
      this.set_content(this._canvas);
      this.reactive = true;
      this.connect('motion-event', this.hover.bind(this));
      this.connect('button-press-event', this.click.bind(this));
    }

    get_alarm() {
      return [alarm_h, alarm_m];
    }

    get_coords() {
      const [x, y] = global.get_pointer();
      const [op, x0, y0] = this.transform_stage_point(x, y); //屏幕位置相对于actor的位置
      if (!op) return false;
      const X = x0 - size / 2;
      const Y = y0 - size / 2;
      const distant = Math.sqrt(X * X + Y * Y);
      if (distant > MAX) {
        this.IsCenter = false;
        this.hover_degree = 0;
        this._canvas.invalidate();
        return false;
      }
      this.IsCenter = distant > MIN ? false : true;
      if (!this.IsCenter)
        this.hover_degree = Math.ceil(Math.atan2(Y, X) / (Math.PI / 180)) + 90;
      if (!this.hover_degree) {
        return false;
      }
      if (this.hover_degree < 0) this.hover_degree += 360;
      return true;
    }

    hover(actor, event) {
      if (!this.get_coords() || this.alarm_active) return Clutter.EVENT_STOP;
      this._canvas.invalidate();
      return Clutter.EVENT_STOP;
    }

    click(actor, event) {
      if (event.get_button() == 3) {
        //右键隐藏
        this.visible = false;
        this.hover_degree = 0;
        this._canvas.invalidate();
        return Clutter.EVENT_STOP;
      }
      if (!this.IsCenter) {
        if (!this.alarm_active) this.alarm_degree = this.hover_degree;
      } else this.alarm_active = !this.alarm_active;
      if (this.alarm_active) {
        [alarm_h, alarm_m] = this.degree2time(this.alarm_degree);
        this.hover_degree = 0;
      } else {
        alarm_h = null;
        alarm_m = null;
      }
      this._canvas.invalidate();
      return Clutter.EVENT_STOP;
    }

    draw_line(ctx, color, width, angle, len) {
      ctx.save();
      ctx.rotate(angle);
      if (this.hover_degree && !this.alarm_active) {
        ctx.setOperator(Cairo.Operator.OVER);
        this.setcolor(ctx, color, 0.4); //指针颜色
      } else this.setcolor(ctx, color, 1); //指针颜色
      ctx.setLineWidth(width);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, len);
      ctx.stroke();
      if (color == 'white') {
        this.setcolor(ctx, this.alarm_active ? 'blue' : 'red', 1);
        ctx.arc(0, len, (width / 2) * 0.6, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore(); //消除旋转的角度
    }

    align_show(ctx, showtext, font = 'DejaVuSerif Bold 16') {
      // API没有绑定这个函数。 Cairo.TextExtents is not a constructor
      //~ https://gitlab.gnome.org/GNOME/gjs/-/merge_requests/720
      //~ let ex = new Cairo.TextExtents();
      //~ ctx.textExtents (showtext, ex);
      //~ ctx.relMoveTo(-ex.width/2,ex.height/2);
      //~ ctx.showText(showtext);
      let pl = PangoCairo.create_layout(ctx);
      pl.set_text(showtext, -1);
      pl.set_font_description(Pango.FontDescription.from_string(font));
      PangoCairo.update_layout(ctx, pl);
      let [w, h] = pl.get_pixel_size();
      ctx.relMoveTo(-w / 2, 0);
      PangoCairo.show_layout(ctx, pl);
      ctx.relMoveTo(w / 2, 0);
    }

    setcolor(ctx, colorstr, alpha) {
      const [, cc] = Clutter.Color.from_string(colorstr);
      ctx.setSourceRGBA(cc.red, cc.green, cc.blue, alpha);
    }

    on_draw(canvas, ctx, width, height) {
      const back_color = 'light gray';
      const hand_color = 'black';

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      //~ ctx.selectFontFace("Sans Bold 27", Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
      //~ Seems all font class in cairo are disable.

      ctx.translate(size / 2, size / 2); //窗口中心为坐标原点。
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      if (timeoutClock) {
        const radian = rotate_angle * (Math.PI / 180);
        //~ if (effect == 1)
        //~ ctx.scale(1, Math.cos(radian));
        //~ else if (effect == 2)
        //~ ctx.scale(Math.cos(radian), 1);
        //~ else
        ctx.rotate(radian);
      }

      this.setcolor(ctx, back_color, 0.8); //底色
      ctx.arc(0, 0, size / 2 - size / 20, 0, 2 * Math.PI);
      ctx.fill();
      ctx.setLineWidth(size / 100);
      this.setcolor(ctx, hand_color, 1);
      ctx.arc(0, 0, size / 2 - size / 20, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineWidth(size / 200);
      this.setcolor(ctx, 'white', 1);
      ctx.arc(0, 0, size / 2 - size / 7.5, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.save(); //刻度
      const scale = 60;
      for (let i = 0; i < scale; i++) {
        ctx.moveTo(0, -MAX);
        if (i % 5 == 0) {
          if (i % 15 == 0) {
            this.setcolor(ctx, hand_color, 1);
            this.align_show(ctx, (i / 5).toString());
            ctx.setLineWidth(size / 30);
          } else {
            this.setcolor(ctx, back_color, 1);
            ctx.setLineWidth(size / 50);
          }
          ctx.relMoveTo(0, -size / 35);
          ctx.relLineTo(0, size / 70);
        }
        ctx.stroke();
        ctx.rotate((360 / scale) * (Math.PI / 180)); // 6度一个刻度
      }
      ctx.restore();

      const d0 = new Date(); //时间
      let h0 = d0.getHours();
      const m0 = d0.getMinutes();

      if (this.hover_degree && !this.alarm_active) {
        const angle = (this.hover_degree * Math.PI) / 180;
        this.setcolor(ctx, 'red', 1); // hover 指示
        ctx.rotate(-Math.PI / 2);
        ctx.setLineWidth(20);
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, size / 4, 0, angle);
        ctx.fill();
        ctx.rotate(Math.PI / 2);

        ctx.moveTo(0, size / 4);
        const [ah, am] = this.degree2time(this.hover_degree);
        this.align_show(ctx, '%02s : %02s'.format(ah, am));
      } else {
        let ampm = 'PM';
        if (h0 >= 12) h0 -= 12;
        else ampm = 'AM';

        this.setcolor(ctx, 'black', 1);
        ctx.moveTo(0, size / 6);
        this.align_show(ctx, '%02s : %02s'.format(h0, m0));
        ctx.moveTo(0, size / 12);
        this.align_show(ctx, ampm);
      }

      this.setcolor(ctx, this.alarm_active ? 'blue' : 'dimgray', 1);
      // *gray show white. darkgreen show green. strange.
      ctx.moveTo(0, -size / 5);
      const [ah, am] = this.degree2time(this.alarm_degree);
      this.align_show(ctx, '%02s : %02s'.format(ah, am));

      ctx.moveTo(0, 0);
      this.draw_line(
        ctx,
        'white',
        size / 25,
        (this.alarm_degree * Math.PI) / 180,
        -Math.floor(size / 4)
      ); //闹铃，30度1小时
      this.draw_line(
        ctx,
        hand_color,
        size / 20,
        (h0 * 30 + (m0 * 30) / 60) * (Math.PI / 180),
        -Math.floor(size / 3.7)
      ); //时针，30度1小时
      this.draw_line(
        ctx,
        hand_color,
        size / 33,
        m0 * 6 * (Math.PI / 180),
        -Math.floor(size / 2.7)
      ); //分针，6度1分钟
      this.setcolor(ctx, hand_color, 1);
      ctx.arc(0, 0, size / 20, 0, 2 * Math.PI);
      ctx.fill();
      this.setcolor(ctx, this.alarm_active ? 'blue' : 'red', 1);
      ctx.arc(0, 0, size / 33, 0, 2 * Math.PI);
      ctx.fill();
      ctx.$dispose(); // 释放context，有用？
    }

    degree2time(degree) {
      const at = degree * 2;
      const ah = parseInt(at / 60);
      const am = parseInt((at - ah * 60) / 5) * 5;
      return [ah, am];
    }

    swing() {
      if (timeoutClock) return; //不能重入。
      const cos_a = [
        0.2588, 0.5, 0.7071, 0.866, 0.966, 1, 1, 0.966, 0.866, 0.7071, 0.5,
        0.2588,
      ]; // cos函数 0-75度,+15递增
      let cnt = 6; //查表循环计数
      let direct = 1; //顺时钟为1
      let max_angle = 10; //每周期递减的最大角度，递减表现为阻尼。
      //~ effect = Math.floor(Math.random() * 3);

      timeoutClock = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
        if (max_angle == 0) {
          //停止条件
          GLib.Source.remove(timeoutClock);
          timeoutClock = null;
        }
        rotate_angle += direct * (max_angle * cos_a[cnt]);
        if (
          (cnt == cos_a.length - 1 && direct == 1) ||
          (cnt == 0 && direct == -1)
        ) {
          direct = direct == 1 ? -1 : 1;
          max_angle--;
        } else cnt += direct; // 转向时，停止一次变动，更加柔和。
        this._canvas.invalidate();
        return GLib.SOURCE_CONTINUE;
      });
    }

    destroy() {
      if (timeoutClock) {
        GLib.Source.remove(timeoutClock);
        timeoutClock = null;
      }
    }
  }
);

Gtk.init();

let app = new Gtk.Application({
  application_id: 'com.dash2dock-lite.GtkApplication',
});

app.connect('activate', (me) => {
  m = new Gtk.ApplicationWindow({ application: me });
  m.set_default_size(600, 250);
  m.set_title('Prefs Test');

  let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
  iconTheme.add_search_path('ui/icons');

  w = new Gtk.Window();
  notebook = new Gtk.Notebook();
  w.set_child(notebook);
  w.set_size_request(600, 600);

  let xc = new xClock(400);
  w.set_child(xc);

  w.title = 'main';
  w.connect('close_request', () => {
    m.close();
    app.quit();
  });
  w.show();

  // m.present();
});

app.connect('startup', () => {});

app.run(['xx']);
