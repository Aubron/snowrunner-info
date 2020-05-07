#!/usr/bin/env python3
"""
Unpacks Saber3D resource files, only really tested with initial.cache_block
"""

import argparse
import pathlib
import re
import struct

HEADER_SIGNATURE = b'1SER'
HEADER_ENTRY_COUNT_OFFSET = 0x45


def get_args(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("data_file", type=pathlib.Path)
    parser.add_argument("output_dir", type=pathlib.Path)
    return parser.parse_args(argv)


def main(argv=None):
    args = get_args(argv)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    with args.data_file.open("rb") as f:
        data = f.read()
    assert data[:4] == HEADER_SIGNATURE

    ptr = HEADER_ENTRY_COUNT_OFFSET
    (entries,) = struct.unpack("<I", data[ptr : ptr + 4])
    ptr += 8

    ptr += 1
    filenames = []
    for _ in range(entries):
        (next_filename_length,) = struct.unpack("<I", data[ptr : ptr + 4])
        ptr += 4
        filename = data[ptr : ptr + next_filename_length]
        ptr += next_filename_length
        filenames.append(filename.decode("utf-8"))

    ptr += 1
    start_offsets = []
    for _ in range(entries):
        (start_offset,) = struct.unpack("<Q", data[ptr : ptr + 8])
        ptr += 8
        start_offsets.append(start_offset)

    ptr += 1
    content_lengths = []
    for _ in range(entries):
        (content_length,) = struct.unpack("<I", data[ptr : ptr + 4])
        ptr += 4
        content_lengths.append(content_length)

    ptr += 1
    ptr += entries * 4
    contents = []
    for content_length in content_lengths:
        contents.append(data[ptr : ptr + content_length])
        ptr += content_length

    for filename, content in zip(filenames, contents):
        filename_parts = re.split(r"[\\/:]", re.sub(r"[<>*?|]", "", filename))
        destination = args.output_dir.joinpath(*filename_parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with open(destination, "wb") as f:
            f.write(content)


if __name__ == "__main__":
    main()
