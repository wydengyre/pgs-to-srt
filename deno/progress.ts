// Copyright (C) 2023 Wyden and Gyre, LLC
import { writeAll } from "std/streams/conversion.ts";

export type Progress = {
  completed: number;
  total: number;
};

export async function render(
  w: Deno.Writer,
  p: Progress,
): Promise<void> {
  const rendered = renderStr(p);
  const te = new TextEncoder();
  const bytes = te.encode(`\r${rendered}`);
  await writeAll(w, bytes);
}

function renderStr({ completed, total }: Progress): string {
  const COMPLETION_CHAR = "#";
  const TOTAL_CHARS = 50;

  const percentComplete = completed / total;
  const completionCharCount = Math.round(percentComplete * TOTAL_CHARS);
  const spaceCount = TOTAL_CHARS - completionCharCount;

  const completionChars = COMPLETION_CHAR.repeat(completionCharCount);
  const spaces = " ".repeat(spaceCount);
  return `[${completionChars}${spaces}] ${completed}/${total}`;
}
