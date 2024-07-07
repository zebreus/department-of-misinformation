import {
  Accept,
  Federation,
  Follow,
  Person,
  createFederation,
  exportJwk,
  generateCryptoKeyPair,
  importJwk,
} from "@fedify/fedify";
import { DenoKvStore } from "@fedify/fedify/x/denokv";
import { configure, getConsoleSink } from "@logtape/logtape";
import { behindProxy } from "@hongminhee/x-forwarded-fetch";

const kv = await Deno.openKv();

await configure({
  sinks: { console: getConsoleSink() },
  filters: {},
  loggers: [{ category: "fedify", sinks: ["console"], level: "info" }],
});

const federation = createFederation<void>({
  kv: new DenoKvStore(kv),
});

federation
  .setActorDispatcher("/users/{handle}", async (ctx, handle) => {
    if (handle !== "me") return null;
    return new Person({
      id: ctx.getActorUri(handle),
      name: "Me",
      summary: "This is me!",
      preferredUsername: handle,
      url: new URL("/", ctx.url),
      inbox: ctx.getInboxUri(handle),
      // The public keys of the actor; they are provided by the key pairs
      // dispatcher we define below:
      publicKeys: (await ctx.getActorKeyPairs(handle)).map(
        (keyPair) => keyPair.cryptographicKey
      ),
    });
  })
  .setKeyPairsDispatcher(async (ctx, handle) => {
    if (handle != "me") return []; // Other than "me" is not found.
    const entry = await kv.get<{
      privateKey: JsonWebKey;
      publicKey: JsonWebKey;
    }>(["keys", handle]);
    if (entry == null || entry.value == null) {
      // Generate a new key pair at the first time:
      const { privateKey, publicKey } = await generateCryptoKeyPair(
        "RSASSA-PKCS1-v1_5"
      );
      // Store the generated key pair to the Deno KV database in JWK format:
      await kv.set(["keys", handle], {
        privateKey: await exportJwk(privateKey),
        publicKey: await exportJwk(publicKey),
      });
      return [{ privateKey, publicKey }];
    }
    // Load the key pair from the Deno KV database:
    const privateKey = await importJwk(entry.value.privateKey, "private");
    const publicKey = await importJwk(entry.value.publicKey, "public");
    return [{ privateKey, publicKey }];
  });

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (
      follow.id == null ||
      follow.actorId == null ||
      follow.objectId == null
    ) {
      return;
    }
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor" || parsed.handle !== "me") return;
    const follower = await follow.getActor(ctx);
    if (follower == null) return;
    console.debug(follower);

    await ctx.sendActivity(
      { handle: parsed.handle },
      follower,
      new Accept({ actor: follow.objectId, object: follow })
    );
    await kv.set(["followers", follow.id.href], follow.actorId.href);
  });

Deno.serve(
  behindProxy(async (request) => {
    const url = new URL(request.url);
    // The home page:
    if (url.pathname === "/") {
      const followers: string[] = [];
      for await (const entry of kv.list<string>({ prefix: ["followers"] })) {
        if (followers.includes(entry.value)) continue;
        followers.push(entry.value);
      }
      return new Response(`<ul>${followers.map((f) => `<li>${f}</li>`)}</ul>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return federation.fetch(request, { contextData: undefined });
  })
);
