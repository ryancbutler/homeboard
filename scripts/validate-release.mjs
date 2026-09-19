import { readFileSync } from "node:fs";

const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const lockVersion = JSON.parse(readFileSync("package-lock.json", "utf8")).version;
const chart = readFileSync("helm/homeboard/Chart.yaml", "utf8");
const values = readFileSync("helm/homeboard/values.yaml", "utf8");

const field = (contents, name) => {
  const match = contents.match(new RegExp(`^\\s*${name}:\\s*[\"']?([^\"'\\s#]+)`, "m"));
  if (!match) throw new Error(`Could not read ${name}.`);
  return match[1];
};

const expected = {
  "package-lock.json version": packageVersion,
  "Chart.yaml version": packageVersion,
  "Chart.yaml appVersion": packageVersion,
  "values.yaml image tag": `v${packageVersion}`,
};
const actual = {
  "package-lock.json version": lockVersion,
  "Chart.yaml version": field(chart, "version"),
  "Chart.yaml appVersion": field(chart, "appVersion"),
  "values.yaml image tag": field(values, "tag"),
};
const mismatches = Object.entries(expected)
  .filter(([name, value]) => actual[name] !== value)
  .map(([name, value]) => `${name}: expected ${value}, found ${actual[name]}`);

if (mismatches.length) throw new Error(mismatches.join("\n"));
