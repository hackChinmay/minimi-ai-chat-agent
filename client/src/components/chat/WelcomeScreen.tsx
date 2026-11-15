import React from 'react';
import { Globe, Brain, History, GitCompare, Sparkles, ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onSelectPrompt: (promptText: string) => void;
}

interface CapabilityCard {
  title: string;
  tag: string;
  prompt: string;
  icon: React.ReactNode;
  color: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectPrompt }) => {
  const capabilities: CapabilityCard[] = [
    {
      title: 'Real-Time Web Research',
      tag: 'Live Search',
      prompt: 'Research the latest developments in AI agents.',
      icon: <Globe className="w-5 h-5" />,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:border-emerald-500/40',
    },
    {
      title: 'Conversation Memory',
      tag: 'Context Recall',
      prompt: 'What topics have we discussed before?',
      icon: <Brain className="w-5 h-5" />,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20 group-hover:border-blue-500/40',
    },
    {
      title: 'Historical Retrieval',
      tag: 'Temporal Query',
      prompt: 'Who was the UK Prime Minister in 2022?',
      icon: <History className="w-5 h-5" />,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:border-amber-500/40',
    },
    {
      title: 'Intelligent Comparison',
      tag: 'Delta Evaluation',
      prompt: 'Compare the pricing of GitHub Copilot in 2022 with current 2026 pricing.',
      icon: <GitCompare className="w-5 h-5" />,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20 group-hover:border-purple-500/40',
    },
    {
      title: 'Follow-up Reasoning',
      tag: 'Multi-turn Logic',
      prompt: 'Based on our previous discussion, what would you recommend?',
      icon: <Sparkles className="w-5 h-5" />,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20 group-hover:border-rose-500/40',
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-4xl mx-auto w-full">
      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300 font-medium mb-6 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        Grounded AI Agent with Web Search & Persistent Memory
      </div>

      {/* Main Greeting */}
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-center text-slate-100 mb-3">
        Hello! How can <span className="text-emerald-400">MiniMi AI</span> assist you today?
      </h1>
      <p className="text-slate-400 text-sm md:text-base text-center max-w-xl mb-10 leading-relaxed">
        Ask factual questions, explore live web research with verified source citations, or recall and compare historical milestones across conversations.
      </p>

      {/* Capability Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full">
        {capabilities.map((cap, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(cap.prompt)}
            className={`group flex items-start gap-3.5 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-900 hover:shadow-lg transition-all text-left duration-200 cursor-pointer ${
              idx === 4 ? 'md:col-span-2' : ''
            }`}
          >
            <div className={`p-2 rounded-lg border shrink-0 ${cap.color}`}>
              {cap.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {cap.tag}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-sm font-medium text-slate-200 group-hover:text-emerald-300 transition-colors line-clamp-2">
                "{cap.prompt}"
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
