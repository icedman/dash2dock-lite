all: build install lint

.PHONY: build install

build:
	glib-compile-schemas --strict --targetdir=schemas/ schemas

install: build
	echo "installing..."
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	mkdir -p ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	cp -R ./* ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	rm -R ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/apps/*.desktop

clean:
	rm -rf ./build
	
publish:
	echo "publishing..."
	rm -rf build
	mkdir ./build
	cp LICENSE ./build
	cp *.js ./build
	cp metadata.json ./build
	cp stylesheet.css ./build
	cp CHANGELOG.md ./build
	cp README.md ./build
	cp -R schemas ./build
	cp -R ui ./build
	cp -R apps ./build
	cp -R preferences ./build
	cp -R effects ./build
	rm -rf ./*.zip
	rm -rf build/apps/*.desktop
	rm -rf build/*_.js
	rm -rf build/imports*.js
	cd build ; \
	zip -qr ../dash2dock-lite@icedman.github.com.zip .

install-zip:
	echo "installing zip..."
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com
	mkdir -p ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	unzip -q dash2dock-lite@icedman.github.com.zip -d ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/

test-prefs:
	gnome-extensions prefs dash2dock-lite@icedman.github.com

test-shell: install
	env GNOME_SHELL_SLOWDOWN_FACTOR=2 \
		MUTTER_DEBUG_DUMMY_MODE_SPECS=1200x800 \
	 	MUTTER_DEBUG_DUMMY_MONITOR_SCALES=2 \
		dbus-run-session -- gnome-shell --nested --wayland
	rm /run/user/1000/gnome-shell-disable-extensions

g44: build
	rm -rf ./build
	mkdir -p ./build
	mkdir -p ./build/apps
	mkdir -p ./build/effects
	mkdir -p ./build/preferences
	python3 ./transpile.py
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	mkdir -p ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	cp -R ./schemas ./build
	cp -R ./themes ./build
	cp -R ./ui ./build
	cp ./apps/*.sh ./build/apps
	cp ./effects/*.glsl ./build/effects
	cp ./LICENSE* ./build
	cp ./CHANGELOG* ./build
	cp ./README* ./build
	cp ./stylesheet.css ./build
	cp -r ./build/* ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/

publish-g44: g44
	echo "publishing..."
	cd build ; \
	zip -qr ../dash2dock-lite@icedman.github.com.zip .

test-prefs-g44: g44
	gnome-extensions prefs dash2dock-lite@icedman.github.com

test-shell-g44: g44
	env GNOME_SHELL_SLOWDOWN_FACTOR=2 \
		MUTTER_DEBUG_DUMMY_MODE_SPECS=1200x800 \
	 	MUTTER_DEBUG_DUMMY_MONITOR_SCALES=1 \
		dbus-run-session -- gnome-shell --nested --wayland
	rm /run/user/1000/gnome-shell-disable-extensions

lint:
	eslint ./

xml-lint:
	cd ui ; \
	find . -name "*.ui" -type f -exec xmllint --output '{}' --format '{}' \;

pretty: xml-lint
	rm -rf ./build/*
	prettier --single-quote --write "**/*.js"
