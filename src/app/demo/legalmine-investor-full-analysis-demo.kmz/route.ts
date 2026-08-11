import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const FILE_NAME = "doc.kml";

export async function GET() {
  const kml = await readFile(join(process.cwd(), "public", "demo", "legalmine-investor-concession-demo.kml"));
  const zip = makeStoredZip(FILE_NAME, kml);
  const body = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.google-earth.kmz",
      "Content-Disposition": 'attachment; filename="legalmine-investor-full-analysis-demo.kmz"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function makeStoredZip(filename: string, content: Uint8Array): Uint8Array {
  const name = new TextEncoder().encode(filename);
  const crc = crc32(content);
  const localHeader = new Uint8Array(30 + name.length);
  const centralHeader = new Uint8Array(46 + name.length);
  const end = new Uint8Array(22);
  const totalSize = localHeader.length + content.length + centralHeader.length + end.length;
  const out = new Uint8Array(totalSize);

  writeLocalHeader(localHeader, name, crc, content.length);
  writeCentralHeader(centralHeader, name, crc, content.length, 0);
  writeEndRecord(end, centralHeader.length, localHeader.length + content.length);

  let offset = 0;
  out.set(localHeader, offset);
  offset += localHeader.length;
  out.set(content, offset);
  offset += content.length;
  out.set(centralHeader, offset);
  offset += centralHeader.length;
  out.set(end, offset);
  return out;
}

function writeLocalHeader(buffer: Uint8Array, name: Uint8Array, crc: number, size: number) {
  const view = new DataView(buffer.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true);
  buffer.set(name, 30);
}

function writeCentralHeader(buffer: Uint8Array, name: Uint8Array, crc: number, size: number, localOffset: number) {
  const view = new DataView(buffer.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localOffset, true);
  buffer.set(name, 46);
}

function writeEndRecord(buffer: Uint8Array, centralSize: number, centralOffset: number) {
  const view = new DataView(buffer.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 1, true);
  view.setUint16(10, 1, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
