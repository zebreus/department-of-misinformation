import {
  Accept,
  createFederation,
  exportJwk,
  Federation,
  Follow,
  generateCryptoKeyPair,
  importJwk,
  Person,
  Undo,
} from "@fedify/fedify";
import { DenoKvStore } from "@fedify/fedify/x/denokv";
import { configure, getConsoleSink } from "@logtape/logtape";
import { behindProxy } from "@hongminhee/x-forwarded-fetch";
import { MainPage } from "./pages/MainPage.tsx";

const kv = await Deno.openKv();

await configure({
  sinks: { console: getConsoleSink() },
  filters: {},
  loggers: [{ category: "fedify", sinks: ["console"], level: "info" }],
});

const federation = createFederation<void>({
  kv: new DenoKvStore(kv),
});

const getRsaKeypair = async (handle: string) => {
  const entry = await kv.get<{
    privateKey: JsonWebKey;
    publicKey: JsonWebKey;
  }>(["keys", handle, "rsa"]);

  if (entry?.value == null) {
    // Generate a new key pair at the first time:
    const cryptoKey = await generateCryptoKeyPair(
      "RSASSA-PKCS1-v1_5",
    );
    await kv.set(["keys", handle, "rsa"], {
      privateKey: await exportJwk(cryptoKey.privateKey),
      publicKey: await exportJwk(cryptoKey.publicKey),
    });
    return cryptoKey;
  }

  const privateKey = await importJwk(entry.value.privateKey, "private");
  const publicKey = await importJwk(entry.value.publicKey, "public");
  return { privateKey, publicKey };
};

const getEd25519Keypair = async (handle: string) => {
  const entry = await kv.get<{
    privateKey: JsonWebKey;
    publicKey: JsonWebKey;
  }>(["keys", handle, "ed25519"]);

  if (entry?.value == null) {
    // Generate a new key pair at the first time:
    const cryptoKey = await generateCryptoKeyPair(
      "Ed25519",
    );
    await kv.set(["keys", handle, "ed25519"], {
      privateKey: await exportJwk(cryptoKey.privateKey),
      publicKey: await exportJwk(cryptoKey.publicKey),
    });
    return cryptoKey;
  }

  const privateKey = await importJwk(entry.value.privateKey, "private");
  const publicKey = await importJwk(entry.value.publicKey, "public");
  return { privateKey, publicKey };
};

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
        (keyPair) => keyPair.cryptographicKey,
      ),
    });
  })
  .setKeyPairsDispatcher(async (ctx, handle) => {
    if (handle != "me") return []; // Other than "me" is not found.
    const rsaKeys = await getRsaKeypair(handle);
    const ed25519Keys = await getEd25519Keypair(handle);
    return [ed25519Keys, rsaKeys];
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
      new Accept({ actor: follow.objectId, object: follow }),
    );
    await kv.set(["followers", follow.id.href], follow.actorId.href);
  })
  .on(Undo, async (ctx, follow) => {
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
      new Accept({ actor: follow.objectId, object: follow }),
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
      return new Response(MainPage({ followers }).value, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return federation.fetch(request, { contextData: undefined });
  }),
);
