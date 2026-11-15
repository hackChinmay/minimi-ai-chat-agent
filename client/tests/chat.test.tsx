import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MessageBubble } from '../src/components/chat/MessageBubble';
import { SourceCitations } from '../src/components/chat/SourceCitations';
import { MarkdownContent } from '../src/components/chat/MarkdownContent';
import { LoadingIndicator } from '../src/components/chat/LoadingIndicator';
import { ConversationMessage, SearchResultItem } from '../src/types/api';

describe('Chat Components', () => {
  describe('MessageBubble', () => {
    it('renders user message correctly', () => {
      const msg: ConversationMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'user',
        content: 'Hello MiniMi, how does quantum computing work?',
        createdAt: '2026-03-31T10:00:00Z',
      };

      render(<MessageBubble message={msg} />);

      expect(screen.getByTestId('message-user')).toBeInTheDocument();
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Hello MiniMi, how does quantum computing work?')).toBeInTheDocument();
    });

    it('renders assistant message with search indicator and latency', () => {
      const msg: ConversationMessage = {
        id: 'msg-2',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Quantum computing leverages qubits and superposition.',
        createdAt: '2026-03-31T10:00:02Z',
        metadata: {
          searchUsed: true,
          searchStatus: 'success',
          latencyMs: 1420,
        },
      };

      render(<MessageBubble message={msg} />);

      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      expect(screen.getByText('MiniMi AI')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('1.4s')).toBeInTheDocument();
    });

    it('copies message content when copy button is clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const msg: ConversationMessage = {
        id: 'msg-3',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Copy this text',
        createdAt: '2026-03-31T10:00:00Z',
      };

      render(<MessageBubble message={msg} />);

      const copyButton = screen.getByLabelText('Copy message');
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(writeTextMock).toHaveBeenCalledWith('Copy this text');
    });
  });

  describe('SourceCitations', () => {
    const mockSources: SearchResultItem[] = [
      {
        id: 'src-1',
        index: 1,
        title: 'DeepSeek-V3 Official Paper',
        url: 'https://arxiv.org/abs/2412.19437',
        content: 'DeepSeek-V3 architecture overview and benchmark scores.',
        source: 'arxiv.org',
      },
      {
        id: 'src-2',
        index: 2,
        title: 'Google DeepMind Technical Report',
        url: 'https://deepmind.google/technologies/gemini',
        content: 'Gemini technical details and performance milestones.',
        source: 'deepmind.google',
      },
    ];

    it('renders verified sources pill summary', () => {
      render(<SourceCitations sources={mockSources} defaultExpanded={false} />);

      expect(screen.getByText('Verified Sources (2)')).toBeInTheDocument();
      expect(screen.getByText('[1]')).toBeInTheDocument();
      expect(screen.getByText('arxiv.org')).toBeInTheDocument();
      expect(screen.getByText('[2]')).toBeInTheDocument();
      expect(screen.getByText('deepmind.google')).toBeInTheDocument();
    });

    it('toggles detailed source cards when clicked', () => {
      render(<SourceCitations sources={mockSources} defaultExpanded={false} />);

      const toggleButton = screen.getByLabelText('Toggle 2 sources');
      fireEvent.click(toggleButton);

      expect(screen.getByText('DeepSeek-V3 Official Paper')).toBeInTheDocument();
      expect(screen.getByText('DeepSeek-V3 architecture overview and benchmark scores.')).toBeInTheDocument();
    });

    it('renders safe URLs with proper external link attributes', () => {
      render(<SourceCitations sources={mockSources} defaultExpanded={true} />);

      const link = screen.getByText('DeepSeek-V3 Official Paper').closest('a');
      expect(link).toHaveAttribute('href', 'https://arxiv.org/abs/2412.19437');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('MarkdownContent', () => {
    it('renders headings, bold, inline code, and lists', () => {
      const markdown = `
### Model Overview
**Gemini 1.5 Pro** features a \`1M token\` window.
- Multi-modal support
- Fast inference
`;

      render(<MarkdownContent content={markdown} />);

      expect(screen.getByText('Model Overview')).toBeInTheDocument();
      expect(screen.getByText('Gemini 1.5 Pro')).toBeInTheDocument();
      expect(screen.getByText('1M token')).toBeInTheDocument();
      expect(screen.getByText('Multi-modal support')).toBeInTheDocument();
    });

    it('renders fenced code blocks with language badge', () => {
      const codeMarkdown = '```python\nprint("Hello World")\n```';

      render(<MarkdownContent content={codeMarkdown} />);

      expect(screen.getByText('python')).toBeInTheDocument();
      expect(screen.getByText('print("Hello World")')).toBeInTheDocument();
    });
  });

  describe('LoadingIndicator', () => {
    it('renders thinking state message', () => {
      render(<LoadingIndicator statusMessage="MiniMi is thinking..." />);

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.getByText('MiniMi is thinking...')).toBeInTheDocument();
    });
  });
});
