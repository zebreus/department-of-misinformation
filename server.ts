import {
  Accept,
  Actor,
  Context,
  Create,
  createFederation,
  Endpoints,
  exportJwk,
  Follow,
  generateCryptoKeyPair,
  importJwk,
  isActor,
  lookupObject,
  Note,
  Person,
  PUBLIC_COLLECTION,
  Reject,
  RequestContext,
  Undo,
} from "@fedify/fedify";
import { DenoKvMessageQueue, DenoKvStore } from "@fedify/fedify/x/denokv";
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { behindProxy } from "@hongminhee/x-forwarded-fetch";
import { MainPage } from "./pages/MainPage.tsx";
import { satisfies } from "jsr:@std/semver@^0.224.3/satisfies";
import { generateId } from "./helpers/generateId.ts";

const userName = "me1";

const kv = await Deno.openKv("./kv.sqlite");

await configure({
  sinks: { console: getConsoleSink() },
  filters: {},
  loggers: [{ category: "fedify", sinks: ["console"], level: "debug" }, {
    category: "misinformation",
    sinks: ["console"],
    level: "debug",
  }],
});

const activityLogger = getLogger(["misinformation", "activity"]);
const debugLogger = getLogger(["misinformation", "debug"]);

const federation = createFederation<void>({
  kv: new DenoKvStore(kv),
  queue: new DenoKvMessageQueue(kv),
});

const getFollowers = async (handle: string) => {
  // Work with the database to find the actors that are following the actor
  // (the below `getFollowersByUserHandle` is a hypothetical function):
  const followers: Actor[] = [];
  for await (
    const entry of kv.list<string>({ prefix: ["followers", handle] })
  ) {
    // if (followers.includes(entry.value)) continue;
    const actor = await lookupObject(entry.value);
    if (!isActor(actor)) {
      throw new Error(`object ${actor} is not an actor`);
    }
    if (!actor) {
      continue;
    }
    followers.push(actor);
  }
  return followers;
};

const getFollowersIds = async (handle: string) => {
  // Work with the database to find the actors that are following the actor
  // (the below `getFollowersByUserHandle` is a hypothetical function):
  const followers: string[] = [];
  for await (
    const entry of kv.list<string>({ prefix: ["followers", handle] })
  ) {
    if (followers.includes(entry.value)) continue;
    followers.push(entry.value);
  }
  return followers;
};

type DatabaseNote = {
  content: string;
  time: number;
  to: URL[];
};

const createNote = async (
  ctx: Context<void>,
  handle: string,
  content: string,
) => {
  const followers = await getFollowers(handle);
  const followerUrls = followers.flatMap((f) => f.id ? [new URL(f.id)] : []);
  console.debug(followers);
  const time = Temporal.Instant.fromEpochMilliseconds(Date.now());
  const id = generateId();
  const noteUrl = new URL(ctx.getActorUri(handle) + `/notes/${id}`);
  const createUrl = new URL(ctx.getActorUri(handle) + `/notes/${id}/activity`);
  const realContent = `<p>${content}</p>`;
  kv.set(
    ["notes", handle, id],
    {
      time: time.epochMilliseconds,
      content: realContent,
      to: followerUrls,
    } satisfies DatabaseNote,
  );

  const note = new Note({
    "summary": null,
    replyTarget: null,
    "published": time,
    "ccs": [],
    "sensitive": false,
    "url": noteUrl,
    id: noteUrl,
    attribution: ctx.getActorUri(handle),
    to: PUBLIC_COLLECTION,
    content: realContent,
  });
  const create = new Create({
    id: createUrl,
    actor: ctx.getActorUri(handle),
    to: PUBLIC_COLLECTION,
    published: time,
    object: note,
  });
  console.debug(await create.toJsonLd());
  await ctx.sendActivity(
    { handle: handle },
    followers,
    create,
  );
  activityLogger.info(`@${handle} posted: ${content}`);
};

const getOldKeypair = async (handle: string) => {
  const entry = await kv.get<{
    privateKey: JsonWebKey;
    publicKey: JsonWebKey;
  }>(["keys", handle]);

  if (entry?.value == null) {
    throw new Error("No old keypair found");
  }

  const privateKey = await importJwk(entry.value.privateKey, "private");
  const publicKey = await importJwk(entry.value.publicKey, "public");
  return { privateKey, publicKey };
};

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
  .setFollowersDispatcher(
    "/users/{handle}/followers",
    async (ctx, handle, cursor, baseUri) => {
      // Work with the database to find the actors that are following the actor
      // (the below `getFollowersByUserHandle` is a hypothetical function):
      const followers: Actor[] = [];
      for await (
        const entry of kv.list<string>({ prefix: ["followers", handle] })
      ) {
        // if (followers.includes(entry.value)) continue;
        const actor = await ctx.getActor(entry.value);
        if (!actor) {
          continue;
        }
        followers.push(actor);
      }

      // // Filter the actors by the base URI:
      // if (baseUri != null) {
      //   users = users.filter((actor) =>
      //     actor.uri.href.startsWith(baseUri.href)
      //   );
      // }
      // // Turn the users into `URL` objects:
      // const items = users.map((actor) => actor.uri);
      return { items: followers };
    },
  );

federation
  .setActorDispatcher("/users/{handle}", async (ctx, handle) => {
    if (handle !== userName) return null;
    const id = ctx.getActorUri(handle);
    return new Person({
      // User ID stuff

      // id?: URL | null;
      id: id,
      // url?: URL | Link | null;
      url: new URL("/", ctx.url),
      // urls?: ((URL | Link))[];

      // User info

      // name?: string | LanguageString | null;
      name: "Cooler Test User",
      // names?: ((string | LanguageString))[];
      // preferredUsername?: string | LanguageString | null;
      preferredUsername: handle,
      // preferredUsernames?: ((string | LanguageString))[];
      // summary?: string | LanguageString | null;
      summary: "This is me!",
      // summaries?: ((string | LanguageString))[];

      // Crypto stuff

      // publicKey?: CryptographicKey | URL | null;
      // publicKeys?: (CryptographicKey | URL)[];
      // The public keys of the actor; they are provided by the key pairs
      // dispatcher we define below:
      publicKeys: (await ctx.getActorKeyPairs(handle)).map(
        (keyPair) => keyPair.cryptographicKey,
      ),
      // assertionMethod?: Multikey | URL | null;
      // assertionMethods?: (Multikey | URL)[];
      // Assertion methods is newer than publickeys, idk
      assertionMethods: (await ctx.getActorKeyPairs(handle)).map(
        (keyPair) => keyPair.multikey,
      ),

      // attachments?: (Object | Link | PropertyValue | URL)[];
      // attribution?:
      //   | Application
      //   | Group
      //   | Organization
      //   | Person
      //   | Service
      //   | URL
      //   | null;
      // attributions?:
      //   (Application | Group | Organization | Person | Service | URL)[];
      // audience?: Object | URL | null;
      // audiences?: (Object | URL)[];
      // content?: string | LanguageString | null;
      // contents?: ((string | LanguageString))[];
      // contexts?: (Object | Link | URL)[];
      // endTime?: Temporal.Instant | null;
      // generators?: (Object | Link | URL)[];
      // icon?: Image | URL | null;
      // icons?: (Image | URL)[];
      // image?: Image | URL | null;
      // images?: (Image | URL)[];
      // replyTarget?: Object | Link | URL | null;
      // replyTargets?: (Object | Link | URL)[];
      // location?: Object | Link | URL | null;
      // locations?: (Object | Link | URL)[];
      // preview?: Link | Object | URL | null;
      // previews?: (Link | Object | URL)[];
      // published?: Temporal.Instant | null;
      // replies?: Collection | URL | null;
      // startTime?: Temporal.Instant | null;
      // tags?: (Object | Link | URL)[];
      // updated?: Temporal.Instant | null;
      // to?: Object | URL | null;
      // tos?: (Object | URL)[];
      // bto?: Object | URL | null;
      // btos?: (Object | URL)[];
      // cc?: Object | URL | null;
      // ccs?: (Object | URL)[];
      // bcc?: Object | URL | null;
      // bccs?: (Object | URL)[];
      // mediaType?: string | null;
      // duration?: Temporal.Duration | null;
      // sensitive?: boolean | null;
      // proof?: DataIntegrityProof | URL | null;
      // proofs?: (DataIntegrityProof | URL)[];

      // assertionMethods?: (Multikey | URL)[];
      // manuallyApprovesFollowers?: boolean | null;
      // inbox?: OrderedCollection | URL | null;
      inbox: ctx.getInboxUri(handle),
      // outbox?: OrderedCollection | URL | null;
      // following?: Collection | URL | null;
      // followers?: Collection | URL | null;
      followers: ctx.getFollowersUri(handle),
      // liked?: Collection | URL | null;
      // featured?: Collection | URL | null;
      // featuredTags?: Collection | URL | null;
      // streams?: (Collection | URL)[];
      // endpoints?: Endpoints | null;
      endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
      // discoverable?: boolean | null;
      // suspended?: boolean | null;
      // memorial?: boolean | null;
      // indexable?: boolean | null;
    });
  })
  .setKeyPairsDispatcher(async (ctx, handle) => {
    if (handle != userName) return []; // Other than "me" is not found.
    const rsaKeys = await getRsaKeypair(handle);
    const ed25519Keys = await getEd25519Keypair(handle);
    return [rsaKeys, ed25519Keys];
  });

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    debugLogger.debug("Received follow");
    // debugLogger.debug`${ctx}`;
    debugLogger.debug`${follow}`;
    if (
      follow.id == null ||
      follow.actorId == null ||
      follow.objectId == null
    ) {
      return;
    }
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor" || parsed.handle !== userName) return;
    const follower = await follow.getActor(ctx);
    if (follower == null) return;

    for await (
      const entry of kv.list<string>({ prefix: ["followers", parsed.handle] })
    ) {
      if (
        entry.value === follow.actorId.href
      ) {
        debugLogger.debug`Rejecting follow`;
        await ctx.sendActivity(
          { handle: parsed.handle },
          follower,
          new Reject({
            actor: follow.objectId,
            object: follow,
            summary: "You are already following",
          }),
        );
        return;
      }
    }

    await ctx.sendActivity(
      { handle: parsed.handle },
      follower,
      new Accept({ actor: follow.objectId, object: follow }),
    );
    await kv.set(
      ["followers", parsed.handle, follow.id.href],
      follow.actorId.href,
    );
    activityLogger
      .info(`@${follower.preferredUsername}@todo followed @${parsed.handle}`);
    await (new Promise((r) => setTimeout(r, 1000)));
    await createNote(ctx, userName, "Someone just followed me!");
  })
  .on(Undo, async (ctx, undo) => {
    debugLogger.debug("Received undo");
    debugLogger.debug`${ctx}`;
    debugLogger.debug`${undo}`;
    const follow = await undo.getObject();
    if (!(follow instanceof Follow)) {
      throw new Error("Can only process follows for now");
    }
    if (
      follow.id == null ||
      follow.actorId == null ||
      follow.objectId == null
    ) {
      throw new Error("Incomplete undo");
    }

    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor" || parsed.handle !== userName) {
      throw new Error("Failed to get handle from inbox");
    }
    const actor = await follow.getActor(ctx);
    if (actor == null) {
      throw new Error("No actor");
    }

    await kv.delete(["followers", parsed.handle, follow.id.href]);
    activityLogger
      .info(`@${actor.preferredUsername}@todo unfollowed @${parsed.handle}`);
    await ctx.sendActivity(
      { handle: parsed.handle },
      actor,
      new Accept({ actor: follow.objectId, object: undo }),
    );

    await ctx.sendActivity(
      { handle: parsed.handle },
      actor,
      new Accept({ actor: follow.objectId, object: undo }),
    );
  });

Deno.serve(
  behindProxy(async (request) => {
    const url = new URL(request.url);
    // The home page:
    if (url.pathname === "/") {
      const followers: string[] = [];
      for await (
        const entry of kv.list<string>({ prefix: ["followers", userName] })
      ) {
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

const decoder = new TextDecoder();
for await (const chunk of Deno.stdin.readable) {
  const text = decoder.decode(chunk);
  // do something with the text
  console.log("hey");
  federation.createContext;
  const context = federation.createContext(
    new URL(
      "https://8000-zebreus-departmentofmis-v153bp49bfo.ws-eu115.gitpod.io",
    ),
  );
  await createNote(context, userName, "Meow, " + text);
}
