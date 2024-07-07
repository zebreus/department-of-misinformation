import { Context, Create, Note, PUBLIC_COLLECTION } from "@fedify/fedify";
import { generateId } from "./helpers/generateId.ts";
import { activityLogger, kv } from "./globals.ts";
import {
    databaseFollowerToRecipient,
    getDatabaseFollowers,
} from "./follower.ts";

export type DatabaseNote = {
    /** Only the id part of the ID. use getNoteUri to get the whole Uri */
    id: string;
    /** Handle of the author */
    authorHandle: string;
    content: string;
    time: number;
    to: URL[];
};

export const createNote = async (
    ctx: Context<void>,
    handle: string,
    content: string,
) => {
    const followers = await getDatabaseFollowers(handle);
    const followerUrls = followers.flatMap((f) => f.id ? [new URL(f.id)] : []);
    console.debug(followers);
    const time = Temporal.Instant.fromEpochMilliseconds(Date.now());
    const id = generateId();
    const noteUrl = new URL(ctx.getActorUri(handle) + `/notes/${id}`);
    const createUrl = new URL(
        ctx.getActorUri(handle) + `/notes/${id}/activity`,
    );
    const realContent = `<p>${content}</p>`;
    kv.set(
        ["notes", handle, id],
        {
            id: id,
            authorHandle: handle,
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
        followers.map(databaseFollowerToRecipient),
        create,
    );
    activityLogger.info(`@${handle} posted: ${content}`);
};

export const getDatabaseNotes = async (handle: string) => {
    // Work with the database to find the actors that are following the actor
    // (the below `getFollowersByUserHandle` is a hypothetical function):
    const notes: DatabaseNote[] = [];
    for await (
        const entry of kv.list<DatabaseNote>({
            prefix: ["notes", handle],
        })
    ) {
        notes.push(entry.value);
    }
    return notes;
};

export const getDatabaseNote = async (handle: string, noteId: string) => {
    // Work with the database to find the actors that are following the actor
    // (the below `getFollowersByUserHandle` is a hypothetical function):
    const note = await kv.get<DatabaseNote>(["notes", handle, noteId]);
    if (!note?.value) {
        throw new Error("Failed to find Note");
    }
    return note.value;
};
