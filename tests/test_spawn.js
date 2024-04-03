const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

// {
//     let [res, out, err, status] = GLib.spawn_command_line_sync('ls -la');
//     print(out);
// }

// {
//     let [res, out] = GLib.spawn_command_line_sync('ls -la');
//     print(out);
// }

// {
//     let [res, out] = GLib.spawn_sync(null, ['/bin/ls', '-la'], null, 0, null);
//     print(out);
// }

// {
//     let [res, out] = GLib.spawn_sync(GLib.getenv('HOME'), ['/bin/ls', '-la'], null, 0, null);
//     print(out);
// }

// {
//     let [res, out] = GLib.spawn_sync(null, ['ls', '-la'], null, GLib.SpawnFlags.SEARCH_PATH, null);
//     print(out);
// }

// GLib.spawn_command_line_async('ls -la');

let [res, pid, in_fd, out_fd, err_fd]  = GLib.spawn_async_with_pipes(null, ['/bin/ls', "-lah"], null, 0, null);
let out_reader = new Gio.DataInputStream({
  base_stream: new Gio.UnixInputStream({fd: out_fd})
});

for(let i=0; i<200; i++) {
    let [line, size] = out_reader.read_line_utf8(null);
    if (line == null) break;
    print(line);
}

// let in_writer = new Gio.UnixOutputStream({fd: in_fd});
// let data = ["hoge", "fuga", ""].join("\n");
// in_writer.write(data, data.length, null);
// let [out, size] = out_reader.read_line(null);
// print(out);
// let [out, size] = out_reader.read_line(null);
// print(out);