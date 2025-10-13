export interface TranscriptNote {
  title: string;
  content: string;
}

export interface BaseResponse {
  summary: string;
  notes: TranscriptNote[];
  tasks: string[];
}

export interface TranscriptResponse extends BaseResponse {}

export interface DistillResponse extends BaseResponse {
  sourceNotes: string[]; // List of source note names that were distilled
}

export interface PublishResponse {
  content: string; // The full blog post markdown
  sourceNotes: string[]; // List of source note names that were used
} 