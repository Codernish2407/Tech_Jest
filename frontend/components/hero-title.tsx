import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";

// The homepage headline as a staggered, tilted stack of up to four lines. The title stays real
// text (admin-editable in site settings) and is split into lines automatically. Each word rises
// from behind a mask; decorative pills sit beside the lines, and a crimson trail with an arrow
// underlines the last line. All motion is CSS, so the words never wait on JavaScript.

const faces = [
  "/images/team/chayan-khatua-portrait.jpg",
  "/images/team/amit-singh-panwar-portrait.jpg",
  "/images/team/arushi-choudhary-portrait.jpg",
];

function toLines(words: string[]) {
  const perLine = Math.max(1, Math.ceil(words.length / 4));
  const lines: string[][] = [];
  for (let i = 0; i < words.length; i += perLine) lines.push(words.slice(i, i + perLine));
  return lines;
}

const delay = (index: number) => ({ "--i": index }) as CSSProperties;

// The inner pages' headline: the same word-by-word rise, without the hero's pills and tilt.
export function RiseTitle({ text }: { text: string }) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return (
    <h1 className="rise-title">
      {words.map((word, i) => (
        <span key={`${word}-${i}`}>
          <span className="hero-word" style={delay(i)}>
            <span className="hero-word-mask">
              <span className="hero-word-text">{word}</span>
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </h1>
  );
}

export function HeroTitle({ title }: { title: string }) {
  const lines = toLines(title.trim().split(/\s+/).filter(Boolean));
  const lastLine = lines.length - 1;
  let wordIndex = 0;

  const decoration = (line: number, first: number): ReactNode => {
    if (line === 0 && lines.length > 1) {
      return (
        <span className="hero-pill hero-chip hero-pill-after" aria-hidden="true" style={delay(first + 1)}>
          {"</>"}
        </span>
      );
    }
    if (line === 2 && lines.length > 3) {
      return (
        <span className="hero-pill hero-pill-faces hero-pill-after" aria-hidden="true" style={delay(first + 1)}>
          {faces.map((src) => (
            <span key={src}>
              <Image src={src} alt="" fill sizes="64px" />
            </span>
          ))}
        </span>
      );
    }
    return null;
  };

  return (
    <h1 className="hero-title">
      {lines.map((line, lineIndex) => {
        const first = wordIndex;
        return (
          <span className={`hero-line hero-line-${lineIndex + 1}`} key={lineIndex}>
            {line.map((word, index) => {
              const i = wordIndex++;
              const isLast = lineIndex === lastLine && index === line.length - 1 && lines.length > 1;
              return (
                <span key={`${word}-${i}`}>
                  <span className="hero-word" style={delay(i)}>
                    <span className="hero-word-mask">
                      <span className="hero-word-text">{word}</span>
                    </span>
                    {isLast ? (
                      <span className="hero-trail" aria-hidden="true">
                        <span className="hero-trail-line" />
                        <span className="hero-trail-arrow">→</span>
                      </span>
                    ) : null}
                  </span>
                  {index < line.length - 1 || lineIndex < lastLine ? " " : null}
                </span>
              );
            })}
            {decoration(lineIndex, first)}
          </span>
        );
      })}
    </h1>
  );
}
