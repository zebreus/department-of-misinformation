import {
    Accept,
    Actor,
    Follow,
    isActor,
    lookupObject,
    Recipient,
    Reject,
    RequestContext,
    Undo,
} from "@fedify/fedify";
import { activityLogger, debugLogger, kv } from "./globals.ts";
import { createNote } from "./note.ts";

export type DatabaseFollower = {
    /** preferred name of the follower */
    name: string;
    /** Displayname */
    displayName: string;
    /** Profile picture URL */
    profilePicture?: string;
    /** Hostname/Instance of the follower */
    instance: string;
    /** Full URL of the follower */
    id: string;
    /** Full URL of the inbox */
    inbox: string;
    sharedInbox?: string;
};

export const databaseFollowerToRecipient = (
    databaseFollower: DatabaseFollower,
) => ({
    id: databaseFollower.id ? new URL(databaseFollower.id) : null,
    inboxId: databaseFollower.inbox ? new URL(databaseFollower.inbox) : null,
    endpoints: (databaseFollower.sharedInbox
        ? {
            sharedInbox: new URL(databaseFollower.sharedInbox),
        }
        : null),
} satisfies Recipient);

const getHandleFromActor = (actor: Actor) => {
    const name = (actor.preferredUsername ||
        actor.preferredUsernames?.[0] || actor.name ||
        actor.names?.[0] || undefined)?.valueOf();
    if (!name) {
        throw new Error("Follower has no name");
    }
    const instance = actor.id?.host;
    if (!instance) {
        throw new Error("Follower has no id");
    }
    return `@${name}@${instance}`;
};

export const addFollower = async (
    ctx: RequestContext<void>,
    follow: Follow,
) => {
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
    if (parsed?.type !== "actor" || !parsed.handle) return;
    const follower = await follow.getActor(ctx);
    if (follower == null) return;
    const name = (follower.preferredUsername ||
        follower.preferredUsernames?.[0] || follower.name ||
        follower.names?.[0] || undefined)?.valueOf();
    const displayName = (follower.name ||
        follower.names?.[0] || follower.preferredUsername ||
        follower.preferredUsernames?.[0] || undefined)?.valueOf();
    if (!name || !displayName) {
        throw new Error("Follower has no name");
    }
    if (!follower.inboxId) {
        throw new Error("Follower has no inbox");
    }

    const databaseFollower = {
        name: name,
        displayName,
        instance: follow.actorId.host,
        id: follow.actorId.href,
        inbox: follower.inboxId?.href ?? undefined,
        sharedInbox: follower.endpoints?.sharedInbox?.href ?? undefined,
    } satisfies DatabaseFollower;

    for await (
        const entry of kv.list<DatabaseFollower>({
            prefix: ["followers", parsed.handle],
        })
    ) {
        if (
            entry.value.id === follow.actorId.href
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
        databaseFollower,
    );
    activityLogger
        .info(`${getHandleFromActor(follower)} followed @${parsed.handle}`);
    await (new Promise((r) => setTimeout(r, 1000)));
    await createNote(ctx, parsed.handle, "Someone just followed me!");
};

export const removeFollower = async (
    ctx: RequestContext<void>,
    follow: Follow,
    undo: Undo,
) => {
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
    if (parsed?.type !== "actor" || !parsed.handle) {
        throw new Error("Failed to get handle from inbox");
    }
    const actor = await follow.getActor(ctx);
    if (actor == null) {
        throw new Error("No actor");
    }

    await kv.delete(["followers", parsed.handle, follow.id.href]);
    activityLogger
        .info(`${getHandleFromActor(actor)} unfollowed @${parsed.handle}`);

    await ctx.sendActivity(
        { handle: parsed.handle },
        actor,
        new Accept({ actor: follow.objectId, object: undo }),
    );
};

export const getFollowers = async (handle: string) => {
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

export const getDatabaseFollowers = async (handle: string) => {
    // Work with the database to find the actors that are following the actor
    // (the below `getFollowersByUserHandle` is a hypothetical function):
    const followers: DatabaseFollower[] = [];
    for await (
        const entry of kv.list<DatabaseFollower>({
            prefix: ["followers", handle],
        })
    ) {
        if (followers.some((follower) => follower.id === entry.value.id)) {
            continue;
        }
        followers.push(entry.value);
    }
    return followers;
};
