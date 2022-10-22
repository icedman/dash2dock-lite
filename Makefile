all: build install lint

.PHONY: build install

build:
	glib-compile-schemas --strict --targetdir=schemas/ schemas

install:
	echo "installing..."
	mkdir -p ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	cp -R ./* ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/

publish:
	echo "publishing..."
	rm -rf build
	mkdir build
	cp LICENSE ./build
	cp *.js ./build
	cp metadata.json ./build
	cp stylesheet.css ./build
	cp README.md ./build
	cp -R schemas ./build
	cp -R ui ./build
	cp -R apps ./build
	cp -R preferences ./build
	rm -rf ./*.zip
	cd build ; \
	zip -qr ../dash2dock-lite@icedman.github.com.zip .

install-zip: publish
	echo "installing zip..."
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com
	mkdir -p ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	unzip -q dash2dock-lite@icedman.github.com.zip -d ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/

test-prefs:
	gnome-extensions prefs dash2dock-lite@icedman.github.com

test-shell: install
	env GNOME_SHELL_SLOWDOWN_FACTOR=2 \
		MUTTER_DEBUG_DUMMY_MODE_SPECS=1500x1000 \
	 	MUTTER_DEBUG_DUMMY_MONITOR_SCALES=1 \
		dbus-run-session -- gnome-shell --nested --wayland

lint:
	eslint ./

pretty:
	prettier --single-quote --write "**/*.js"
# 	prettier --print-width=800 --parser=html --single-quote --write "**/*.ui"
