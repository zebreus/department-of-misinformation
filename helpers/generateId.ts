import { words } from "./words.ts";

export const generateId = () => {
    return (Array(5).fill(0).map(() =>
        words[Math.floor(Math.random() * words.length)]
    ).join("-"));
};
