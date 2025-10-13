import { TranscriptResponse, DistillResponse, PublishResponse } from '../types/transcript';

/**
 * A simple tokeinzer to estimate the number of tokens
 * @param text Text to count tokens from
 * @returns Approximate token count
 */
function estimateTokens(text: string): number {
  // Rough estimate: 1 token is approximately 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Service for handling OpenAI API calls
 */
export class OpenAIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Extract custom context instructions from content if they exist
   * @param content The content to extract the context from
   * @returns The extracted context or null if none exists
   */
  private extractCustomContext(content: string): string | null {
    // Look for context: section in the content
    const contextRegex = /```context:([\s\S]*?)```|context:([\s\S]*?)(?:\n\n|\n$|$)/;
    const match = contextRegex.exec(content);
    
    if (match) {
      // Return the first matching group that has content
      const rawContext = (match[1] || match[2])?.trim() || null;
      if (rawContext) {
        return `# USER CONTEXT\nPlease apply these additional instructions when processing. The instructions should take priority to guide and focus what you should extract:\n${rawContext}`;
      }
    }
    
    return null;
  }

  /**
   * Get the system prompt for the OpenAI API
   * @param content The transcript content
   * @returns The formatted prompt
   */
  private getPrompt(content: string): string {
    // Extract any custom context
    const customContext = this.extractCustomContext(content);
    
    // Base prompt
    let prompt = `
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
    `;
    
    // Add custom context if available
    if (customContext) {
      prompt += `\n\n${customContext}`;
    }
    
    // Add transcript content
    prompt += `\n\nTranscript:\n${content}`;
    
    return prompt;
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

  /**
   * Get the distillation prompt for the OpenAI API
   * @param content The aggregated content from linked notes
   * @param customPrompt Optional custom prompt to replace the default instructions
   * @returns The formatted prompt
   */
  private getDistillPrompt(content: string, customPrompt?: string): string {
    // Extract any custom context from the content (which should include the root note)
    const customContext = this.extractCustomContext(content);
    
    let prompt: string;
    
    if (customPrompt) {
      // Use the custom prompt as the main instructions
      prompt = customPrompt;
    } else {
      // Use the default prompt
      prompt = `
    You are an expert knowledge curator helping users distill and organize information from their notes. Your task is to analyze multiple related notes and create a coherent set of atomic notes and a summary.
    
    # Instructions
    Analyze the following notes carefully. Consider the title of the note to help you identify distinct concepts, ideas, and insights.
    The title can be used to help you figure out what's relevant. Some titles might not be helpful in which case you should 
    determine the intent and most relevant concepts from the content.
    
    ### 1. Create Atomic Notes
    - Identify distinct concepts, ideas, and insights across all notes
    - Deduplicate and merge overlapping ideas
    - Any distinct idea should be a separate note
    - Create self-contained atomic notes with one clear idea per note
    - Include supporting details and context
    - Use \`[[Obsidian backlinks]]\` between notes when relevant
    - Avoid repetition across notes
    
    ### 2. Extract Tasks
    - Identify any actionable tasks present in the notes
    - Format as: \`- [ ] Description of task [[Linked Atomic Note]]\` (if relevant)
    - Only include genuinely actionable items, it's okay if there are none
    
    ### 3. Create a Summary
    - Write a concise summary that synthesizes the key concepts
    - Highlight connections between ideas
    - Use \`[[Backlinks]]\` to connect to relevant atomic notes
    `;
    }
    
    // Add custom context if available (this is from the context: section in notes)
    if (customContext) {
      prompt += `\n\n${customContext}`;
    }
    
    // Add content to distill
    prompt += `\n\n# Content to Distill:\n${content}`;
    
    return prompt;
  }

  /**
   * Call the OpenAI API to distill content from linked notes
   * @param content The aggregated content from linked notes
   * @param customPrompt Optional custom prompt to replace the default instructions
   * @returns Distilled content data
   */
  async distillContent(content: string, customPrompt?: string): Promise<DistillResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set');
    }

    const prompt = this.getDistillPrompt(content, customPrompt);
    
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
              name: "distill_content",
              schema: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Concise summary that synthesizes the key concepts from all notes, with backlinks to atomic notes."
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
      const parsedData: DistillResponse = typeof structuredData === 'string' 
        ? JSON.parse(structuredData) 
        : structuredData;
        
      // Initialize sourceNotes as empty array (will be populated by DistillService)
      parsedData.sourceNotes = [];
        
      return parsedData;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  /**
   * Get the default publishing prompt
   * @returns The default prompt for publishing content
   */
  private getDefaultPublishPrompt(): string {
    return `You are helping transform raw notes into a polished, publishable blog post.

Take these notes and create ONE cohesive blog post that:

PRESERVE:
- The author's unique voice and personality
- Direct, conversational tone
- Creative language and specific phrases
- The core insights and ideas

ADD:
- Why this matters to the reader
- Context where needed (but don't over-explain)
- Natural transitions between ideas
- A clear narrative arc or structure

FORMAT:
- Short paragraphs (2-4 sentences)
- Use headers/subheaders to organize sections
- Bold key phrases sparingly for emphasis
- Conversational but polished

TONE:
- Write like you're explaining to a curious friend
- Be direct and honest
- Don't be overly formal or academic
- Let personality shine through

OUTPUT:
Return a single markdown blog post, ready to publish.`;
  }

  /**
   * Get the publishing prompt for the OpenAI API
   * @param content The aggregated content from notes
   * @param customPrompt Optional custom prompt to replace the default
   * @returns The formatted prompt
   */
  private getPublishPrompt(content: string, customPrompt?: string): string {
    // Extract any custom context from the content
    const customContext = this.extractCustomContext(content);

    let prompt: string;

    if (customPrompt) {
      // Use the custom prompt as the main instructions
      prompt = customPrompt;
    } else {
      // Use the default publishing prompt
      prompt = this.getDefaultPublishPrompt();
    }

    // Add custom context if available (this is from the context: section in notes)
    if (customContext) {
      prompt += `\n\n${customContext}`;
    }

    // Add content to publish
    prompt += `\n\n# Content to Transform:\n${content}`;

    return prompt;
  }

  /**
   * Call the OpenAI API to publish content as a single blog post
   * @param content The aggregated content from notes
   * @param customPrompt Optional custom prompt to replace the default
   * @returns Published content as plain markdown
   */
  async publishContent(content: string, customPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set');
    }

    const prompt = this.getPublishPrompt(content, customPrompt);

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
          temperature: 0.7,  // Higher temperature for more creative output
          max_tokens: 32768
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      const responseData = await response.json();

      // Check for API refusal
      if (responseData.choices[0].message.refusal) {
        throw new Error(`API refusal: ${responseData.choices[0].message.refusal}`);
      }

      // Get the plain text content
      const publishedContent = responseData.choices[0].message.content;

      return publishedContent;
    } catch (error) {
      console.error('Error calling OpenAI API for publishing:', error);
      throw error;
    }
  }
} 