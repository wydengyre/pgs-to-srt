// Copyright (C) 2024 Wyden and Gyre, LLC
import { SegmentTypes } from "./parse.ts";
import { z } from "https://deno.land/x/zod/mod.ts";

export type Unrendered = {
  startTime: number;
  endTime: number;
  pds: Uint32Array;
  ods: PacketOds;
};

const pcsSchema = z.object({
  width: z.number(),
  height: z.number(),
  paletteId: z.number(),
  compositions: z.array(z.object({
    objectId: z.number(),
    windowId: z.number(),
    x: z.number(),
    y: z.number(),
    crop: z.number(),
  })),
});
type Pcs = z.infer<typeof pcsSchema>;

const pdsSchema = z.object({
  id: z.number(),
  palette: z.array(z.object({
    id: z.number(),
    y: z.number(),
    cr: z.number(),
    cb: z.number(),
    a: z.number(),
  })),
});
type Pds = z.infer<typeof pdsSchema>;
type PgsPalette = Pds["palette"];

const odsSchema = z.object({
  id: z.number(),
  lastInSequenceFlag: z.number(),
  dataLength: z.instanceof(Uint8Array),
  width: z.number(),
  height: z.number(),
  data: z.instanceof(Uint8Array),
});
export type Ods = z.infer<typeof odsSchema>;

const pgsSegmentSchema = z.object({
  header: z.object({
    currentOffset: z.number(),
    type: z.number(),
    pts: z.number(),
  }),
  body: z.unknown(),
}).passthrough();
export const pgsSchema = z.object({
  segment: z.array(pgsSegmentSchema),
});
type PgsSegment = z.infer<typeof pgsSegmentSchema>;

const $pcs = Symbol("pcs");
const $pds = Symbol("pds");
const $ods = Symbol("ods");
type Segment =
  & { currentOffset: number; pts: number }
  & (
    | ({ type: typeof $pcs } & Pcs)
    | ({ type: typeof $pds } & Pds)
    | ({ type: typeof $ods } & Ods)
  );

export type PacketOds = {
  width: number;
  height: number;
  data: Uint8Array;
};
export type Packet = z.infer<typeof pcsSchema> & {
  offset: number;
  startTime: number;
  endTime: number;
  pds: Map<number, Uint32Array>;
  ods: Map<number, PacketOds>;
};

const PALETTE_LENGTH = 255;
function mkRgbaPalette(p: PgsPalette, outlineFlag: string): Uint32Array {
  const out = new Uint32Array(PALETTE_LENGTH);
  for (const { id, y, cr, cb, a } of p) {
    out[id] = yCrCbAToRgba(y, cr, cb, a, outlineFlag);
  }
  return out;
}

function yCrCbAToRgba(y: number, cr: number, cb: number, a: number, outlineFlag: string): number {
  y -= 16.0;
  cb -= 128.0;
  cr -= 128.0;

  const y1 = y * 1.164383562;

  const rf = y1 + (cr * 1.792741071);
  const gf = y1 - (cr * 0.5329093286) - (cb * 0.2132486143);
  const bf = y1 + (cb * 2.112401786);

  //Clamp everything to black or white
  const r = (gf > 128) ? 255 : 0;
  const g = (gf > 128) ? 255 : 0;
  const b = (gf > 128) ? 255 : 0;

  //const r = clampRound(rf);
  //const g = clampRound(gf);
  //const b = clampRound(bf);

  let rtmp = 0;
  let gtmp = 0;
  let btmp = 0;
  // invert colors or don't
  if (outlineFlag == "outline") {
    rtmp = r;
    gtmp = g;
    btmp = b;
  }
  else {
    rtmp = 255 - r;
    gtmp = 255 - g;
    btmp = 255 - b;
  }

  const rInvert = rtmp;
  const gInvert = gtmp;
  const bInvert = btmp;

  // convert alpha channel to white
  const aPercent = (255 - a) / 255;

  let rwhitetmp = 0;
  let gwhitetmp = 0;
  let bwhitetmp = 0;

  if (outlineFlag == "outline") {
    rwhitetmp = clampRound(aPercent + rInvert);
    gwhitetmp = clampRound(aPercent + gInvert);
    bwhitetmp = clampRound(aPercent + bInvert);
  }
  else {
    rwhitetmp = clampRound(rInvert + ((255 - rInvert) * aPercent));
    gwhitetmp = clampRound(gInvert + ((255 - gInvert) * aPercent));
    bwhitetmp = clampRound(bInvert + ((255 - bInvert) * aPercent));
  }

  const rWhite = rwhitetmp;
  const gWhite = gwhitetmp;
  const bWhite = bwhitetmp;
  return ((rWhite & 0xff) << 24) | ((gWhite & 0xff) << 16) |
    ((bWhite & 0xff) << 8) | 0xff;
}

function clampRound(d: number): number {
  return Math.max(Math.min(Math.round(d), 255), 0);
}

export async function* iterOds(
  segs: AsyncIterable<Packet>,
): AsyncIterableIterator<Unrendered> {
  for await (const seg of segs) {
    const pds = seg.pds.get(seg.paletteId)!;
    const odss = seg.ods.values();
    for (const ods of odss) {
      yield { startTime: seg.startTime, endTime: seg.endTime, ods, pds };
    }
  }
}

export async function* packetize(
  segs: Iterable<PgsSegment>,
  outlineFlag: string,
): AsyncIterableIterator<Packet> {
  const schematized = schematize(segs);
  yield* packetizeSegments(schematized, outlineFlag);
}

async function* schematize(
  segs: Iterable<PgsSegment>,
): AsyncIterableIterator<Segment> {
  for (const { header, body } of segs) {
    const { currentOffset, pts } = header;
    switch (header.type) {
      case SegmentTypes.Pcs: {
        const pcs = await pcsSchema.parseAsync(body);
        yield { type: $pcs, currentOffset, pts, ...pcs };
        break;
      }
      case SegmentTypes.Pds: {
        const pds = await pdsSchema.parseAsync(body);
        yield { type: $pds, currentOffset, pts, ...pds };
        break;
      }
      case SegmentTypes.Ods: {
        const ods = await odsSchema.parseAsync(body);
        yield { type: $ods, currentOffset, pts, ...ods };
        break;
      }
        // ignore the rest
    }
  }
}

async function* packetizeSegments(
  segs: AsyncIterable<Segment>,
  outlineFlag: string,
): AsyncIterableIterator<Packet> {
  let currentSegment: Packet | null = null;
  for await (const seg of segs) {
    const { currentOffset, pts } = seg;

    if (currentSegment !== null) {
      if (pts < currentSegment.startTime) {
        currentSegment.startTime = pts;
      }
      if (pts > currentSegment.endTime) {
        currentSegment.endTime = pts;
      }
    }

    switch (seg.type) {
      case $pcs: {
        if (currentSegment !== null) {
          yield currentSegment;
        }
        currentSegment = {
          offset: currentOffset,
          startTime: pts,
          endTime: pts,
          width: seg.width,
          height: seg.height,
          paletteId: seg.paletteId,
          compositions: seg.compositions,
          pds: new Map(),
          ods: new Map(),
        };
        break;
      }
      case $pds: {
        const rgbaPalette = mkRgbaPalette(seg.palette, outlineFlag);
        currentSegment!.pds.set(seg.id, rgbaPalette);
        break;
      }
      case $ods: {
        if (!(seg.lastInSequenceFlag & 0x80)) {
          // not first in sequence: we're adding more data to a previous ODS
          const ods = currentSegment!.ods.get(seg.id)!;
          // sadly our parser doesn't support conditions
          ods.data = new Uint8Array([
            ...ods.data,
            ...seg.dataLength,
            seg.width >> 8,
            seg.width & 0xff,
            seg.height >> 8,
            seg.height & 0xff,
            ...seg.data]);
          break;
        }

        const ods = {
          width: seg.width,
          height: seg.height,
          data: seg.data,
        };

        currentSegment!.ods.set(seg.id, ods);
        break;
      }
    }
  }
  return null;
}

