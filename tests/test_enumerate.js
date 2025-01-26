import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';

let downloadFiles = [];
let downloadFilesLength = 0;

let path = '/home/iceman/Downloads';
let directory = Gio.File.new_for_path(path);
let enumerator = directory.enumerate_children(
  [
    Gio.FILE_ATTRIBUTE_STANDARD_NAME,
    Gio.FILE_ATTRIBUTE_STANDARD_ICON,
    Gio.FILE_ATTRIBUTE_TIME_MODIFIED,
  ].join(','),
  Gio.FileQueryInfoFlags.NONE,
  null,
);

let fileInfo;
while ((fileInfo = enumerator.next_file(null)) !== null) {
  let fileName = fileInfo.get_name();
  let fileModified = fileInfo.get_modification_time();
  downloadFiles.push(fileName);

  console.log([
    fileName,
    fileModified.tv_sec,
    fileInfo.get_icon().get_names()[0],
    fileInfo.get_file_type(),
  ]);

  console.log(fileModified);
}
