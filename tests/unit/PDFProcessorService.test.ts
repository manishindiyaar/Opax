/**
 * Unit Tests: PDFProcessorService
 *
 * Tests the PDF text extraction service including:
 * - Successful text extraction
 * - Error handling for various PDF issues
 * - File validation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getPDFProcessorService, PDFExtractionResult } from '../../src/main/services/PDFProcessorService';

// Test fixtures directory
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const TEST_PDF_PATH = path.join(FIXTURES_DIR, 'test-sample.pdf');
const EMPTY_FILE_PATH = path.join(FIXTURES_DIR, 'empty-file.pdf');
const NOT_A_PDF_PATH = path.join(FIXTURES_DIR, 'not-a-pdf.pdf');
const TEXT_FILE_PATH = path.join(FIXTURES_DIR, 'text-file.txt');

describe('PDFProcessorService', () => {
  const service = getPDFProcessorService();

  beforeAll(async () => {
    // Create fixtures directory
    await fs.promises.mkdir(FIXTURES_DIR, { recursive: true });

    // Create an empty file
    await fs.promises.writeFile(EMPTY_FILE_PATH, '');

    // Create a file that's not a PDF (wrong magic bytes)
    await fs.promises.writeFile(NOT_A_PDF_PATH, 'This is not a PDF file');

    // Create a text file
    await fs.promises.writeFile(TEXT_FILE_PATH, 'This is a text file');
  });

  afterAll(async () => {
    // Clean up fixtures
    try {
      await fs.promises.rm(FIXTURES_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('extractText', () => {
    it('should return READ_ERROR for invalid file path', async () => {
      const result = await service.extractText('');
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('READ_ERROR');
      expect(result.error).toContain('Invalid file path');
    });

    it('should return READ_ERROR for non-existent file', async () => {
      const result = await service.extractText('/path/to/nonexistent/file.pdf');
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('READ_ERROR');
      expect(result.error).toContain('not found or not accessible');
    });

    it('should return READ_ERROR for non-PDF file extension', async () => {
      const result = await service.extractText(TEXT_FILE_PATH);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('READ_ERROR');
      expect(result.error).toContain('Invalid file type');
    });

    it('should return CORRUPTED for empty PDF file', async () => {
      const result = await service.extractText(EMPTY_FILE_PATH);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CORRUPTED');
      expect(result.error).toContain('empty');
    });

    it('should return CORRUPTED for file with wrong magic bytes', async () => {
      const result = await service.extractText(NOT_A_PDF_PATH);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CORRUPTED');
    });
  });

  describe('isValidPDF', () => {
    it('should return false for empty string path', async () => {
      const result = await service.isValidPDF('');
      expect(result).toBe(false);
    });

    it('should return false for non-existent file', async () => {
      const result = await service.isValidPDF('/path/to/nonexistent/file.pdf');
      expect(result).toBe(false);
    });

    it('should return false for non-PDF extension', async () => {
      const result = await service.isValidPDF(TEXT_FILE_PATH);
      expect(result).toBe(false);
    });

    it('should return false for file with wrong magic bytes', async () => {
      const result = await service.isValidPDF(NOT_A_PDF_PATH);
      expect(result).toBe(false);
    });

    it('should return false for empty file', async () => {
      const result = await service.isValidPDF(EMPTY_FILE_PATH);
      expect(result).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getPDFProcessorService();
      const instance2 = getPDFProcessorService();
      expect(instance1).toBe(instance2);
    });
  });

  describe('error classification', () => {
    it('should handle null/undefined path gracefully', async () => {
      // @ts-expect-error - Testing invalid input
      const result1 = await service.extractText(null);
      expect(result1.success).toBe(false);
      expect(result1.errorCode).toBe('READ_ERROR');

      // @ts-expect-error - Testing invalid input
      const result2 = await service.extractText(undefined);
      expect(result2.success).toBe(false);
      expect(result2.errorCode).toBe('READ_ERROR');
    });
  });
});
