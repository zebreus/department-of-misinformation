import {
  Endpoints,
  exportJwk,
  Follow,
  generateCryptoKeyPair,
  importJwk,
  Person,
  Undo,
} from "@fedify/fedify";
import { behindProxy } from "@hongminhee/x-forwarded-fetch";
import { MainPage } from "./pages/MainPage.tsx";
import { UserPage } from "./pages/UserPage.tsx";
import { debugLogger, federation, kv } from "./globals.ts";
import { addFollower, getFollowers, removeFollower } from "./follower.ts";
import { createNote } from "./note.ts";

const userName = "me1";

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
    async (_, handle) => {
      // Work with the database to find the actors that are following the actor
      // (the below `getFollowersByUserHandle` is a hypothetical function):
      const followers = await getFollowers(handle);
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
  .setKeyPairsDispatcher(async (_, handle) => {
    if (handle != userName) return []; // Other than "me" is not found.
    const rsaKeys = await getRsaKeypair(handle);
    const ed25519Keys = await getEd25519Keypair(handle);
    return [rsaKeys, ed25519Keys];
  });

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    await addFollower(ctx, follow);
  })
  .on(Undo, async (ctx, undo) => {
    debugLogger.debug("Received undo");
    debugLogger.debug`${ctx}`;
    debugLogger.debug`${undo}`;
    const follow = await undo.getObject();
    if (!(follow instanceof Follow)) {
      throw new Error("Can only process follows for now");
    }
    await removeFollower(ctx, follow, undo);
  });

Deno.serve(
  behindProxy(async (request) => {
    const url = new URL(request.url);
    // The home page:
    if (url.pathname === "/") {
      return new Response(MainPage().value, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    const userPageMatches = url.pathname.match(/\/users\/([^\/]+)[/]?$/);
    if (userPageMatches) {
      const handle = userPageMatches[1];
      return new Response((await UserPage({ handle: handle })).value, {
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
