import { createFederation } from "@fedify/fedify";
import { DenoKvMessageQueue, DenoKvStore } from "@fedify/fedify/x/denokv";
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

export const kv = await Deno.openKv("./kv.sqlite");

await configure({
    sinks: { console: getConsoleSink() },
    filters: {},
    loggers: [{ category: "fedify", sinks: ["console"], level: "debug" }, {
        category: "misinformation",
        sinks: ["console"],
        level: "debug",
    }],
});

export const activityLogger = getLogger(["misinformation", "activity"]);
export const debugLogger = getLogger(["misinformation", "debug"]);

export const federation = createFederation<void>({
    kv: new DenoKvStore(kv),
    queue: new DenoKvMessageQueue(kv),
});
