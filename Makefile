all: build install lint

.PHONY: build install publish check-devkit test-shell test-shell2 check smoke lint check-settings

RUNTIME_DIR ?= $(or $(XDG_RUNTIME_DIR),/run/user/$(shell id -u))
# gnome-shell writes this at startup as a crash marker; if it is left behind
# (e.g. nested shell killed early) the next run starts with all extensions off.
DISABLE_EXT_FLAG = $(RUNTIME_DIR)/gnome-shell-disable-extensions
MUTTER_DEVKIT ?= /usr/libexec/mutter-devkit

# GNOME 49+: `gnome-shell --devkit` runs headless and spawns mutter-devkit as
# the viewer window. Without it the shell runs but no window ever appears.
check-devkit:
	@test -x $(MUTTER_DEVKIT) || { \
		echo "error: $(MUTTER_DEVKIT) not found - nested shell would run with no window."; \
		echo "       install it: sudo dnf install mutter-devkit"; \
		exit 1; }

build:
	glib-compile-schemas --strict --targetdir=schemas/ schemas

install: build
	echo "installing..."
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	mkdir -p ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	cp -R ./* ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/build
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/Makefile
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/tests
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/tools
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/screenshots
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/node_modules
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/agents
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/eslint.config.js
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/package.json
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/package-lock.json

clean:
	rm -rf ./build

publish:
	./tools/publish.sh $(VERSION)

install-zip:
	echo "installing zip..."
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com
	mkdir -p ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	unzip -q dash2dock-lite@icedman.github.com.zip -d ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/

test-prefs:
	gnome-extensions prefs dash2dock-lite@icedman.github.com

test-shell: check-devkit install
	rm -f $(DISABLE_EXT_FLAG)
	-env GNOME_SHELL_SLOWDOWN_FACTOR=1 \
		MUTTER_DEBUG_DUMMY_MODE_SPECS=1200x800 \
	 	MUTTER_DEBUG_DUMMY_MONITOR_SCALES=1 \
		dbus-run-session -- gnome-shell --devkit --wayland
	rm -f $(DISABLE_EXT_FLAG)

test-shell2: check-devkit install
	rm -f $(DISABLE_EXT_FLAG)
	-env GNOME_SHELL_SLOWDOWN_FACTOR=2 \
		MUTTER_DEBUG_DUMMY_MODE_SPECS=1200x800 \
	 	MUTTER_DEBUG_DUMMY_MONITOR_SCALES=2 \
		dbus-run-session -- gnome-shell --devkit --wayland
	rm -f $(DISABLE_EXT_FLAG)

g44: build
	rm -rf ./build
	mkdir -p ./build
	mkdir -p ./build/apps
	mkdir -p ./build/effects
	mkdir -p ./build/preferences
	python3 ./tools/transpile.py
	rm -rf ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	mkdir -p ~/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/
	cp -R ./schemas ./build
	cp -R ./themes ./build
	cp -R ./ui ./build
	cp -R apps/*.sh ./build/apps
	cp -R apps/*.desktop ./build/apps
	rm -rf build/apps/mount-dash2dock-lite.desktop
	cp ./effects/*.glsl ./build/effects
	cp ./LICENSE* ./build
	-cp ./CHANGELOG* ./build 2>/dev/null || true
	cp ./README* ./build
	cp ./stylesheet.css ./build
	cp ./apps/recents.js ./build/apps
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
	rm -f $(DISABLE_EXT_FLAG)

lint:
	npx eslint .

# Fast parse-only syntax check of all shipped JS (ESLint: `make lint`).
check:
	find . -path ./node_modules -prune -o -path ./build -prune -o -path ./tests -prune \
		-o -path ./tools -prune -o -name '*.js' -print \
		| xargs -n1 node --experimental-default-type=module --check
	@echo "check: OK"

# schema <-> preferences/keys.js <-> ui/*.ui <-> runtime refs. Exits 1 on
# error-class issues (shared adjustment, duplicate case, missing schema key).
check-settings:
	python3 tools/check-settings.py

# Headless nested shell: extension ACTIVE, N enable/disable cycles, no new
# error signatures vs agents/smoke-baseline.txt. See tools/smoke-shell.sh.
smoke: install
	tools/smoke-shell.sh 5

xml-lint:
	cd ui ; \
	find . -name "*.ui" -type f -exec xmllint --output '{}' --format '{}' \;

pretty: xml-lint
	rm -rf ./build/*
	prettier --single-quote --write "**/*.js"

todo:
	python ./tools/todo.py > ./TODO.md
