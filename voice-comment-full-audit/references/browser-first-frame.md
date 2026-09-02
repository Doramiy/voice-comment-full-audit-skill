# Browser and First-Frame Procedure

Use the browser skill for page interaction. The purpose of this phase is to
collect evidence for a decision, not to browse aimlessly.

## URL resolution

1. Use the source URL when it is present and non-empty.
2. If it is empty and NID exists, use:

```text
https://mbd.baidu.com/newspage/data/videolanding?nid={NID}
```

3. Store the resolved URL in the evidence record. Do not overwrite an
   unrelated source field merely to create a link.

## Per-resource steps

1. Open the resource page.
2. Record whether the page loaded and the actual page title.
3. Capture the first visible frame and transcribe visible text.
4. Describe the frame objectively: people, objects, scene, action, and
   prominent text.
5. Compare the comment separately with the title, frame text, and frame image.
6. If the frame is blurry and a short playback is technically reasonable,
   inspect the first few seconds. Record why playback was attempted.
7. Decide confirmed failure, qualified, or suspicious. `evidence insufficient`
   is not a final state: for unrelated/read-back it resolves to `qualified`;
   for external voice it may resolve to `suspicious` only when a video resource
   URL is available.
8. Save the compact evidence JSON and close/reuse the page.

## Decision boundaries

- A frame showing the comment's object overrides a title that omits the object.
- A frame showing the same title words does not by itself prove the comment
  read the original audio.
- Later-content, off-screen action, emotion, or a response to a line can
  explain an apparent mismatch.
- A page or play URL that is unavailable cannot support a confirmed unrelated
  or read-back result; finalize those cases as qualified.
- A blurry frame is not automatically a failure. Assess the technical
  difficulty and expected value of a short playback. If evidence remains
  insufficient, pass the item rather than leaving a pending label.

## Stability limits

- Keep browser concurrency small and bounded.
- Reuse a limited number of tabs/pages; close failed or idle pages.
- Do not download all videos simultaneously.
- Use contact sheets or thumbnails only as a memory-bounded viewing aid; keep
  the original evidence path for final adjudication.
- Checkpoint each completed batch so a reconnect resumes from the last
  completed resource.
