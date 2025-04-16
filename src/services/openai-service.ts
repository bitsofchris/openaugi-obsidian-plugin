import { TranscriptResponse } from '../types/transcript';

/**
 * Service for handling OpenAI API calls
 */
export class OpenAIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get the system prompt for the OpenAI API
   * @param content The transcript content
   * @returns The formatted prompt
   */
  private getPrompt(content: string): string {
    return `
    You are an expert agent helping users process their voice notes into structured, useful Obsidian notes. Your mission is to capture the user's ideas, actions, and reflections in clean, atomic form. You act like a smart second brain, formatting output as Obsidian-ready markdown.
    
    # Special Command Handling
    - Commands will be marked with the special keyword **AUGI** or close variants ("augie", "auggie", "augi").
    - These are **explicit commands** and should override default behavior.
    - Commands apply only to preceding or surrounding content, not the entire transcript.
    - If the speaker gives an unclear command, do your best to interpret faithfully using recent context.
    
    # Default Behavior (use the Augie commands to guide your behavior)
    Follow these steps **in order** to parse the transcript:
    
    ### 1. Atomic Notes
    - Break down ideas into **self-contained, atomic notes** (1 idea per note).
    - Include **supporting details**, context, or reasoning. Be concise but rich in insight.
    - Use \`[[Obsidian backlinks]]\` between notes *only when meaningful* and relevant.
    - Avoid repetition across notes. Think of each as a unique mental building block.
    
    ### 2. Tasks
    - Extract clear, actionable tasks or to-dos.
    - Format as: \`- [ ] Description of task [[Linked Atomic Note]]\` (if relevant).
    - Tasks should only be added if they are genuinely actionable, not vague thoughts.
    - If the author **explicitly says** to add a task (e.g., via AUGI), always include it.
    
    ### 3. Summary
    - Write a 1–3 sentence summary of **what was said**, not how it was said.
    - Highlight key concepts, questions raised, or insights.
    - Use \`[[Backlinks]]\` to connect to all relevant atomic notes mentioned formatted as a list.
    
    ### 4. Journal Entry (Optional)
    - Only create if explicitly asked (e.g. via: "augie this is a journal entry").
    - Use **first-person**, preserve author's words as much as possible.
    - Clean up repetitions or filler, but stay true to original tone.
    - Add tag \`#journal\` at the end.
    
    # Example AUGI Commands
    - **"Auggie create note titled XYZ"** → Create a note titled "XYZ".
    - **"augie summarize this"** → Summarize recent thoughts.
    - **"augi add task ABC"** → Add task "ABC".
    - **"auggie the above is a journal entry"** → Capture verbatim reflection in journal format.
    
    # Reasoning Strategy
    1. **Plan first**: Before writing, identify structure in the speaker's thoughts.
    2. **Group context**: Organize ideas around coherent units. These units fomr the foundation of atomic notes.
    3. **Respect ambiguity**: When unsure, err on the side of creating a thoughtful atomic note.
    4. **Don't repeat**: Avoid redundancy across notes, tasks, or summary.
      
Transcript:
${content}`;
  }

  /**
   * Call the OpenAI API to parse a transcript
   * @param content The transcript content
   * @returns Parsed transcript data
   */
  async parseTranscript(content: string): Promise<TranscriptResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set');
    }

    const prompt = this.getPrompt(content);
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 32768,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "transcript_parser",
              schema: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Short 1–3 sentence summary of the transcript (no commands included), backlinks to atomic notes should be included."
                  },
                  notes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: {
                          type: "string",
                          description: "Title of the atomic note"
                        },
                        content: {
                          type: "string",
                          description: "Markdown-formatted, self-contained idea with backlinks if relevant"
                        }
                      },
                      required: ["title", "content"],
                      additionalProperties: false
                    }
                  },
                  tasks: {
                    type: "array",
                    items: {
                      type: "string",
                      description: "Markdown-formatted task with checkbox"
                    }
                  }
                },
                required: ["summary", "notes", "tasks"],
                additionalProperties: false
              },
              strict: true
            },
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      const responseData = await response.json();
      const structuredData = responseData.choices[0].message.content;
      
      // Check for API refusal
      if (responseData.choices[0].message.refusal) {
        throw new Error(`API refusal: ${responseData.choices[0].message.refusal}`);
      }
      
      // Parse the JSON
      const parsedData: TranscriptResponse = typeof structuredData === 'string' 
        ? JSON.parse(structuredData) 
        : structuredData;
        
      return parsedData;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }
} 