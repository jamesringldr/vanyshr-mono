/** Summary-page URLs for the intro scan. No fetch — URL construction only. */

const STATE_NAMES: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas",
  CA: "california", CO: "colorado", CT: "connecticut", DE: "delaware",
  DC: "district-of-columbia", FL: "florida", GA: "georgia", HI: "hawaii",
  ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine",
  MD: "maryland", MA: "massachusetts", MI: "michigan", MN: "minnesota",
  MS: "mississippi", MO: "missouri", MT: "montana", NE: "nebraska",
  NV: "nevada", NH: "new-hampshire", NJ: "new-jersey", NM: "new-mexico",
  NY: "new-york", NC: "north-carolina", ND: "north-dakota", OH: "ohio",
  OK: "oklahoma", OR: "oregon", PA: "pennsylvania", RI: "rhode-island",
  SC: "south-carolina", SD: "south-dakota", TN: "tennessee", TX: "texas",
  UT: "utah", VT: "vermont", VA: "virginia", WA: "washington",
  WV: "west-virginia", WI: "wisconsin", WY: "wyoming",
};

function slug(value: string): string {
  return value.toLowerCase().replace(/'/g, "").replace(/\s+/g, "-");
}

export type SummarySearch = {
  first_name: string;
  last_name: string;
  city: string;
  state: string;
};

export function buildSummaryUrls(input: SummarySearch): Record<string, string> {
  const first = input.first_name.toLowerCase().replace(/'/g, "");
  const last = input.last_name.toLowerCase().replace(/'/g, "");
  const city = slug(input.city);
  const stateAbbr = input.state.trim().length === 2
    ? input.state.trim().toLowerCase()
    : (input.state.trim().slice(0, 2).toLowerCase());
  const stateName = STATE_NAMES[input.state.toUpperCase()] || slug(input.state);
  return {
    zaba: `https://www.zabasearch.com/people/${slug(input.first_name)}-${slug(input.last_name)}/${stateName}/${city}`,
    fps: `https://www.fastpeoplesearch.com/name/${first}-${last}_${city}-${stateAbbr}`,
    npd: `https://nationalpublicdata.com/people/${last[0]}/${first}-${last}/${stateAbbr}/${city}/`,
    anywho: `https://www.anywho.com/people/${first}+${last}/${stateName}/${city}`,
  };
}
