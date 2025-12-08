import Gio from 'gi://Gio';

const loadFile = function (fn) {
  return new Promise((resolve, reject) => {
    if (typeof fn == 'string') {
      fn = Gio.File.new_for_path(fn);
    }
    if (fn.query_exists(null)) {
      fn.load_contents_async(null, (f, res) => {
        let [ok, contents] = f.load_contents_finish(res);
        if (!ok) {
          reject('unable to load file');
        }
        const decoder = new TextDecoder();
        let contentsString = decoder.decode(contents);
        resolve(contentsString);
      });
    } else {
      reject('file not found');
    }
  });
};

let res = await loadFile('/home/iceman/.config/d2da/style.css');
console.log(res);
