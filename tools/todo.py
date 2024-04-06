#!/usr/bin/python

import sys
import re

from os import listdir, mkdir, makedirs
from os.path import isdir, isfile, join, exists
from shutil import copyfile, copytree, rmtree
from pprint import pprint

output = open("./TODO.md", "w")

def dump(f):
    if not f.endswith(".js"):
        return
    if "build/" in f:
        return
    if "tests/" in f:
        return
    if "imports_" in f:
        return
    f = f.strip()
    
    section = "# "
    section = section + f
    section = section + "\n"

    content = ""
    lineNo = 1
    for l in open(f, "r"):
        l = l.strip()
        if "//!" in l:
            l = l.replace("*", "-")
            l = l.replace("_", "-")
            content = content + "* "
            content = content + str(lineNo)
            content = content + ": "
            content = content + l.replace("//!", "")
            content = content + "\n"

        lineNo += 1

    if content != "":
        print(section)
        print(content)



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