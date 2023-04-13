// Copyright (C) 2023 Wyden and Gyre, LLC
// hacked together from https://github.com/wydengyre/bitmap

import { Buffer } from "node:buffer";

class BitmapEncoder {
  buffer: Buffer;
  width: number;
  height: number;
  extraBytes: number;
  rgbSize: number;
  headerInfoSize: number;
  data: any[];
  flag: string;
  reserved: number;
  offset: number;
  fileSize: number;
  planes: number;
  bitPP: number;
  compress: number;
  hr: number;
  vr: number;
  colors: number;
  importantColors: number;
  pos!: number;

  constructor(imgData: any) {
    this.buffer = imgData.data;
    this.width = imgData.width;
    this.height = imgData.height;
    this.extraBytes = this.width % 4;
    this.rgbSize = this.height * (3 * this.width + this.extraBytes);
    this.headerInfoSize = 40;
    this.data = [];
    this.flag = "BM";
    this.reserved = 0;
    this.offset = 54;
    this.fileSize = this.rgbSize + this.offset;
    this.planes = 1;
    this.bitPP = 24;
    this.compress = 0;
    this.hr = 0;
    this.vr = 0;
    this.colors = 0;
    this.importantColors = 0;
  }

  encode() {
    var tempBuffer = new Buffer(this.offset + this.rgbSize);
    this.pos = 0;
    tempBuffer.write(this.flag, this.pos, 2);
    this.pos += 2;
    tempBuffer.writeUInt32LE(this.fileSize, this.pos);
    this.pos += 4;
    tempBuffer.writeUInt32LE(this.reserved, this.pos);
    this.pos += 4;
    tempBuffer.writeUInt32LE(this.offset, this.pos);
    this.pos += 4;

    tempBuffer.writeUInt32LE(this.headerInfoSize, this.pos);
    this.pos += 4;
    tempBuffer.writeUInt32LE(this.width, this.pos);
    this.pos += 4;
    tempBuffer.writeInt32LE(-this.height, this.pos);
    this.pos += 4;
    tempBuffer.writeUInt16LE(this.planes, this.pos);
    this.pos += 2;
    tempBuffer.writeUInt16LE(this.bitPP, this.pos);
    this.pos += 2;
    tempBuffer.writeUInt32LE(this.compress, this.pos);
    this.pos += 4;
    tempBuffer.writeUInt32LE(this.rgbSize, this.pos);
    this.pos += 4;
    tempBuffer.writeUInt32LE(this.hr, this.pos);
    this.pos += 4;
    tempBuffer.writeUInt32LE(this.vr, this.pos);
    this.pos += 4;
    tempBuffer.writeUInt32LE(this.colors, this.pos);
    this.pos += 4;
    tempBuffer.writeUInt32LE(this.importantColors, this.pos);
    this.pos += 4;

    var i = 0;
    var rowBytes = 3 * this.width + this.extraBytes;

    for (var y = 0; y < this.height; y++) {
      for (var x = 0; x < this.width; x++) {
        var p = this.pos + y * rowBytes + x * 3;
        i++;
        tempBuffer[p] = this.buffer[i++];
        tempBuffer[p + 1] = this.buffer[i++];
        tempBuffer[p + 2] = this.buffer[i++];
      }
      if (this.extraBytes > 0) {
        var fillOffset = this.pos + y * rowBytes + this.width * 3;
        tempBuffer.fill(0, fillOffset, fillOffset + this.extraBytes);
      }
    }

    return tempBuffer;
  }
}

export interface imageData {
  /** Image bitmap data */
  data: Buffer;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
}

/**
 * Bitmap Encoder
 * @param imgData Image data
 * @param _quality Quality (ignored for now)
 */
function Encoder(imgData: imageData, _quality?: number): imageData {
  const encoder = new BitmapEncoder(imgData);
  const data = encoder.encode();

  return {
    data: data,
    width: imgData.width,
    height: imgData.height,
  };
}

export { Buffer as BitmapBufferAPI, Encoder };
