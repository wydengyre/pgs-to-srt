// Copyright (C) 2023 Wyden and Gyre, LLC
import { Subtitle } from "./ocr.ts";
import { enumerate } from "./stream.ts";

// returns subtitle numbers of blanks;
export async function* srt(
  subs: AsyncIterable<Subtitle>,
): AsyncGenerator<string, number[]> {
  const blanks: number[] = [];

  for await (const [count, { startTime, endTime, text }] of enumerate(subs)) {
    const completed = count + 1;
    yield `${completed}
${formatTime(startTime)} --> ${formatTime(endTime)}
${text}`;
    if (text === "") {
      blanks.push(completed);
    }
  }

  return blanks;
}

function formatTime(ms: number): string {
  const roundedMs = Math.round(ms);
  const outMs = (roundedMs % 1000).toString().padStart(2, "0");
  const outS = (Math.trunc(roundedMs / 1000) % 60).toString().padStart(2, "0");
  const outM = (Math.trunc(roundedMs / (1000 * 60)) % 60).toString().padStart(
    2,
    "0",
  );
  const outH = Math.trunc(roundedMs / (1000 * 60 * 60)).toString().padStart(
    2,
    "0",
  );
  return `${outH}:${outM}:${outS},${outMs}`;
}
