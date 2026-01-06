
import { Caption } from '../types';

/**
 * Parses Whisper format: [00:00.720 --> 00:05.120]  Text content
 */
export function parseWhisperLog(text: string): Caption[] {
  const lines = text.split('\n');
  const captions: Caption[] = [];
  const regex = /\[(\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}\.\d{3})\]\s+(.*)/;

  lines.forEach((line, index) => {
    const match = line.trim().match(regex);
    if (match) {
      const [, startStr, endStr, content] = match;
      captions.push({
        id: `manual-${index}-${Date.now()}`,
        start: timeStringToSeconds(startStr),
        end: timeStringToSeconds(endStr),
        text: content.trim()
      });
    }
  });

  return captions;
}

function timeStringToSeconds(timeStr: string): number {
  const [minutes, seconds] = timeStr.split(':');
  return parseFloat(minutes) * 60 + parseFloat(seconds);
}
