// Copyright (C) 2024 Wyden and Gyre, LLC

// a script used for fetching Tesserract language files
import { iso6393 } from "iso6393";
import { fromFileUrl } from "std/path/mod.ts";

type Language = (typeof iso6393)[number]["name"];

const traineddataPath = fromFileUrl(import.meta.resolve("../tessdata_fast"));

if (import.meta.main) {
	await main();
}

async function main() {
	const tessLangs = await getTessFastDataLanguages();
	tessLangs.sort();
	// TODO: manually pick through these

	const htmlOptions = tessLangs.map(
		([lang, trainedDataFile]) =>
			`<option value="${trainedDataFile}">${lang}</option>`,
	);
	console.log(htmlOptions.join("\n"));
}

async function getTessFastDataLanguages(): Promise<[string, string][]> {
	const trainedData = await Deno.readDir(traineddataPath);
	const trainedDataNames = [];
	for await (const dirEntry of trainedData) {
		trainedDataNames.push(dirEntry.name);
	}

	const languageCodeTable: Map<string, Language> = new Map(
		iso6393.map(({ name, iso6393 }) => [iso6393, name]),
	);
	const TRAINED_DATA_RE = /^([a-z]{3})\.traineddata$/;

	const languageTrainedData = trainedDataNames.filter((name) =>
		languageCodeTable.has(TRAINED_DATA_RE.exec(name)?.[1]!),
	);

	// annoying to have to use ! when this should have been refined above
	return languageTrainedData.map((path) => [
		languageCodeTable.get(TRAINED_DATA_RE.exec(path!)?.[1]!)!,
		path,
	]);
}
