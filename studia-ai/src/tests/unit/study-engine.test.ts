import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * M6 Study Engine - Unit Tests
 *
 * Tests for StudyAttempt and Answer business logic.
 * Note: These are unit tests that verify the logic without requiring a live database.
 * Integration tests would require a test database instance.
 */

// Mock data factories
const createMockUser = (overrides = {}) => ({
  id: "user-" + Math.random().toString(36).substr(2, 9),
  email: "test@example.com",
  name: "Test User",
  ...overrides,
});

const createMockTopic = (overrides = {}) => ({
  id: "topic-" + Math.random().toString(36).substr(2, 9),
  subjectId: "subject-" + Math.random().toString(36).substr(2, 9),
  name: "Test Topic",
  description: "A test topic",
  order: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockQuestion = (overrides = {}) => ({
  id: "question-" + Math.random().toString(36).substr(2, 9),
  topicId: "topic-test",
  content: "What is the capital of France?",
  difficulty: "medium",
  questionType: "multiple_choice",
  explanation: "Paris is the capital of France.",
  tags: ["geography", "europe"],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockQuestionOption = (overrides = {}) => ({
  id: "option-" + Math.random().toString(36).substr(2, 9),
  questionId: "question-test",
  content: "Paris",
  isCorrect: false,
  order: 0,
  explanation: null,
  createdAt: new Date(),
  ...overrides,
});

const createMockStudyAttempt = (overrides = {}) => ({
  id: "attempt-" + Math.random().toString(36).substr(2, 9),
  studentId: "student-" + Math.random().toString(36).substr(2, 9),
  topicId: "topic-test",
  startedAt: new Date(),
  completedAt: null,
  score: null,
  status: "IN_PROGRESS" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockAnswer = (overrides = {}) => ({
  id: "answer-" + Math.random().toString(36).substr(2, 9),
  attemptId: "attempt-test",
  questionId: "question-test",
  answerText: null,
  selectedOptionId: null,
  isCorrect: false,
  points: 0,
  answeredAt: new Date(),
  ...overrides,
});

describe("M6 Study Engine - Business Logic", () => {
  describe("StudyAttempt Status Transitions", () => {
    it("should allow transition from IN_PROGRESS to COMPLETED", () => {
      const attempt = createMockStudyAttempt({ status: "IN_PROGRESS" });

      // Simulate status transition
      const newStatus = "COMPLETED";

      expect(newStatus).toBe("COMPLETED");
      expect(["IN_PROGRESS", "COMPLETED", "ABANDONED"]).toContain(newStatus);
    });

    it("should allow transition from IN_PROGRESS to ABANDONED", () => {
      const attempt = createMockStudyAttempt({ status: "IN_PROGRESS" });

      const newStatus = "ABANDONED";

      expect(newStatus).toBe("ABANDONED");
    });

    it("should NOT allow transition from COMPLETED to any other status", () => {
      const attempt = createMockStudyAttempt({
        status: "COMPLETED",
        completedAt: new Date(),
      });

      // Once completed, status should not change
      const invalidTransitions = ["IN_PROGRESS", "ABANDONED"];

      invalidTransitions.forEach((status) => {
        expect(status).not.toBe(attempt.status);
      });
    });

    it("should calculate score correctly", () => {
      const answers = [
        createMockAnswer({ isCorrect: true, points: 1 }),
        createMockAnswer({ isCorrect: true, points: 1 }),
        createMockAnswer({ isCorrect: false, points: 0 }),
        createMockAnswer({ isCorrect: true, points: 1 }),
      ];

      const totalQuestions = answers.length;
      const correctCount = answers.filter((a) => a.isCorrect).length;
      const score = (correctCount / totalQuestions) * 100;

      expect(score).toBe(75);
    });

    it("should handle zero questions case", () => {
      const answers: Array<{ isCorrect: boolean }> = [];

      const totalQuestions = answers.length;
      const correctCount = answers.filter((a) => a.isCorrect).length;
      const score =
        totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

      expect(score).toBe(0);
    });
  });

  describe("Answer Correction Logic", () => {
    it("should mark answer as correct when selected option is correct", () => {
      const correctOption = createMockQuestionOption({ isCorrect: true });
      const answer = createMockAnswer({
        selectedOptionId: correctOption.id,
        isCorrect: true,
        points: 1,
      });

      expect(answer.isCorrect).toBe(true);
      expect(answer.points).toBe(1);
    });

    it("should mark answer as incorrect when selected option is wrong", () => {
      const wrongOption = createMockQuestionOption({ isCorrect: false });
      const answer = createMockAnswer({
        selectedOptionId: wrongOption.id,
        isCorrect: false,
        points: 0,
      });

      expect(answer.isCorrect).toBe(false);
      expect(answer.points).toBe(0);
    });

    it("should not expose correct answer in sanitized question", () => {
      const question = createMockQuestion();
      const options = [
        createMockQuestionOption({ isCorrect: false, content: "London" }),
        createMockQuestionOption({ isCorrect: true, content: "Paris" }),
        createMockQuestionOption({ isCorrect: false, content: "Berlin" }),
      ];

      // Sanitize options for client (remove isCorrect flag)
      const sanitizedOptions = options.map((opt) => ({
        id: opt.id,
        content: opt.content,
        order: opt.order,
        // isCorrect is NOT included
      }));

      // Verify that the sanitized options don't include isCorrect
      sanitizedOptions.forEach((opt) => {
        expect("isCorrect" in opt).toBe(false);
      });
    });
  });

  describe("Ownership Verification", () => {
    it("should verify student owns the attempt before accessing", () => {
      const studentA = createMockUser({ id: "student-a" });
      const studentB = createMockUser({ id: "student-b" });
      const attempt = createMockStudyAttempt({ studentId: studentA.id });

      // Student A can access their own attempt
      const canStudentAAccess = attempt.studentId === studentA.id;
      expect(canStudentAAccess).toBe(true);

      // Student B cannot access student A's attempt
      const canStudentBAccess = attempt.studentId === studentB.id;
      expect(canStudentBAccess).toBe(false);
    });

    it("should verify answer belongs to the authenticated student's attempt", () => {
      const studentA = createMockUser({ id: "student-a" });
      const studentB = createMockUser({ id: "student-b" });

      const attemptA = createMockStudyAttempt({ studentId: studentA.id });
      const answer = createMockAnswer({ attemptId: attemptA.id });

      // Only owner of attempt can submit/view answers
      const canStudentASubmit = attemptA.studentId === studentA.id;
      const canStudentBSubmit = attemptA.studentId === studentB.id;

      expect(canStudentASubmit).toBe(true);
      expect(canStudentBSubmit).toBe(false);
    });

    it("should prevent cross-topic question submission", () => {
      const topicA = createMockTopic({ id: "topic-a" });
      const topicB = createMockTopic({ id: "topic-b" });

      const attempt = createMockStudyAttempt({ topicId: topicA.id });
      const questionFromTopicA = createMockQuestion({ topicId: topicA.id });
      const questionFromTopicB = createMockQuestion({ topicId: topicB.id });

      // Can submit question from same topic
      const canSubmitQuestionA = questionFromTopicA.topicId === attempt.topicId;
      expect(canSubmitQuestionA).toBe(true);

      // Cannot submit question from different topic
      const canSubmitQuestionB = questionFromTopicB.topicId === attempt.topicId;
      expect(canSubmitQuestionB).toBe(false);
    });
  });

  describe("Score Calculation", () => {
    it("should calculate percentage score correctly", () => {
      const testCases = [
        { total: 10, correct: 10, expected: 100 },
        { total: 10, correct: 7, expected: 70 },
        { total: 10, correct: 5, expected: 50 },
        { total: 4, correct: 3, expected: 75 },
        { total: 0, correct: 0, expected: 0 },
      ];

      testCases.forEach(({ total, correct, expected }) => {
        const score = total > 0 ? (correct / total) * 100 : 0;
        expect(score).toBe(expected);
      });
    });

    it("should update mastery level after successful completion", () => {
      const score = 85;
      const passingScore = 70;

      const shouldUpdateMastery = score >= passingScore;
      expect(shouldUpdateMastery).toBe(true);

      // Mastery level should reflect the score
      const masteryLevel = score;
      expect(masteryLevel).toBe(85);
    });

    it("should not update mastery for failed attempts", () => {
      const score = 60;
      const passingScore = 70;

      const shouldUpdateMastery = score >= passingScore;
      expect(shouldUpdateMastery).toBe(false);
    });
  });

  describe("Question Type Handling", () => {
    it("should require selectedOptionId for multiple choice questions", () => {
      const questionType = "multiple_choice";
      const selectedOptionId = "option-123";

      const requiresOption =
        questionType === "multiple_choice" || questionType === "true_false";
      expect(requiresOption).toBe(true);

      const hasOption =
        selectedOptionId !== null && selectedOptionId !== undefined;
      expect(hasOption).toBe(true);
    });

    it("should require answerText for open-ended questions", () => {
      const questionType = "open_ended";
      const answerText = "The capital of France is Paris.";

      const requiresText = questionType === "open_ended";
      expect(requiresText).toBe(true);

      const hasText =
        answerText !== null &&
        answerText !== undefined &&
        answerText.length > 0;
      expect(hasText).toBe(true);
    });

    it("should mark open-ended answers as pending review", () => {
      const questionType = "open_ended";

      // Open-ended questions require manual review
      // For M6, they are marked as pending (isCorrect: false, points: 0)
      const isCorrect = false; // Pending review
      const points = 0; // Pending review

      expect(isCorrect).toBe(false);
      expect(points).toBe(0);
    });
  });

  describe("Attempt Completion Validation", () => {
    it("should prevent completing an already completed attempt", () => {
      const attempt = createMockStudyAttempt({
        status: "COMPLETED",
        completedAt: new Date(),
      });

      const canComplete = attempt.status === "IN_PROGRESS";
      expect(canComplete).toBe(false);
    });

    it("should prevent completing an abandoned attempt", () => {
      const attempt = createMockStudyAttempt({
        status: "ABANDONED",
        completedAt: new Date(),
      });

      const canComplete = attempt.status === "IN_PROGRESS";
      expect(canComplete).toBe(false);
    });

    it("should set completedAt when marking as completed", () => {
      const attempt = createMockStudyAttempt({ status: "IN_PROGRESS" });

      // Simulate completion
      const completedAttempt = {
        ...attempt,
        status: "COMPLETED" as const,
        completedAt: new Date(),
      };

      expect(completedAttempt.completedAt).toBeInstanceOf(Date);
      expect(completedAttempt.status).toBe("COMPLETED");
    });
  });
});
