/// <reference types="binary-parser/dist/esm/binary_parser.d.ts" />
import { Parser } from "binary-parser";

// http://blog.thescorpius.com/index.php/2017/07/15/presentation-graphic-stream-sup-files-bluray-subtitle-format/

export const PGS_MAGIC = 0x5047;

const header = new Parser()
	.saveOffset("currentOffset")
	.uint16("magic", { assert: PGS_MAGIC })
	.uint32("pts")
	.uint32("dts")
	.uint8("type")
	.uint16("size");

const FORCE_DISPLAY = 0x40;
const pcs = new Parser()
	.uint16("width")
	.uint16("height")
	.uint8("framerate")
	.uint16("compositionNumber")
	.uint8("compositionState")
	.uint8("paletteUpdateFlag")
	.uint8("paletteId")
	.uint8("count")
	.array("compositions", {
		length: function (this: { count: number }) {
			return this.count;
		},
		type: new Parser()
			.uint16("objectId")
			.uint8("windowId")
			.uint8("crop")
			.uint16("x")
			.uint16("y")
			.array("cropping", {
				length: function (this: { croppedFlag: number }) {
					return this.croppedFlag === FORCE_DISPLAY ? 1 : 0;
				},
				type: new Parser()
					.uint16("horizontalPosition")
					.uint16("verticalPosition")
					.uint16("width")
					.uint16("height"),
			}),
	});

const wds = new Parser().uint8("count").array("window", {
	length: function (this: { count: number }) {
		return this.count;
	},
	type: new Parser()
		.uint8("id")
		.uint16("x")
		.uint16("y")
		.uint16("width")
		.uint16("height"),
});

const pds = new Parser()
	.uint8("id")
	.skip(1) // version number unused
	.array("palette", {
		lengthInBytes: function (this: { $parent: { header: { size: number } } }) {
			return this.$parent.header.size - 2;
		},
		type: new Parser()
			.uint8("id")
			.uint8("y")
			.uint8("cr")
			.uint8("cb")
			.uint8("a"),
	});

const ods = new Parser()
	.uint16("id")
	.skip(1) // version number is unused
	.uint8("lastInSequenceFlag")
	.buffer("dataLength", { length: 3 })
	.uint16("width")
	.uint16("height")
	.buffer("data", {
		length: function (this: { $parent: { header: { size: number } } }) {
			return this.$parent.header.size - 11;
		},
	});

const end = new Parser(); // noop

export const SegmentTypes = {
	Pds: 0x14,
	Ods: 0x15,
	Pcs: 0x16,
	Wds: 0x17,
	End: 0x80,
} as const;

const segment = new Parser().nest("header", { type: header }).choice("body", {
	tag: function (this: { header: { type: number } }): number {
		return this.header.type;
	},
	choices: {
		[SegmentTypes.Pds]: pds,
		[SegmentTypes.Ods]: ods,
		[SegmentTypes.Pcs]: pcs,
		[SegmentTypes.Wds]: wds,
		[SegmentTypes.End]: end,
	},
});

const pgs = new Parser()
	.useContextVars() // needed for palette
	.endianess("big")
	.array("segment", { type: segment, readUntil: "eof" });

export function parse(data: Uint8Array): unknown {
	return pgs.parse(data);
}
