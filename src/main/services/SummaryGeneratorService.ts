/**
 * SummaryGeneratorService - AI-powered PDF Summary Generation
 *
 * This service integrates with the existing AIService to generate concise
 * summaries of PDF text content. It handles:
 * - Word limit enforcement (max 500 words)
 * - Short content passthrough (< 100 words returns original)
 * - Retry logic for AI failures
 * - AIService initialization checks
 *
 * @module SummaryGeneratorService
 * @requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { getAIService } from './AIService';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of summary generation
 */
export interface SummaryResult {
  /** Whether summary generation was successful */
  success: boolean;
  /** Generated summary text (if successful) */
  summary?: string;
  /** Word count of the generated summary */
  wordCount?: number;
  /** Error message (if failed) */
  error?: string;
  /** Whether the original text was returned as-is (passthrough) */
  isPassthrough?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum word count for generated summaries */
const MAX_SUMMARY_WORDS = 500;

/** Minimum word count threshold for passthrough (content below this is returned as-is) */
const PASSTHROUGH_THRESHOLD = 100;

/** Number of retry attempts for AI failures */
const MAX_RETRIES = 1;

// =============================================================================
// SummaryGeneratorService Class
// =============================================================================

/**
 * Service for generating AI-powered summaries of text content
 */
class SummaryGeneratorService {
  private static instance: SummaryGeneratorService;

  private constructor() {}

  /**
   * Get the singleton instance of SummaryGeneratorService
   */
  static getInstance(): SummaryGeneratorService {
    if (!SummaryGeneratorService.instance) {
      SummaryGeneratorService.instance = new SummaryGeneratorService();
    }
    return SummaryGeneratorService.instance;
  }

  /**
   * Count the number of words in a text string
   * Words are defined as sequences of non-whitespace characters
   *
   * @param text - The text to count words in
   * @returns The number of words in the text
   */
  countWords(text: string): number {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    // Trim and split by whitespace, filter out empty strings
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }

  /**
   * Generate a summary of the provided text content
   *
   * @param text - The text content to summarize
   * @param filename - Optional filename for context in the summary prompt
   * @returns Promise resolving to SummaryResult
   *
   * @requirements
   * - 4.1: Uses existing AIService to generate summary
   * - 4.2: Summary is no more than 500 words
   * - 4.3: Content < 100 words returns original as summary
   * - 4.4: Returns error if AIService not initialized
   * - 4.5: Retries once before marking as failed
   */
  async generateSummary(text: string, filename?: string): Promise<SummaryResult> {
    // Validate input
    if (!text || typeof text !== 'string') {
      return {
        success: false,
        error: 'Invalid input: text is required and must be a string',
      };
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return {
        success: false,
        error: 'Invalid input: text cannot be empty',
      };
    }

    // Check word count for passthrough logic (Requirement 4.3)
    const inputWordCount = this.countWords(trimmedText);
    if (inputWordCount < PASSTHROUGH_THRESHOLD) {
      console.log(
        `[SummaryGeneratorService] Short content (${inputWordCount} words < ${PASSTHROUGH_THRESHOLD}), returning as-is`
      );
      return {
        success: true,
        summary: trimmedText,
        wordCount: inputWordCount,
        isPassthrough: true,
      };
    }

    // Check if AIService is initialized (Requirement 4.4)
    const aiService = getAIService();
    if (!aiService.isInitialized()) {
      console.error('[SummaryGeneratorService] AIService is not initialized');
      return {
        success: false,
        error: 'AI service is not configured. Please configure AI settings first.',
      };
    }

    // Attempt to generate summary with retry logic (Requirement 4.5)
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[SummaryGeneratorService] Retry attempt ${attempt} of ${MAX_RETRIES}`);
        }

        const summary = await this.callAIForSummary(trimmedText, filename);

        // Verify word count constraint (Requirement 4.2)
        const summaryWordCount = this.countWords(summary);
        if (summaryWordCount > MAX_SUMMARY_WORDS) {
          console.warn(
            `[SummaryGeneratorService] Summary exceeded word limit (${summaryWordCount} > ${MAX_SUMMARY_WORDS}), truncating`
          );
          const truncatedSummary = this.truncateToWordLimit(summary, MAX_SUMMARY_WORDS);
          return {
            success: true,
            summary: truncatedSummary,
            wordCount: this.countWords(truncatedSummary),
          };
        }

        console.log(
          `[SummaryGeneratorService] Summary generated successfully (${summaryWordCount} words)`
        );
        return {
          success: true,
          summary,
          wordCount: summaryWordCount,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error during summarization';
        console.error(
          `[SummaryGeneratorService] Summarization attempt ${attempt + 1} failed:`,
          lastError
        );

        // If this was the last attempt, don't retry
        if (attempt >= MAX_RETRIES) {
          break;
        }

        // Small delay before retry
        await this.delay(1000);
      }
    }

    // All attempts failed
    console.error('[SummaryGeneratorService] All summarization attempts failed');
    return {
      success: false,
      error: `Summarization failed after ${MAX_RETRIES + 1} attempt(s): ${lastError}`,
    };
  }

  /**
   * Call the AI service to generate a summary
   *
   * @param text - The text to summarize
   * @param filename - Optional filename for context
   * @returns Promise resolving to the summary text
   */
  private async callAIForSummary(text: string, filename?: string): Promise<string> {
    const aiService = getAIService();

    // Clear history to ensure clean context for summarization
    aiService.clearHistory();

    // Build the prompt
    const prompt = this.buildSummaryPrompt(text, filename);

    console.log('[SummaryGeneratorService] Sending summarization request to AI');

    // Call AI service
    const result = await aiService.chat(prompt);

    if (!result.response || result.response.trim().length === 0) {
      throw new Error('AI returned an empty response');
    }

    return result.response.trim();
  }

  /**
   * Build the prompt for summary generation
   *
   * @param text - The text to summarize
   * @param filename - Optional filename for context
   * @returns The formatted prompt string
   */
  private buildSummaryPrompt(text: string, filename?: string): string {
    const filenameContext = filename ? ` from the document "${filename}"` : '';

    return `Please provide a concise summary of the following text${filenameContext}. 

Requirements:
- The summary MUST be no more than 500 words
- Focus on the key points, main ideas, and important details
- Use clear, professional language
- Do not include any preamble like "Here is a summary" - just provide the summary directly

Text to summarize:
---
${text}
---

Summary:`;
  }

  /**
   * Truncate text to a specified word limit
   *
   * @param text - The text to truncate
   * @param maxWords - Maximum number of words
   * @returns Truncated text
   */
  private truncateToWordLimit(text: string, maxWords: number): string {
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) {
      return text;
    }

    const truncated = words.slice(0, maxWords).join(' ');
    // Add ellipsis to indicate truncation
    return truncated + '...';
  }

  /**
   * Delay execution for a specified duration
   *
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after the delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Exports
// =============================================================================

/**
 * Get the singleton instance of SummaryGeneratorService
 */
export function getSummaryGeneratorService(): SummaryGeneratorService {
  return SummaryGeneratorService.getInstance();
}

export default SummaryGeneratorService;
