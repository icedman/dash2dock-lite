#!/usr/bin/python

# TODO
# { ShowAppsIcon, Extension, etc... }
# getShaderSource

import sys
import re

from os import listdir, mkdir, makedirs
from os.path import isdir, isfile, join, exists
from shutil import copyfile, copytree, rmtree
from pprint import pprint

imports = []

output = open("./dist/extension.js", "w")
output.write(open("./imports.txt", "r").read())
output.write("\n\n")

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
        if l.startswith("import "):
            commentOut = True
            inImport = "from" not in l
            if ("gi:" in l or "import *" in l) and l not in imports:
                imports.append(l)
        if l.startswith("export default"):
            l = l.replace("export default", "")
        if l.startswith("export "):
            l = l.replace("export ", "")

        if commentOut or inImport:
            output.write("//")
        output.write(l);
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


dumpFiles("./")

# for l in imports:
#     print(l.strip())