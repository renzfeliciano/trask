# Content style

How TRASK reads. The spec (§5 "Quality bar") is the source; this page is the working checklist.
`tests/unit/content/banned-phrases.test.ts` enforces the banned list below over every file in `src/`.

## Voice

- Plain, specific product voice. Say what happened and what to do next, in one or two short sentences.
- Sentence case for titles and buttons. End full sentences with a period; buttons and labels have none.
- No emoji in UI chrome. Sparkles and confetti live only inside the mascot artwork.

## Buttons

Buttons name the action: "Create task", "Move to Review", "Try again", "Go to home page".
Never "Submit", "OK", "Get started" or "Click here".

## Empty and error states

Use the mascot copy from spec §5 "Brand & mascot" word for word, for example:

| State        | Title                                 | Line                                                                             |
| ------------ | ------------------------------------- | -------------------------------------------------------------------------------- |
| `empty`      | Nothing here yet.                     | Add a task to get this board moving.                                             |
| `no-results` | Nothing found.                        | Try a different search.                                                          |
| `error`      | Well… that wasn't supposed to happen. | A concrete recovery step, e.g. "Something went wrong on our side." + "Try again" |

The text always carries the meaning; the mascot is decoration (`alt=""`).

## Data

Seed and demo data read like real work: specific titles, real-sounding owners and dates.
Never "Task 1", "Example project" or filler text.

## Banned phrases

Case-insensitive. Words match whole words only ("elevate" does not flag "elevation"), so list each
form you want banned ("seamless" and "seamlessly"). Emoji match anywhere.

```banned
unlock
supercharge
seamless
seamlessly
effortless
effortlessly
elevate
revolutionize
game-changer
dive in
lorem ipsum
🚀
✨
```
