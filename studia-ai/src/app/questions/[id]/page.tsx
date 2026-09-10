"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Question {
  id: string;
  content: string;
  difficulty: string;
  questionType: string;
  explanation?: string;
  topic: {
    id: string;
    name: string;
    subject: {
      id: string;
      name: string;
    };
  };
  options: {
    id: string;
    content: string;
    order: number;
  }[];
}

export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuestion() {
      try {
        const res = await fetch(`/api/questions/${params.id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch question");
        }
        const data = await res.json();
        setQuestion(data.question || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchQuestion();
  }, [params.id]);

  if (loading) {
    return <div className="p-8">Loading question...</div>;
  }

  if (error || !question) {
    return <div className="p-8 text-red-500">Error: {error || "Question not found"}</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        onClick={() => router.back()}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← Back to Questions
      </button>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">{question.content}</h1>

        <div className="flex gap-4 mb-6 text-sm text-gray-500">
          <span className="px-2 py-1 bg-gray-100 rounded">
            {question.difficulty}
          </span>
          <span className="px-2 py-1 bg-gray-100 rounded">
            {question.questionType.replace("_", " ")}
          </span>
        </div>

        <div className="mb-6">
          <p className="text-gray-600 mb-2">
            <strong>Topic:</strong> {question.topic.name}
          </p>
          <p className="text-gray-600">
            <strong>Subject:</strong> {question.topic.subject.name}
          </p>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Options:</h2>
          <ul className="space-y-2">
            {question.options.map((option, index) => (
              <li
                key={option.id}
                className="p-3 border rounded-lg bg-gray-50"
              >
                <span className="font-medium mr-2">{index + 1}.</span>
                {option.content}
              </li>
            ))}
          </ul>
        </div>

        {question.explanation && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Explanation:</h3>
            <p className="text-blue-700">{question.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
