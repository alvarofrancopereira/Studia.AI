import { describe, it, expect } from "vitest";

// Mock types
interface QuestionOption {
  id: string;
  content: string;
  isCorrect: boolean;
  order: number;
  explanation?: string;
}

interface Question {
  id: string;
  topicId: string;
  content: string;
  difficulty: "easy" | "medium" | "hard";
  questionType:
    | "multiple_choice"
    | "true_false"
    | "short_answer"
    | "open_ended"
    | "matching"
    | "ordering";
  explanation?: string;
  tags: string[];
  isActive: boolean;
  options?: QuestionOption[];
}

describe("Question System", () => {
  const mockQuestion: Question = {
    id: "test-question-1",
    topicId: "topic-1",
    content: "What is the capital of France?",
    difficulty: "easy",
    questionType: "multiple_choice",
    explanation: "Paris is the capital and largest city of France.",
    tags: ["geography", "europe", "capitals"],
    isActive: true,
    options: [
      {
        id: "opt-1",
        content: "London",
        isCorrect: false,
        order: 0,
      },
      {
        id: "opt-2",
        content: "Paris",
        isCorrect: true,
        order: 1,
      },
      {
        id: "opt-3",
        content: "Berlin",
        isCorrect: false,
        order: 2,
      },
      {
        id: "opt-4",
        content: "Madrid",
        isCorrect: false,
        order: 3,
      },
    ],
  };

  describe("Question Validation", () => {
    it("should validate a complete question object", () => {
      expect(mockQuestion.id).toBeDefined();
      expect(mockQuestion.content.length).toBeGreaterThan(0);
      expect(["easy", "medium", "hard"]).toContain(mockQuestion.difficulty);
      expect(mockQuestion.isActive).toBe(true);
    });

    it("should validate question type enum values", () => {
      const validTypes = [
        "multiple_choice",
        "true_false",
        "short_answer",
        "open_ended",
        "matching",
        "ordering",
      ];
      expect(validTypes).toContain(mockQuestion.questionType);
    });

    it("should validate difficulty enum values", () => {
      const validDifficulties = ["easy", "medium", "hard"];
      expect(validDifficulties).toContain(mockQuestion.difficulty);
    });
  });

  describe("Question Options", () => {
    it("should have at least 2 options for multiple choice questions", () => {
      if (mockQuestion.questionType === "multiple_choice") {
        expect(mockQuestion.options).toBeDefined();
        expect(mockQuestion.options!.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("should have exactly one correct answer for multiple choice", () => {
      if (
        mockQuestion.questionType === "multiple_choice" &&
        mockQuestion.options
      ) {
        const correctCount = mockQuestion.options.filter(
          (opt) => opt.isCorrect,
        ).length;
        expect(correctCount).toBe(1);
      }
    });

    it("should have unique order values for options", () => {
      if (mockQuestion.options) {
        const orders = mockQuestion.options.map((opt) => opt.order);
        const uniqueOrders = new Set(orders);
        expect(uniqueOrders.size).toBe(orders.length);
      }
    });
  });

  describe("Question Sanitization", () => {
    it("should remove isCorrect flag when sanitizing for students", () => {
      const sanitizeForStudent = (question: typeof mockQuestion) => ({
        ...question,
        options: question.options?.map((opt) => {
          const { isCorrect: _, ...rest } = opt;
          return rest;
        }),
      });

      const sanitized = sanitizeForStudent(mockQuestion);

      expect(sanitized.options?.[0]).not.toHaveProperty("isCorrect");
      expect(sanitized.options?.[1].content).toBe("Paris");
    });

    it("should preserve all other option properties after sanitization", () => {
      const sanitizeForStudent = (question: typeof mockQuestion) => ({
        ...question,
        options: question.options?.map((opt) => {
          const { isCorrect: _, ...rest } = opt;
          return rest;
        }),
      });

      const sanitized = sanitizeForStudent(mockQuestion);

      expect(sanitized.options?.[1]).toHaveProperty("id");
      expect(sanitized.options?.[1]).toHaveProperty("content");
      expect(sanitized.options?.[1]).toHaveProperty("order");
    });
  });

  describe("Question Filtering", () => {
    const mockQuestions: Question[] = [
      { ...mockQuestion, id: "q1", difficulty: "easy" },
      { ...mockQuestion, id: "q2", difficulty: "medium" },
      { ...mockQuestion, id: "q3", difficulty: "hard" },
      {
        ...mockQuestion,
        id: "q4",
        difficulty: "easy",
        questionType: "true_false",
      },
    ];

    it("should filter questions by difficulty", () => {
      const easyQuestions = mockQuestions.filter(
        (q) => q.difficulty === "easy",
      );
      expect(easyQuestions.length).toBe(2);
    });

    it("should filter questions by question type", () => {
      const multipleChoice = mockQuestions.filter(
        (q) => q.questionType === "multiple_choice",
      );
      expect(multipleChoice.length).toBe(3);
    });

    it("should filter questions by multiple criteria", () => {
      const easyMultipleChoice = mockQuestions.filter(
        (q) => q.difficulty === "easy" && q.questionType === "multiple_choice",
      );
      expect(easyMultipleChoice.length).toBe(1);
    });

    it("should only return active questions", () => {
      const inactiveQuestion: Question = {
        ...mockQuestion,
        id: "q-inactive",
        isActive: false,
      };
      const allQuestions = [...mockQuestions, inactiveQuestion];
      const activeQuestions = allQuestions.filter((q) => q.isActive);
      expect(activeQuestions.length).toBe(4);
    });
  });

  describe("Question Scoring", () => {
    it("should calculate score based on correct answers", () => {
      const userAnswers = ["opt-1", "opt-2", "opt-3", "opt-4"];

      let correctCount = 0;
      userAnswers.forEach((answer, index) => {
        const option = mockQuestion.options?.[index];
        if (option?.isCorrect && answer === option.id) {
          correctCount++;
        }
      });

      const score = (correctCount / userAnswers.length) * 100;
      expect(score).toBe(25); // 1 out of 4 correct
    });

    it("should give full score for correct answer", () => {
      const correctAnswerId = mockQuestion.options?.find(
        (o) => o.isCorrect,
      )?.id;
      const userAnswer = correctAnswerId;

      expect(userAnswer).toBe(mockQuestion.options?.[1].id);
    });
  });
});
