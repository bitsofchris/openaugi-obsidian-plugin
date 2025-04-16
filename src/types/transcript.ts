export interface TranscriptNote {
  title: string;
  content: string;
}

export interface TranscriptResponse {
  summary: string;
  notes: TranscriptNote[];
  tasks: string[];
} 