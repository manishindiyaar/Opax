/**
 * CardRenderer Component
 * Selects and renders cards based on metadata.componentType from MCP response.
 * Falls back to tool name lookup for backward compatibility.
 */

import React from 'react';
import { CardRendererProps, MCPResponse } from './types';
import { getCardByComponentType, getCardForTool } from './index';
import { ToolCallCard } from '../components/ToolCallCard';

function parseToolOutput(toolOutput: string): MCPResponse | null {
  if (!toolOutput || toolOutput.trim() === '') return null;
  try {
    return JSON.parse(toolOutput);
  } catch {
    return null;
  }
}

export const CardRenderer: React.FC<CardRendererProps> = ({
  toolName,
  toolOutput,
  toolCallId,
  status,
}) => {
  const parsedOutput = parseToolOutput(toolOutput);

  // No parseable output — show raw fallback
  if (!parsedOutput) {
    return (
      <ToolCallCard
        toolCall={{ id: `fb-${Date.now()}`, name: toolName, arguments: '', result: toolOutput, status }}
      />
    );
  }

  const { success, data, metadata } = parsedOutput;

  // Always try metadata.componentType first — even for success:false
  // The MCP server controls which card to show via componentType
  if (metadata?.componentType) {
    const CardComponent = getCardByComponentType(metadata.componentType);
    if (CardComponent) {
      // For error-card, pass error info in data
      if (metadata.componentType === 'error-card') {
        return <CardComponent data={{ error: metadata.error || 'Operation failed' }} status="error" metadata={metadata} />;
      }
      // For form-card, pass toolCallId for human-in-the-loop
      if (metadata.componentType === 'form-card') {
        return <CardComponent data={data} status={success ? status : 'error'} metadata={metadata} toolCallId={toolCallId} />;
      }
      // For any other card, pass data + metadata through
      return <CardComponent data={data} status={success ? status : 'error'} metadata={metadata} />;
    }
  }

  // If success:false and no card found, show error fallback
  if (!success) {
    return (
      <ToolCallCard
        toolCall={{ id: `err-${Date.now()}`, name: toolName, arguments: '', result: metadata?.error || 'Tool execution failed', status: 'error' }}
      />
    );
  }

  // Fallback: look up by tool name
  const FallbackCard = getCardForTool(toolName);
  if (FallbackCard) {
    return <FallbackCard data={data} status={status} metadata={metadata} />;
  }

  // Last resort: raw ToolCallCard
  return (
    <ToolCallCard
      toolCall={{ id: `fb-${Date.now()}`, name: toolName, arguments: '', result: toolOutput, status }}
    />
  );
};

export default CardRenderer;
