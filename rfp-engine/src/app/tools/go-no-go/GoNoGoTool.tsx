"use client";

import { useState } from "react";
import Link from "next/link";

interface Question {
  id: string;
  category: string;
  categoryDescription: string;
  question: string;
  options: { label: string; score: number; description: string }[];
  maxScore: number;
}

const questions: Question[] = [
  {
    id: "strategic_fit",
    category: "Strategic Fit",
    categoryDescription: "Does this opportunity align with your company's strategic goals?",
    question: "How well does this opportunity align with your strategic direction?",
    maxScore: 20,
    options: [
      { label: "Perfect fit", score: 20, description: "Directly aligns with target market and growth plans" },
      { label: "Good alignment", score: 15, description: "Opens doors to desired market segment" },
      { label: "Neutral", score: 10, description: "Not strategic, but not a distraction either" },
      { label: "Marginal fit", score: 5, description: "Would divert resources from strategic priorities" },
      { label: "Misaligned", score: 0, description: "Wrong market or capability area" },
    ],
  },
  {
    id: "capability_experience",
    category: "Capability Match",
    categoryDescription: "Do you have experience delivering similar solutions?",
    question: "What is your experience level with this type of work?",
    maxScore: 25,
    options: [
      { label: "Extensive", score: 25, description: "Done this exact thing multiple times successfully" },
      { label: "Strong", score: 20, description: "Solid experience with minor gaps easily filled" },
      { label: "Moderate", score: 15, description: "Good foundation, some areas require new hires or partners" },
      { label: "Limited", score: 10, description: "Would stretch current capabilities" },
      { label: "Significant gaps", score: 5, description: "Risky to deliver successfully" },
      { label: "No capability", score: 0, description: "Can't reasonably acquire needed capabilities" },
    ],
  },
  {
    id: "mandatory_requirements",
    category: "Capability Match",
    categoryDescription: "Can you meet all mandatory requirements?",
    question: "Can you comply with all 'shall' (mandatory) requirements?",
    maxScore: 0, // This is a modifier, not added to score
    options: [
      { label: "Yes, all of them", score: 0, description: "We meet every mandatory requirement" },
      { label: "Most, with workarounds", score: -10, description: "Minor gaps with reasonable mitigations" },
      { label: "No, significant gaps", score: -100, description: "Cannot comply with one or more mandatory requirements" },
    ],
  },
  {
    id: "competitive_position",
    category: "Competitive Position",
    categoryDescription: "How do you stack up against likely competitors?",
    question: "What is your competitive position for this opportunity?",
    maxScore: 20,
    options: [
      { label: "Strong advantage", score: 20, description: "Incumbent, strong relationship, or unique capability" },
      { label: "Competitive", score: 15, description: "Clear differentiators vs. competition" },
      { label: "Level field", score: 10, description: "Fair competition, outcome uncertain" },
      { label: "Disadvantaged", score: 5, description: "Competitors have advantages we'll struggle to overcome" },
      { label: "Wired for competitor", score: 0, description: "RFP seems written for a specific vendor (not us)" },
    ],
  },
  {
    id: "relationship",
    category: "Relationship & Intelligence",
    categoryDescription: "How well do you know this buyer?",
    question: "What is your relationship with this buyer?",
    maxScore: 20,
    options: [
      { label: "Existing client", score: 20, description: "Strong relationships with decision-makers" },
      { label: "Good contacts", score: 15, description: "Have met key stakeholders, understand their needs" },
      { label: "Some contacts", score: 10, description: "Limited insight into priorities" },
      { label: "Cold opportunity", score: 5, description: "Responding to public RFP with no relationship" },
      { label: "Unknown org", score: 0, description: "No way to gather intelligence" },
    ],
  },
  {
    id: "commercial",
    category: "Commercial Viability",
    categoryDescription: "Does the business case make sense?",
    question: "How attractive are the commercial terms?",
    maxScore: 15,
    options: [
      { label: "Very attractive", score: 15, description: "Strong margins, reasonable terms, funded project" },
      { label: "Acceptable", score: 10, description: "Standard margins and terms" },
      { label: "Tight margins", score: 5, description: "Strategic value justifies lower margins" },
      { label: "Unfavorable", score: 0, description: "Terms unacceptable or budget unclear" },
    ],
  },
];

interface Answers {
  [key: string]: number;
}

function getRecommendation(score: number, hasMandatoryGap: boolean): {
  level: "strong-go" | "conditional-go" | "likely-no" | "no-go";
  title: string;
  description: string;
  color: string;
  bgColor: string;
  iconColor: string;
} {
  if (hasMandatoryGap) {
    return {
      level: "no-go",
      title: "NO-GO: Mandatory Requirements Gap",
      description: "You cannot meet one or more mandatory requirements. Unless you can resolve this gap, pursuing this RFP will waste resources and could damage your reputation.",
      color: "text-red-700",
      bgColor: "bg-red-50 border-red-200",
      iconColor: "bg-red-100 text-red-600",
    };
  }

  if (score >= 75) {
    return {
      level: "strong-go",
      title: "STRONG GO",
      description: "This opportunity scores highly across all dimensions. Pursue aggressively and allocate your best resources. This is the type of RFP you should prioritize.",
      color: "text-[#166534]",
      bgColor: "bg-[#dcfce7] border-[#86efac]",
      iconColor: "bg-[#dcfce7] text-[#16a34a]",
    };
  }

  if (score >= 50) {
    return {
      level: "conditional-go",
      title: "CONDITIONAL GO",
      description: "This opportunity has potential but also has weak areas. Proceed with caution and develop mitigation strategies for low-scoring dimensions before committing fully.",
      color: "text-[#a16207]",
      bgColor: "bg-[#fef9c3] border-[#fde047]",
      iconColor: "bg-[#fef9c3] text-[#ca8a04]",
    };
  }

  if (score >= 25) {
    return {
      level: "likely-no",
      title: "LIKELY NO-GO",
      description: "The numbers suggest this isn't a strong opportunity. Only pursue if there's significant strategic value not captured in this assessment (e.g., gateway to a major account).",
      color: "text-orange-700",
      bgColor: "bg-orange-50 border-orange-200",
      iconColor: "bg-orange-100 text-orange-600",
    };
  }

  return {
    level: "no-go",
    title: "NO-GO",
    description: "This opportunity scores poorly across multiple dimensions. Your resources are better spent on higher-probability opportunities. Pass on this one.",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
    iconColor: "bg-red-100 text-red-600",
  };
}

export function GoNoGoTool() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [showResults, setShowResults] = useState(false);

  const handleAnswer = (questionId: string, score: number) => {
    setAnswers({ ...answers, [questionId]: score });

    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowResults(true);
    }
  };

  const calculateScore = (): number => {
    let total = 0;
    for (const [key, value] of Object.entries(answers)) {
      total += value;
    }
    // Normalize to 0-100 (max possible is 100, but mandatory can subtract)
    return Math.max(0, Math.min(100, total));
  };

  const hasMandatoryGap = answers.mandatory_requirements === -100;

  const resetTool = () => {
    setAnswers({});
    setCurrentStep(0);
    setShowResults(false);
  };

  const score = calculateScore();
  const recommendation = getRecommendation(score, hasMandatoryGap);

  if (showResults) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="font-extrabold text-xl text-slate-800 tracking-tight">
              RFP Matrix
            </Link>
            <Link href="/blog/go-no-go-decision-framework" className="text-[#0d9488] hover:text-[#0f766e] text-sm font-medium">
              Read the full framework &rarr;
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Your Assessment Results</h1>
            <p className="text-slate-600">Based on your responses, here&apos;s our recommendation:</p>
          </div>

          {/* Score Display */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8 text-center">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-xl bg-gradient-to-br from-[#14b8a6] to-[#0d9488] mb-4">
              <span className="text-4xl font-bold text-white">{score}</span>
              <span className="text-lg text-white/80">/100</span>
            </div>

            <div className={`p-6 rounded-xl border ${recommendation.bgColor} mt-4`}>
              <h2 className={`text-2xl font-bold ${recommendation.color} mb-2`}>
                {recommendation.title}
              </h2>
              <p className="text-slate-700">{recommendation.description}</p>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Score Breakdown</h3>
            <div className="space-y-4">
              {questions.map((q) => {
                if (q.id === "mandatory_requirements") return null;
                const answer = answers[q.id] ?? 0;
                const percentage = (answer / q.maxScore) * 100;
                return (
                  <div key={q.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">{q.category}</span>
                      <span className="font-medium text-slate-800">{answer}/{q.maxScore}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          percentage >= 70 ? "bg-[#16a34a]" :
                          percentage >= 40 ? "bg-[#ca8a04]" : "bg-red-500"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={resetTool}
              className="px-6 py-3 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium transition-colors"
            >
              Assess Another RFP
            </button>
            <Link
              href="/signup"
              className="px-6 py-3 bg-[#14b8a6] text-white rounded-xl hover:bg-[#0d9488] font-medium text-center transition-colors"
            >
              Try RFP Matrix
            </Link>
          </div>

          {/* Related Content */}
          <div className="mt-12 p-6 bg-gradient-to-br from-[#0d9488] to-[#0f766e] rounded-2xl text-center text-white shadow-lg">
            <h3 className="text-lg font-bold mb-2">
              Decided to GO? Respond 10x faster.
            </h3>
            <p className="text-white/80 mb-4">
              RFP Matrix uses AI to extract requirements and generate draft responses automatically.
            </p>
            <Link
              href="/signup"
              className="inline-block px-6 py-2 bg-white text-[#0d9488] rounded-xl hover:bg-slate-50 font-semibold transition-colors"
            >
              Get Started
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-xl text-slate-800 tracking-tight">
            RFP Matrix
          </Link>
          <span className="text-sm text-slate-500 font-medium">
            Question {currentStep + 1} of {questions.length}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#14b8a6] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Title (only on first question) */}
        {currentStep === 0 && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ccfbf1] border border-[#99f6e4] text-sm mb-4">
              <svg className="w-4 h-4 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[#0f766e] font-medium">Free Tool</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Go/No-Go Decision Tool
            </h1>
            <p className="text-slate-600">
              Answer 6 quick questions to get a data-driven recommendation on whether to pursue this RFP.
            </p>
          </div>
        )}

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-6">
            <span className="inline-block px-3 py-1 bg-[#ccfbf1] text-[#0f766e] text-sm font-medium rounded-lg mb-3">
              {currentQuestion.category}
            </span>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              {currentQuestion.question}
            </h2>
            <p className="text-slate-500 text-sm">
              {currentQuestion.categoryDescription}
            </p>
          </div>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(currentQuestion.id, option.score)}
                className="w-full p-4 border border-slate-200 rounded-xl text-left hover:border-[#14b8a6] hover:bg-[#f0fdfa] transition-colors group"
              >
                <div className="font-medium text-slate-800 group-hover:text-[#0d9488]">
                  {option.label}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  {option.description}
                </div>
              </button>
            ))}
          </div>

          {/* Back Button */}
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="mt-6 text-sm text-slate-500 hover:text-[#0d9488] transition-colors"
            >
              &larr; Previous question
            </button>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-[#ccfbf1] rounded-xl text-center text-sm text-[#0f766e] border border-[#99f6e4]">
          <p>
            This tool is based on our{" "}
            <Link href="/blog/go-no-go-decision-framework" className="text-[#0d9488] hover:text-[#0f766e] font-medium underline decoration-[#0d9488]/30">
              Go/No-Go Decision Framework
            </Link>
            . Read the full article for detailed scoring guidance.
          </p>
        </div>
      </main>
    </div>
  );
}
