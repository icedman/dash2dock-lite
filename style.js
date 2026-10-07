'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

const INSTANCE_ID = (() => {
  try {
    return new Gio.Credentials().get_unix_pid();
  } catch {
    return GLib.uuid_string_random();
  }
})();

export const Style = class {
  constructor() {
    this.styles = {};
    this.style_contents = {};
  }

  unloadAll() {
    let ctx = St.ThemeContext.get_for_stage(global.stage);
    let theme = ctx ? ctx.get_theme() : null;
    Object.keys(this.styles).forEach((k) => {
      let fn = this.styles[k];
      if (theme && fn) {
        try {
          theme.unload_stylesheet(fn);
        } catch (err) {
          console.error('d2da: style unloadAll unload_stylesheet', err);
        }
      }

      if (fn) {
        try {
          fn.delete(null);
        } catch (err) {
          if (
            !(
              err?.matches &&
              err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)
            )
          ) {
            console.error('d2da: style unloadAll', err);
          }
        }
      }
    });
    this.styles = {};
    this.style_contents = {};
  }

  build(name, style_array) {
    let ctx = St.ThemeContext.get_for_stage(global.stage);
    let theme = ctx ? ctx.get_theme() : null;

    let content = '';
    style_array.forEach((k) => {
      content = `${content}\n${k}`;
    });

    if (this.style_contents[name] === content) {
      // log('skip regeneration');
      return;
    }

    const runtimeDir = GLib.get_user_runtime_dir() || GLib.get_tmp_dir();
    GLib.mkdir_with_parents(runtimeDir, 0o700);
    const targetPath = GLib.build_filenamev([
      runtimeDir,
      `d2da-${name}-${INSTANCE_ID}.css`,
    ]);

    let fn = this.styles[name];
    if (fn) {
      if (fn.get_path() !== targetPath) {
        if (theme) {
          try {
            theme.unload_stylesheet(fn);
          } catch (err) {
            console.error('d2da: style build unload_stylesheet', err);
          }
        }
        try {
          fn.delete(null);
        } catch (err) {
          if (
            !(
              err?.matches &&
              err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)
            )
          ) {
            console.error('d2da: style build cleanup', err);
          }
        }
        fn = Gio.File.new_for_path(targetPath);
        this.styles[name] = fn;
      } else if (theme) {
        try {
          theme.unload_stylesheet(fn);
        } catch (err) {
          console.error('d2da: style build unload_stylesheet', err);
        }
      }
    } else {
      fn = Gio.File.new_for_path(targetPath);
      this.styles[name] = fn;
    }

    this.style_contents[name] = content;
    fn.replace_contents(
      content,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );

    if (theme) {
      theme.load_stylesheet(fn);
    }

    // log(content);
  }

  rgba(color) {
    let clr = color || [1, 1, 1, 1];
    let res = clr.map((r) => Math.floor(255 * r));
    res[3] = clr[3].toFixed(1);
    return res.join(',');
  }

  hex(color) {
    let r = Math.floor(color[0] * 255).toString(16);
    let g = Math.floor(color[1] * 255).toString(16);
    let b = Math.floor(color[2] * 255).toString(16);
    if (r.length == 1) r += r;
    if (g.length == 1) g += g;
    if (b.length == 1) b += b;
    let res = `#${r}${g}${b}`;
    console.log(`${color} ${res}`);
    return res;
  }
};
