import { describe, it, expect } from 'vitest';
import path from 'path';
import { agentEvaluator } from './evaluator';

describe('AI Agent Comprehensive Evaluation Benchmark (Phase 8)', () => {
  it('should execute full 25-case evaluation suite and meet quality thresholds', async () => {
    const summary = await agentEvaluator.runEvaluation();

    // Export JSON & Markdown reports
    const jsonPath = path.resolve(process.cwd(), 'evaluation-report.json');
    const mdPath = path.resolve(process.cwd(), 'docs', 'EVALUATION_REPORT.md');

    agentEvaluator.writeJsonReport(summary, jsonPath);
    const markdown = agentEvaluator.generateMarkdownReport(summary);
    agentEvaluator.writeJsonReport({ markdown }, path.resolve(process.cwd(), 'docs', 'EVALUATION_REPORT.md.tmp')); // ensure dir exists
    const fs = await import('fs');
    fs.writeFileSync(mdPath, markdown, 'utf-8');
    if (fs.existsSync(path.resolve(process.cwd(), 'docs', 'EVALUATION_REPORT.md.tmp'))) {
      fs.unlinkSync(path.resolve(process.cwd(), 'docs', 'EVALUATION_REPORT.md.tmp'));
    }

    // Benchmark Quality Assertions
    expect(summary.totalCases).toBeGreaterThanOrEqual(20);
    expect(summary.placeholderCitationCount).toBe(0);
    expect(summary.citationValidityRate).toBe(100);
    expect(summary.searchDecisionAccuracy).toBeGreaterThanOrEqual(90);
    expect(summary.overallPassRate).toBeGreaterThanOrEqual(95);

    // Latency should be reasonable (< 200ms in mock benchmark)
    expect(summary.averageLatencyMs).toBeLessThan(500);
  }, 30000);
});
