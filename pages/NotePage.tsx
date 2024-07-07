/** @jsxImportSource jsr:@mary/jsx */

import { DatabaseNote, getDatabaseNote } from "../note.ts";

export const Note = ({ note }: { note: DatabaseNote }) => (
    <dl id={`note-${note.id}`}>
        <dt>Date</dt>
        <dd>
            <time datetime={new Date(note.time).toISOString()}>
                {new Date(note.time).toISOString()}:
            </time>
        </dd>
        <dt>Author</dt>
        <dd>
            <a href={`/users/${note.authorHandle}`}>@{note.authorHandle}</a>
        </dd>
        <dt>Report No.</dt>
        <dd>
            <a href={`/users/${note.authorHandle}/notes/${note.id}`}>
                {note.id}
            </a>
        </dd>
        <dt>Content</dt>
        <dd>{note.content.replaceAll("<p>", "").replaceAll("</p>", "")}</dd>
    </dl>
);

export const NotePage = async (
    { handle, noteId }: { handle: string; noteId: string },
) => {
    const note = await getDatabaseNote(handle, noteId);

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
                    <h2>Report {note.id}</h2>
                    <Note note={note} />
                </body>
            </html>
        </>
    );
};
