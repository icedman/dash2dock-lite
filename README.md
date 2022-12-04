<br/>
<p align="center">
  <h3 align="center">Dash2Dock Lite</h3>

  <p align="center">
    A GNOME Shell 40+ Extension
    <br/>
    <br/>
  </p>
</p>

![Contributors](https://img.shields.io/github/contributors/icedman/dash2dock-lite?color=dark-green) ![Forks](https://img.shields.io/github/forks/icedman/dash2dock-lite?style=social) ![Stargazers](https://img.shields.io/github/stars/icedman/dash2dock-lite?style=social) ![Issues](https://img.shields.io/github/issues/icedman/dash2dock-lite) ![License](https://img.shields.io/github/license/icedman/dash2dock-lite) 


![Screen Shot](https://raw.githubusercontent.com/icedman/dash2dock-lite/main/screenshots/Screenshot%20from%202022-10-17%2021-33-29.png)

### Features

* Dash docked at the desktop
* Animated dock icons
* Resize icons
* Autohide/intellihide
* Dock position - left, right layout
* Scrollwheel to cycle windows
* Click to maximize/minimize windows
* Style top panel
* Panel mode
* Show/Hide Apps icon
* Analog clock
* Dynamic calendar
* Dynamic trash icon
* Mounted devices
* Icon color effects(Tint, Monochrome)

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

## Alternative

Checkout Dash Animator. It adds animation to Dash-to-Dock.

```bash
$ git clone https://github.com/icedman/dash-animator.git
```

## Dynamic Icons

Dynamic trash icon is supported (beta). The first time this is enabled, a GNOME shell restart is required.

The trash icon has an action "Empty Trash" which requires a script *{EXTENSION_PATH}/apps/empty-trash.sh* with the content:

```sh
#!/usr/bin/sh
rm -rf ~/.local/share/Trash/*
```

Modify the script to match your system if necessary. And make sure that the script is executable:

```sh
chmod +x {EXTENSION_PATH}/apps/empty-trash.sh
```

## License

Distributed under the GPL 3.0 License. See [LICENSE](https://github.com/icedman/dash2dock-lite/blob/main/LICENSE.md) for more information.
