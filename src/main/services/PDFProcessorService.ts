/**
 * PDFProcessorService - PDF Text Extraction Service
 *
 * Responsible for extracting text content from PDF files using the pdf-parse library.
 * Handles various error conditions including password-protected, corrupted, and image-only PDFs.
 *
 * @module PDFProcessorService
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types (inline to avoid tsconfig rootDir issues with shared folder)
// =============================================================================

/**
 * Error codes for PDF extraction failures
 */
export type PDFErrorCode =
  | 'EMPTY_PDF'           // PDF contains no extractable text (image-only)
  | 'PASSWORD_PROTECTED'  // PDF is password protected
  | 'CORRUPTED'           // PDF file is corrupted or invalid
  | 'READ_ERROR';         // General file read error

/**
 * Result of PDF text extraction
 */
export interface PDFExtractionResult {
  /** Whether extraction was successful */
  success: boolean;
  /** Extracted text content (if successful) */
  text?: string;
  /** Number of pages in the PDF */
  pageCount?: number;
  /** Error message (if failed) */
  error?: string;
  /** Specific error code (if failed) */
  errorCode?: PDFErrorCode;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Service for processing PDF files and extracting text content
 */
class PDFProcessorService {
  private static instance: PDFProcessorService;

  private constructor() {}

  /**
   * Get the singleton instance of PDFProcessorService
   */
  static getInstance(): PDFProcessorService {
    if (!PDFProcessorService.instance) {
      PDFProcessorService.instance = new PDFProcessorService();
    }
    return PDFProcessorService.instance;
  }

  /**
   * Extract text content from a PDF file
   *
   * @param filePath - Full path to the PDF file
   * @returns Promise<PDFExtractionResult> - Result containing extracted text or error information
   *
   * Error codes:
   * - EMPTY_PDF: PDF contains no extractable text (image-only PDF)
   * - PASSWORD_PROTECTED: PDF requires password
   * - CORRUPTED: PDF file is corrupted or invalid
   * - READ_ERROR: General file read error
   */
  async extractText(filePath: string): Promise<PDFExtractionResult> {
    console.log(`[PDFProcessorService] Extracting text from: ${filePath}`);

    // Validate file path
    if (!filePath || typeof filePath !== 'string') {
      return {
        success: false,
        error: 'Invalid file path provided',
        errorCode: 'READ_ERROR',
      };
    }

    // Check if file exists
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      console.error(`[PDFProcessorService] File not accessible: ${filePath}`);
      return {
        success: false,
        error: `File not found or not accessible: ${filePath}`,
        errorCode: 'READ_ERROR',
      };
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pdf') {
      return {
        success: false,
        error: `Invalid file type: ${ext}. Expected .pdf`,
        errorCode: 'READ_ERROR',
      };
    }

    // Read the file
    let dataBuffer: Buffer;
    try {
      dataBuffer = await fs.promises.readFile(filePath);
    } catch (readError) {
      const errorMessage = readError instanceof Error ? readError.message : 'Unknown read error';
      console.error(`[PDFProcessorService] Failed to read file: ${errorMessage}`);
      return {
        success: false,
        error: `Failed to read file: ${errorMessage}`,
        errorCode: 'READ_ERROR',
      };
    }

    // Check if file is empty
    if (dataBuffer.length === 0) {
      return {
        success: false,
        error: 'PDF file is empty',
        errorCode: 'CORRUPTED',
      };
    }

    // Parse the PDF using pdf-parse v2 API
    try {
      // pdf-parse v2 exports PDFParse class with different API
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PDFParse } = require('pdf-parse');
      
      const parser = new PDFParse({ data: dataBuffer });
      
      // Must call load() before getText() in pdf-parse v2
      await parser.load();
      
      const textResult = await parser.getText();
      
      // Get extracted text
      const extractedText = textResult.text?.trim() || '';
      const pageCount = textResult.total || 1;

      // Check for empty text (image-only PDF)
      if (extractedText.length === 0) {
        console.log(`[PDFProcessorService] No extractable text found in: ${filePath}`);
        return {
          success: false,
          error: 'PDF contains no extractable text. It may be an image-only PDF.',
          errorCode: 'EMPTY_PDF',
          pageCount,
        };
      }

      console.log(
        `[PDFProcessorService] Successfully extracted ${extractedText.length} characters from ${pageCount} pages`
      );

      return {
        success: true,
        text: extractedText,
        pageCount,
      };
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      console.error(`[PDFProcessorService] PDF parse error: ${errorMessage}`);

      // Detect specific error types
      const errorCode = this.classifyParseError(errorMessage);

      return {
        success: false,
        error: this.getHumanReadableError(errorCode, errorMessage),
        errorCode,
      };
    }
  }

  /**
   * Check if a file is a valid PDF that can be processed
   *
   * @param filePath - Full path to the file to validate
   * @returns Promise<boolean> - True if the file is a valid, processable PDF
   */
  async isValidPDF(filePath: string): Promise<boolean> {
    console.log(`[PDFProcessorService] Validating PDF: ${filePath}`);

    // Basic validation
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    // Check extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pdf') {
      return false;
    }

    // Check if file exists and is readable
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      return false;
    }

    // Read file and check PDF magic bytes
    try {
      const fileHandle = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(8);
      await fileHandle.read(buffer, 0, 8, 0);
      await fileHandle.close();

      // PDF files start with "%PDF-"
      const header = buffer.toString('ascii', 0, 5);
      if (header !== '%PDF-') {
        console.log(`[PDFProcessorService] Invalid PDF header: ${header}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[PDFProcessorService] Error validating PDF:`, error);
      return false;
    }
  }

  /**
   * Classify a parse error into a specific error code
   *
   * @param errorMessage - The error message from pdf-parse
   * @returns PDFErrorCode - The classified error code
   */
  private classifyParseError(errorMessage: string): PDFErrorCode {
    const lowerMessage = errorMessage.toLowerCase();

    // Password protected detection
    if (
      lowerMessage.includes('password') ||
      lowerMessage.includes('encrypted') ||
      lowerMessage.includes('need a password')
    ) {
      return 'PASSWORD_PROTECTED';
    }

    // Corrupted file detection
    if (
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('corrupt') ||
      lowerMessage.includes('malformed') ||
      lowerMessage.includes('bad') ||
      lowerMessage.includes('not a pdf') ||
      lowerMessage.includes('unexpected') ||
      lowerMessage.includes('stream')
    ) {
      return 'CORRUPTED';
    }

    // Default to corrupted for unknown parse errors
    return 'CORRUPTED';
  }

  /**
   * Get a human-readable error message for a given error code
   *
   * @param errorCode - The error code
   * @param originalMessage - The original error message
   * @returns string - Human-readable error message
   */
  private getHumanReadableError(errorCode: PDFErrorCode, originalMessage: string): string {
    switch (errorCode) {
      case 'PASSWORD_PROTECTED':
        return 'PDF is password protected and cannot be processed';
      case 'CORRUPTED':
        return `PDF file is corrupted or invalid: ${originalMessage}`;
      case 'EMPTY_PDF':
        return 'PDF contains no extractable text (may be image-only)';
      case 'READ_ERROR':
        return `Failed to read PDF file: ${originalMessage}`;
      default:
        return `PDF processing error: ${originalMessage}`;
    }
  }
}

/**
 * Get the singleton instance of PDFProcessorService
 */
export function getPDFProcessorService(): PDFProcessorService {
  return PDFProcessorService.getInstance();
}

export default PDFProcessorService;
