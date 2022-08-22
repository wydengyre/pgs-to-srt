// Copyright (C) 2022 Wyden and Gyre, LLC
export async function* enumerate<T>(
  es: AsyncIterable<T>,
): AsyncIterable<[number, T]> {
  let i = 0;
  for await (const e of es) {
    yield [i, e];
    i++;
  }
}
