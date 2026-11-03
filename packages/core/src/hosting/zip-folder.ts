import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

/**
 * Writes a folder as a .zip file, the format every hosting control panel's file manager
 * can extract. Small and dependency-free: deflated files, folders as their own entries, no
 * zip64 (the hosting package is far below 4 GB and 65,535 files).
 */
export async function zipFolder(folder: string, zipFile: string, topFolder: string): Promise<void> {
  const entries: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;

  for (const item of await listItems(folder)) {
    const name = `${topFolder}/${relative(folder, item.path).split(sep).join("/")}${item.isFolder ? "/" : ""}`;
    const contents = item.isFolder ? Buffer.alloc(0) : await readFile(item.path);
    const compressed = item.isFolder ? contents : deflateRawSync(contents, { level: 9 });
    const method = item.isFolder ? 0 : 8;
    const checksum = item.isFolder ? 0 : crc32(contents);
    const nameBytes = Buffer.from(name, "utf8");
    const { time, date } = dosDateTime(item.modified);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // file names are UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    entries.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made on Unix, so the permissions below count
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(contents.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    const permissions = item.isFolder ? 0o40755 : 0o100644;
    central.writeUInt32LE(((permissions << 16) | (item.isFolder ? 0x10 : 0)) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    directory.push(central, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }

  const directorySize = directory.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  const count = directory.length / 2;
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);

  await writeFile(zipFile, Buffer.concat([...entries, ...directory, end]));
}

interface FolderItem {
  path: string;
  isFolder: boolean;
  modified: Date;
}

/** Every file and folder inside, folders first, in a stable order. */
async function listItems(folder: string): Promise<FolderItem[]> {
  const items: FolderItem[] = [];
  const names = (await readdir(folder)).sort();
  for (const name of names) {
    const path = join(folder, name);
    const details = await stat(path);
    if (details.isDirectory()) {
      items.push({ path, isFolder: true, modified: details.mtime });
      items.push(...(await listItems(path)));
    } else {
      items.push({ path, isFolder: false, modified: details.mtime });
    }
  }
  return items;
}

function dosDateTime(moment: Date): { time: number; date: number } {
  const year = Math.max(moment.getFullYear(), 1980);
  return {
    time: (moment.getHours() << 11) | (moment.getMinutes() << 5) | (moment.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((moment.getMonth() + 1) << 5) | moment.getDate(),
  };
}
