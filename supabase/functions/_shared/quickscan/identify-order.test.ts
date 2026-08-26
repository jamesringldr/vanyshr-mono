/**
 * Run: deno test supabase/functions/_shared/quickscan/identify-order.test.ts
 */
import {
  FIRST_IDENTIFY_BROKER,
  IDENTIFY_ORDER,
  firstNonEmptyIdentifyList,
  isIdentifyBroker,
  nextIdentifyBroker,
} from "./identify-order.ts";

Deno.test("order is FPS then AnyWho then Zaba then NPD", () => {
  if (IDENTIFY_ORDER.join(",") !== "fps,anywho,zaba,npd") {
    throw new Error(`order ${IDENTIFY_ORDER.join(",")} — expected fps,anywho,zaba,npd`);
  }
  if (FIRST_IDENTIFY_BROKER !== "fps") throw new Error("first broker must be fps");
});

Deno.test("nextIdentifyBroker walks and then stops", () => {
  if (nextIdentifyBroker("fps") !== "anywho") throw new Error("fps -> anywho");
  if (nextIdentifyBroker("anywho") !== "zaba") throw new Error("anywho -> zaba");
  if (nextIdentifyBroker("zaba") !== "npd") throw new Error("zaba -> npd");
  if (nextIdentifyBroker("npd") !== null) throw new Error("npd is last");
});

Deno.test("isIdentifyBroker rejects unknown names", () => {
  if (!isIdentifyBroker("fps") || !isIdentifyBroker("npd")) throw new Error("known brokers");
  if (isIdentifyBroker("spokeo") || isIdentifyBroker("")) throw new Error("unknown should fail");
});

Deno.test("firstNonEmptyIdentifyList prefers FPS even when others are ready", () => {
  const listed = firstNonEmptyIdentifyList(
    { fps: ["a"], anywho: ["b"], zaba: ["c"] },
    true,
  );
  if (listed.broker !== "fps" || listed.candidates[0] !== "a") {
    throw new Error(`got ${listed.broker} ${listed.candidates}`);
  }
});

Deno.test("empty FPS before background complete is notReady, not a skip", () => {
  const listed = firstNonEmptyIdentifyList({ fps: [], anywho: ["b"] }, false);
  if (!listed.notReady || listed.broker !== "fps") {
    throw new Error("must wait for others rather than skip to anywho");
  }
});

Deno.test("empty FPS after complete falls through AnyWho then Zaba then NPD", () => {
  const anywho = firstNonEmptyIdentifyList({ fps: [], anywho: ["b"], zaba: ["c"] }, true);
  if (anywho.broker !== "anywho") throw new Error(`expected anywho, got ${anywho.broker}`);

  const zaba = firstNonEmptyIdentifyList({ fps: [], anywho: [], zaba: ["c"] }, true);
  if (zaba.broker !== "zaba") throw new Error(`expected zaba, got ${zaba.broker}`);

  const npd = firstNonEmptyIdentifyList({ fps: [], anywho: [], zaba: [], npd: ["d"] }, true);
  if (npd.broker !== "npd") throw new Error(`expected npd, got ${npd.broker}`);
});

Deno.test("all empty after complete returns FPS with no candidates", () => {
  const listed = firstNonEmptyIdentifyList({ fps: [], anywho: [], zaba: [], npd: [] }, true);
  if (listed.broker !== "fps" || listed.candidates.length !== 0 || listed.notReady) {
    throw new Error(`got ${JSON.stringify(listed)}`);
  }
});
