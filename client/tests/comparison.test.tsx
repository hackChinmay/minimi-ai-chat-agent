import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComparisonCard } from '../src/components/chat/ComparisonCard';
import { ComparisonResult } from '../src/types/api';

describe('ComparisonCard', () => {
  it('renders CONFIRMED_CHANGE comparison with delta and citations', () => {
    const comparison: ComparisonResult = {
      conversationId: 'conv-1',
      entity: 'Anthropic Claude 3.5 Sonnet',
      attribute: 'MMLU Benchmark Score',
      verdict: 'CONFIRMED_CHANGE',
      confidence: 'high',
      historical: {
        value: '88.7%',
        period: 'June 2024',
        timestamp: '2024-06-20T12:00:00Z',
        sourceUrl: 'https://anthropic.com/news/claude-3-5-sonnet',
        sourceTitle: 'Anthropic Launch Post',
      },
      current: {
        value: '90.4%',
        period: 'October 2024',
        timestamp: '2024-10-22T12:00:00Z',
        sourceUrl: 'https://anthropic.com/news/3-5-models-and-computer-use',
        sourceTitle: 'Upgraded Sonnet Release',
      },
      deltaSummary: 'Increased by 1.7 percentage points',
      delta: {
        summary: 'Increased by 1.7 percentage points',
        numericDelta: 1.7,
        percentageChange: 1.9,
      },
      explanation: 'Anthropic updated Claude 3.5 Sonnet with architectural refinements improving general reasoning.',
      citations: [
        {
          id: 'cit-1',
          index: 1,
          title: 'Anthropic Research',
          url: 'https://anthropic.com/research',
          content: 'Benchmark tables',
          source: 'anthropic.com',
        },
      ],
      sources: [],
      metadata: {
        comparisonTimeMs: 420,
        searchUsed: true,
        confidence: 'high',
      },
    };

    render(<ComparisonCard comparison={comparison} />);

    expect(screen.getByTestId('comparison-card')).toBeInTheDocument();
    expect(screen.getByText('Anthropic Claude 3.5 Sonnet')).toBeInTheDocument();
    expect(screen.getByText('• MMLU Benchmark Score')).toBeInTheDocument();
    expect(screen.getByText('Confirmed Change')).toBeInTheDocument();
    expect(screen.getByText('high confidence')).toBeInTheDocument();

    // Check historical & current baseline values
    expect(screen.getByText('88.7%')).toBeInTheDocument();
    expect(screen.getByText('90.4%')).toBeInTheDocument();
    expect(screen.getByText('June 2024')).toBeInTheDocument();
    expect(screen.getByText('October 2024')).toBeInTheDocument();

    // Check delta metrics
    expect(screen.getByText('Δ +1.7')).toBeInTheDocument();
    expect(screen.getByText('+1.9%')).toBeInTheDocument();

    // Check explanation and sources
    expect(screen.getByText(/Anthropic updated Claude 3.5 Sonnet/)).toBeInTheDocument();
    expect(screen.getByText('Anthropic Research')).toBeInTheDocument();
  });

  it('renders NO_DETECTED_CHANGE verdict correctly', () => {
    const comparison: ComparisonResult = {
      conversationId: 'conv-2',
      entity: 'Python',
      attribute: 'GIL Architecture',
      verdict: 'NO_DETECTED_CHANGE',
      confidence: 'medium',
      historical: {
        value: 'GIL enabled by default',
        timestamp: '2025-01-01T00:00:00Z',
      },
      current: {
        value: 'GIL enabled by default',
        timestamp: '2026-03-31T00:00:00Z',
      },
      deltaSummary: 'No verified structural change',
      explanation: 'CPython free-threading remains experimental and GIL is active in default builds.',
      citations: [],
      sources: [],
      metadata: {
        comparisonTimeMs: 310,
        searchUsed: true,
        confidence: 'medium',
      },
    };

    render(<ComparisonCard comparison={comparison} />);

    expect(screen.getByText('No Detected Change')).toBeInTheDocument();
    expect(screen.getByText('medium confidence')).toBeInTheDocument();
  });

  it('renders UNABLE_TO_VERIFY verdict correctly', () => {
    const comparison: ComparisonResult = {
      conversationId: 'conv-3',
      entity: 'Project Titan',
      attribute: 'Release Date',
      verdict: 'UNABLE_TO_VERIFY',
      historical: {
        value: 'Rumored 2025',
        timestamp: '2024-01-01T00:00:00Z',
      },
      current: {
        value: 'Unconfirmed',
        timestamp: '2026-03-31T00:00:00Z',
      },
      deltaSummary: 'Insufficient public verified documentation',
      explanation: 'Public statements do not provide verified timelines.',
      citations: [],
      sources: [],
      metadata: {
        comparisonTimeMs: 250,
        searchUsed: false,
        confidence: 'low',
      },
    };

    render(<ComparisonCard comparison={comparison} />);

    expect(screen.getByText('Unable to Verify')).toBeInTheDocument();
  });
});
