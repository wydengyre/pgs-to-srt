import { Buffer } from "std/io/buffer.ts";
import { assertEquals } from "std/testing/asserts.ts";
// Copyright (C) 2023 Wyden and Gyre, LLC
import { render } from "./progress.ts";

Deno.test("renderToStream", async () => {
	const buf = new Buffer();
	const testProgress = {
		completed: 11,
		total: 20,
	};
	const expectedStr =
		"\r[############################                      ] 11/20";
	const expected = new TextEncoder().encode(expectedStr);
	await render(buf, testProgress);
	const got = buf.bytes({ copy: false });
	assertEquals(got, expected);
});
