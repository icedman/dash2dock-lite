<br/>
<p align="center">
  <h3 align="center">Dash2Dock Animated</h3>

  <p align="center">
    A GNOME Shell 40+ Extension
    <br/>
    <br/>
  </p>
</p>

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/icedman)

![Contributors](https://img.shields.io/github/contributors/icedman/dash2dock-lite?color=dark-green) ![Forks](https://img.shields.io/github/forks/icedman/dash2dock-lite?style=social) ![Stargazers](https://img.shields.io/github/stars/icedman/dash2dock-lite?style=social) ![Issues](https://img.shields.io/github/issues/icedman/dash2dock-lite) ![License](https://img.shields.io/github/license/icedman/dash2dock-lite) 

![Screen Shot](https://raw.githubusercontent.com/icedman/dash2dock-lite/main/screenshots/Screenshot%20from%202024-03-19%2015-31-27.png)

### Notice

* Supports Gnome 42, 43, 44, 45, 46, 47, 48, 49
* Prior versions are largely unsupported

### Features

* Multi-monitor support (new!)
* Dash docked at the desktop
* Animated dock icons
* Resize icons
* Autohide/intellihide
* Dock positions: bottom, top, left, right
* Scrollwheel to cycle windows
* Click to maximize/minimize windows
* Style top panel
* Panel mode
* Show/Hide Apps icon
* Analog clock
* Dynamic calendar
* Dynamic trash icon
* Mounted devices
* Downloads icon with fan animation (new!)
* Icon color effects(Tint, Monochrome)
* Blurred background
* Custom icons

### Prerequisites

Requirements:

* GNOME Shell (version 40+)

### Installation

Manual Installation: 
- Clone this repo
```bash
$ git clone https://github.com/icedman/dash2dock-lite.git
```
- Use the `Makefile` to build and install
```bash 
$ cd dash2dock-lite
$ make
```

Using the AUR (Arch User Repository):
*This requires an Arch-based distribution to work:*
```bash
$ git clone https://aur.archlinux.org/gnome-shell-extension-dash2dock-lite.git
$ makepkg -si
```

From Gnome Extensions Repository

Visit [https://extensions.gnome.org/extension/4994/dash2dock-lite/](https://extensions.gnome.org/extension/4994/dash2dock-lite/)

## Theme Support

Export your settings under Style > Themes Button > "Export"...

This will be saved to ```/tmp/theme.json```. Edit this json file and save under ```~/.config/d2da/themes``` or at ```{extension_path}/dash2dock-animated/themes``` so that it becomes available at the extension settings app.

## Custom Icons

Create a folder under ```sh~/.config/d2da/icons``` and place here your SVG icons. Then create a file under ```sh~/.config/d2da/icons.json``` and create a mapping file with the following format:

```json
{
  "icons": {
     "view-app-grid-symbolic": "icons/show-apps-icon.svg",
     "user-trash": "icons/my-own-trash.svg",
     "user-trash-full": "icons/my-own-trash-full.svg"
  }
}
```

You may also use **icon names** from your favorite icon theme. And use the following format:

```json
{
  "icons": {
     "view-app-grid-symbolic": "show-apps-icon",
     "user-trash": "trash",
     "user-trash-full": "trash-full"
  }
}
```

The icons ```show-apps-icon, trash, trash-full``` must be available on your icons theme folder. 

Alternatively, you may override icons via app id:

```json
{
   "apps": {
      "spotify_spotify": "icons/spotify.svg"
   }
}
```

Check the log to see the icon names currently being used by Dash2Dock Animated. Search for log text such assets

```sh
Icon created "user-trash"
```

## Blurred Background

Blurred background feature requires **imagemagick** to be install in the system. This generates the blurred image based of the desktop wallpaper.

## Gnome 42, 43, 44

Build and install Dash2Dock Animated for prior versions (before Gnome 45)

```make g44```

## Bug Reporting

When reporting bugs. Please indicate the following:

* Linux Flavor/Distribution and version
* Gnome version (45.xx)
* Dash2Dock Animated release number

Check for any exceptions in the logs by running the following at the terminal:

```sh
journalctl /usr/bin/gnome-shell -f -o cat
```

To check incompatibilities with other extensions, try running Dash2Dock Animated with other extensions disabled.

To check for lag or inefficiency. Run the following in the terminal and observer gnome-shell CPU usage.

```sh
top -d 0.5
```

On my old Dell XPS13 i5-6200U. CPU usage is about 50% with icons quality high, frame rate high, shadows on.

Please be specific on the errors encountered. Add screenshots whenever possible.

## Testing Rig

* Arch Linux (Gnome 45.5)
* Debian 12 (Gnome 43.9)
* Fedora 39 (Gnome 45.0)
* Fedora 40 Beta (Gnome 46.0)
* Manjaro Linux (Gnome 45.3)
* Opensuse Tumbleweed (Gnome 46.0)
* Ubuntu 23 (Gnome 45.0)

## License

Distributed under the GPL 3.0 License. See [LICENSE](https://github.com/icedman/dash2dock-lite/blob/main/LICENSE.md) for more information.
