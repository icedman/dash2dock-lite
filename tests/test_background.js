'use strict';

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Cairo from 'gi://cairo';
import St from 'gi://St';

import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';

import { Drawing } from './drawing.js';

export let BackgroundCanvas = GObject.registerClass(
  {},
  class BackgroundCanvas extends St.DrawingArea {
    _init(settings = {}) {
      super._init({
        style_class: 'dock-box',
      });

      this.width = 128;
      this.height = 128;

      // this.load_image().then(() => {
      //   this.redraw();
      // });
    }

    load_image() {
      return new Promise((resolve, reject) => {
        const loader = new GdkPixbuf.PixbufLoader();

        loader.connect('size-prepared', (sz) => {
          console.log('size-prepared');
        });

        loader.connect('area-prepared', () => {
          print('area prepared');
        });

        loader.connect('closed', () => {
          print('loader closed');
          const pixbuf = loader.get_pixbuf(); // Get the loaded pixbuf
          console.log([pixbuf.width, pixbuf.height]);

          // Create a Cairo surface
          const surface = new Cairo.ImageSurface(
            Cairo.Format.ARGB32,
            pixbuf.get_width(),
            pixbuf.get_height(),
          );
          const context = new Cairo.Context(surface);

          const imageData = pixbuf.get_pixels();
          const { width, height, rowstride } = pixbuf;
          const data = new Uint8Array(imageData);

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const i = y * rowstride + x * 4;
              const r = data[i] / 255;
              const g = data[i + 1] / 255;
              const b = data[i + 2] / 255;
              const a = data[i + 3] / 255;
              context.setSourceRGBA(r, g, b, 1);
              context.rectangle(x, y, 1, 1);
              context.fill();
            }
          }

          // surface.writeToPNG('/tmp/image.png');

          // Cleanup
          context.$dispose();

          this.surface = surface;

          console.log('surface prepared');

          resolve();
        });

        const file = Gio.File.new_for_path(
          // '/home/iceman/Pictures/9uKBABA.png',
          // '/usr/share/backgrounds/background.jpg'
          '/usr/share/icons/hicolor/48x48/apps/spotify.png',
        );

        const [success, contents] = file.load_contents(null);
        loader.write(contents);
        loader.close();
      });
    }

    redraw() {
      this.queue_repaint();
    }

    vfunc_repaint() {
      let ctx = this.get_context();
      let [width, height] = this.get_surface_size();

      let size = width;

      const hd_color = 'red';
      const bg_color = 'white';
      const day_color = 'black';
      const date_color = 'red';

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.setOperator(Cairo.Operator.SOURCE);

      ctx.save();
      if (this.surface) {
        ctx.setSourceSurface(this.surface, 0, 0);
      }
      ctx.moveTo(0, 0);
      ctx.lineTo(size, 0);
      ctx.lineTo(size, size);
      ctx.lineTo(0, size);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.restore();

      ctx.$dispose();
    }
  },
);
