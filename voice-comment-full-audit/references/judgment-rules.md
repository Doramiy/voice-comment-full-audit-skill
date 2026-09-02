# Judgment Rules

These rules are the source of truth for both first-pass and advanced review.
Advanced review is recall-oriented: it actively searches for missed failures
and gathers missing evidence. It does not grant permission to guess.

## Result states

Use one primary state per newly selected UID:

```text
合格
不合格：<固定原因>
疑似不合格：<原因>，需人工复核
```

Confirmed failures and suspicions are separate statistics. A suspicion never
counts as a confirmed failure.

## Canonical fixed reasons

Use these exact strings:

```text
评论内容与当前视频无关
评论过于简单、缺乏有效信息
播放外部声音代替本人评论
使用AI语音、机器配音或其他非本人真实声音
直接照读视频标题、字幕或视频原声
有效语音不符合要求
广告导流、辱骂低俗、恶意刷量或其他违规内容
```

The default workflow keeps all seven reason strings available for compatibility,
but does not actively judge voice duration. Duration is ignored unless a new
conversation explicitly enables it. AI-voice claims require direct audio
evidence; otherwise pass or use the suspicious external-voice state.

## Positive-expression floor

Before assigning any failure, ask:

1. Does the comment have an identifiable object, viewpoint, feeling, question,
   explanation, criticism, suggestion, or interaction purpose?
2. Could it refer to the title, person, object, event, scene, later action, or
   emotional tone of the video?
3. Is it an independent expression rather than a pure media passage?

If the answer supports a normal interpretation, pass it. The following are
not failures by themselves:

- short wording, colloquial speech, dialect, grammar errors, or imperfect
  transcription;
- a question about what something is, where to buy it, whether it works, or
  what happens next;
- specific praise, tribute, empathy, surprise, criticism, or explanation;
- repeated words or stuttering when a meaningful intent remains;
- mentioning a product or brand without a promotional action.

## Unrelated

Confirm only when the page, frame, or early playback clearly shows a different
object, person, event, or theme and there is no reasonable later-content
explanation. Title mismatch alone is not enough.

If the first frame shows the comment's object, pass even when the title and
tags do not mention it. If the frame is unavailable or the evidence remains
uncertain, pass rather than confirm unrelated.

## Direct read-back

Confirm only when the comment has long, distinctive, continuous, ordered
overlap with the title, visible subtitle, or original audio and adds no
independent expression.

Pass when the comment:

- adds a concrete opinion, feeling, tribute, explanation, criticism, advice,
  or useful question after repeating a title;
- paraphrases the topic in the commenter's own words and reacts to it;
- shares only ordinary theme words.

Do not claim subtitle or original-audio read-back without visible subtitle,
audio-transcript, or equivalent direct evidence.

## External voice

Continuous news, drama, narration, sports commentary, classroom speech,
lyrics, livestream sales talk, or audiobook-like text can be a risk signal.

- Confirm only with direct audio, subtitle, or page evidence.
- If the text strongly warrants human checking but direct audio is unavailable,
  mark suspicious and write the video resource URL.
- Never invent a comment-audio URL.
- A single dialogue line or polished sentence is not enough.

## Simple / no-information

Use this reason only when the comment has no recognizable object, viewpoint,
feeling, question, detail, or interaction purpose. Examples include only
generic “好看”, “不错”, “666”, greetings, isolated words, or meaningless
characters. A concrete compliment or useful question is valid.

## Other violations

Confirm explicit advertising, off-platform direction, selling, contact/QR
instructions, abusive or vulgar attacks, task/check-in language, obvious
spam, pure gibberish, or other clear violations. A viewer asking where to buy
or whether a product works is not automatically advertising.

## Calibration examples

- A comment describing a cave is qualified when the first frame clearly shows
  a cave, even if the title does not mention one.
- A comment that only repeats a title is read-back when the frame confirms the
  same title and there is no added thought.
- A title followed by a concrete tribute or personal reaction is qualified.
- A news-like transcript with no direct audio evidence is suspicious external
  voice, not confirmed failure.
