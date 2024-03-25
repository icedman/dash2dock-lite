#!/usr/bin/python

import sys
import re

from os import listdir, mkdir, makedirs
from os.path import isdir, isfile, join, exists
from shutil import copyfile, copytree, rmtree
from pprint import pprint

imports = []

def dump(f):
    if f.startswith("./tests/"):
        return
    if f.startswith("./dist/"):
        return
    f = f.strip()
    if not f.endswith(".js"):
        return
    output.write("//-----------------------------\n")
    output.write("// " + f + "\n")
    output.write("//-----------------------------\n\n")

    inImport = False;
    for l in open(f, "r"):
        commentOut = False


        if l.startswith("'use strict'") or l.startswith("const Point"):
            commentOut = True
        if "getSettings" in l:
            l = "this._settings = ExtensionUtils.getSettings(schemaId)";
        if l.startswith("import "):
            commentOut = True
            inImport = True
        if l.startswith("export default"):
            l = l.replace("export default", "")
        if l.startswith("export "):
            l = l.replace("export ", "")

        if commentOut or inImport:
            output.write("//")
        output.write(l);

        if inImport and "from" in l:
            inImport = False

    output.write("\n\n")


def dumpFiles(path):
    morePaths = []

    files = listdir(path)
    for f in files:
        fullpath = join(path, f)

        if isdir(fullpath):
            morePaths.append(fullpath)
            continue

        dump(fullpath)

    for p in morePaths:
        dumpFiles(p)

def dumpPref(path):
    dump(join(path, "prefs.js"))
    dumpFiles(join(path, "preferences"))

output = open("./dist/extension.js", "w")
output.write(open("./imports_legacy.txt", "r").read())
output.write("\n\n")

dumpFiles("./")

output = open("./dist/prefs.js", "w")
output.write(open("./imports_prefs.txt", "r").read())
output.write("\n\n")

dumpPref("./")
