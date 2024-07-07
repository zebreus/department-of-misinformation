/** @jsxImportSource jsr:@mary/jsx */

import { DatabaseFollower, getDatabaseFollowers } from "../follower.ts";
import { DatabaseNote, getDatabaseNotes } from "../note.ts";
import { Note } from "./NotePage.tsx";

const Followers = (
    { followers }: { followers: DatabaseFollower[] },
) => {
    return (
        <>
            <h3 id="followers-list">Reports will be send to</h3>
            <ul aria-label="followers-list">
                {followers.map((f) => (
                    <li>
                        <a href={f.id}>@{f.name}@{f.instance}</a>
                    </li>
                ))}
            </ul>
        </>
    );
};

const Reports = (
    { notes }: { notes: DatabaseNote[] },
) => {
    return (
        <>
            <h3 id="followers-list">Published reports</h3>
            <ul aria-label="followers-list">
                {notes.map((note) => (
                    <li>
                        <Note note={note} />
                    </li>
                ))}
            </ul>
        </>
    );
};

export const UserPage = async ({ handle }: { handle: string }) => {
    const followers = await getDatabaseFollowers(handle);
    const notes = await getDatabaseNotes(handle);

    return (
        <>
            <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1"
                    />
                    <title>Department of Misinformation</title>
                </head>

                <body>
                    <a href="/">
                        <h1>Department of Misinformation</h1>
                    </a>
                    <h2>Office of {handle}</h2>
                    <Followers followers={followers} />
                    <Reports notes={notes} />
                </body>
            </html>
        </>
    );
};
