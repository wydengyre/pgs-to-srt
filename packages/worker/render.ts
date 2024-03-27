// Copyright (C) 2023 Wyden and Gyre, LLC

export type { PacketOds };
export { expand, render, imageToLittleEndian };

type PacketOds = {
	width: number;
	height: number;
	data: Uint8Array;
};

type Image = {
	width: number;
	height: number;
	// note that this might screw up on big-endian systems
	rgba: Uint32Array;
};

function render(
	{ width, height, data }: PacketOds,
	palette: Uint32Array,
): Image {
	const imgData = new Uint32Array(width * height);
	let imgIndex = 0;

	const c0 = palette[0] as number;
	let i = 0;
	while (i < data.length) {
		const d1 = data[i] as number;
		i++;
		if (d1 !== 0) {
			imgData[imgIndex] = palette[d1] as number;
			imgIndex++;
			continue;
		}

		const d2 = data[i] as number;
		i++;
		if (d2 === 0) {
			// EOL marker. NOOP.
			continue;
		}

		if ((d2 & 0xc0) === 0) {
			for (let j = 0; j < d2; j++, imgIndex++) {
				imgData[imgIndex] = c0;
			}
			continue;
		}

		const d3 = data[i] as number;
		i++;
		if ((d2 & 0xc0) === 0x40) {
			const l = ((d2 & 0x3f) << 8) | d3;
			for (let j = 0; j < l; j++, imgIndex++) {
				imgData[imgIndex] = c0;
			}
			continue;
		}

		if ((d2 & 0xc0) === 0x80) {
			const l = d2 & 0x3f;
			const c = palette[d3] as number;
			for (let j = 0; j < l; j++, imgIndex++) {
				imgData[imgIndex] = c;
			}
			continue;
		}

		const d4 = data[i] as number;
		i++;
		const l = ((d2 & 0x3f) << 8) | d3;
		const c = palette[d4] as number;
		for (let j = 0; j < l; j++, imgIndex++) {
			imgData[imgIndex] = c;
		}
	}

	return { width, height, rgba: imgData };
}

function expand({ width, height, rgba }: Image): Image {
	const EXPAND_PIXELS = 50;
	const WHITE = 0xffffffff;

	const newHeight = height + 2 * EXPAND_PIXELS;
	const newWidth = width + 2 * EXPAND_PIXELS;
	const newData = new Uint32Array(newHeight * newWidth);

	// inefficient but dgaf
	for (let i = 0; i < newHeight; i++) {
		for (let j = 0; j < newWidth; j++) {
			newData[i * newWidth + j] = WHITE;
		}
	}

	for (let i = 0; i < height; i++) {
		for (let j = 0; j < width; j++) {
			newData[(i + EXPAND_PIXELS) * newWidth + j + EXPAND_PIXELS] = rgba[
				i * width + j
			] as number;
		}
	}
	return { width: newWidth, height: newHeight, rgba: newData };
}

// TODO: replace this with something that respects endianness
function imageToLittleEndian(image: Image): Uint8Array {
	const imageUint8 = new Uint8Array(image.width * image.height * 4);
	let outIndex = 0;
	for (let i = 0; i < image.height; i++) {
		for (let j = 0; j < image.width; j++) {
			const color = image.rgba[i * image.width + j] as number;
			imageUint8[outIndex++] = (color & 0xff000000) >>> 24;
			imageUint8[outIndex++] = (color & 0xff0000) >>> 16;
			imageUint8[outIndex++] = (color & 0xff00) >>> 8;
			imageUint8[outIndex++] = 0xff;
		}
	}
	return imageUint8;
}
