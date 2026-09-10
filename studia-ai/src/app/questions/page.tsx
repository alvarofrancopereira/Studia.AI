"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Question {
  id: string;
  content: string;
  difficulty: string;
  questionType: string;
  topic: {
    id: string;
    name: string;
    subject: {
      id: string;
      name: string;
    };
  };
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch("/api/questions");
        if (!res.ok) {
          throw new Error("Failed to fetch questions");
        }
        const data = await res.json();
        setQuestions(data.questions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchQuestions();
  }, []);

  if (loading) {
    return <div className="p-8">Loading questions...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Questions</h1>
      {questions.length === 0 ? (
        <p className="text-gray-500">No questions found.</p>
      ) : (
        <ul className="space-y-4">
          {questions.map((question) => (
            <li
              key={question.id}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{question.content}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Topic: {question.topic.name} •{" "}
                    {question.topic.subject.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Difficulty: {question.difficulty} • Type:{" "}
                    {question.questionType}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
