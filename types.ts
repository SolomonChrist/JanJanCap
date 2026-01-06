
export interface Caption {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

export interface CaptionStyle {
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  fontSize: number;
  color: string;
  backgroundColor: string;
  padding: number;
  borderRadius: number;
}

export type AppStatus = 'idle' | 'choosing' | 'transcribing' | 'pasting' | 'editing' | 'exporting' | 'completed';
