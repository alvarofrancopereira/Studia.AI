"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  FileText,
  Brain,
  Puzzle,
  TrendingUp,
  Clock,
} from "lucide-react";

interface Question {
  id: string;
  content: string;
  difficulty: string;
  questionType: string;
}

interface TopicDetail {
  id: string;
  name: string;
  description: string | null;
  subjectName: string;
  subjectId: string;
  questionCount: number;
  quizCount: number;
  flashcardCount: number;
  puzzleCount: number;
  masteryLevel: number | null;
  lastStudied: Date | null;
  questions: Question[];
}

export default function TopicDetailPage() {
  const { id, topicId } = useParams<{ id: string; topicId: string }>();
  const { status, data: session } = useSession();
  const router = useRouter();
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchTopic = useCallback(async () => {
    if (!session?.user?.email || hasFetchedRef.current) return;

    hasFetchedRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/subjects/${id}/topics/${topicId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch topic");
      }

      const data = await response.json();
      setTopic(data.topic);
    } catch (err) {
      console.error("Error fetching topic:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setTopic(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, topicId, session?.user?.email]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/signin?callbackUrl=/subjects/${id}/topics/${topicId}`);
    }
  }, [status, router, id, topicId]);

  useEffect(() => {
    if (status === "authenticated" && !hasFetchedRef.current) {
      fetchTopic();
    }
  }, [status, fetchTopic]);

  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <Skeleton className="h-10 w-32 mb-4" />
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>

        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Link href={`/subjects/${id}`}>
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </Link>

        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              Erro ao carregar tópico
            </h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button
              onClick={() => {
                hasFetchedRef.current = false;
                fetchTopic();
              }}
            >
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Link href={`/subjects/${id}`}>
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </Link>

        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              Tópico não encontrado
            </h3>
            <p className="text-muted-foreground mb-4">
              O tópico que você está procurando não existe ou foi removido.
            </p>
            <Link href={`/subjects/${id}`}>
              <Button>Ver Matéria</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <Link href={`/subjects/${id}`}>
        <Button variant="outline" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Matéria
        </Button>
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href={`/subjects/${id}`} className="hover:text-primary">
            {topic.subjectName}
          </Link>
          <span>/</span>
          <span>{topic.name}</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">{topic.name}</h1>
        {topic.description && (
          <p className="text-muted-foreground">{topic.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{topic.questionCount}</div>
              <p className="text-xs text-muted-foreground">Questões</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{topic.quizCount}</div>
              <p className="text-xs text-muted-foreground">Quizzes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{topic.flashcardCount}</div>
              <p className="text-xs text-muted-foreground">Flashcards</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{topic.puzzleCount}</div>
              <p className="text-xs text-muted-foreground">Puzzles</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {topic.masteryLevel !== null
                  ? `${Math.round(topic.masteryLevel)}%`
                  : "--"}
              </div>
              <p className="text-xs text-muted-foreground">Domínio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Praticar Questões</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Responda questões deste tópico
              </p>
              <Button className="w-full">Começar</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center">
              <Brain className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Fazer Quiz</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Teste seu conhecimento
              </p>
              <Button className="w-full">Iniciar Quiz</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center">
              <Puzzle className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Revisar Flashcards</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Repetição espaçada
              </p>
              <Button className="w-full">Revisar</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Ver Progresso</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Histórico e estatísticas
              </p>
              <Button variant="outline" className="w-full">
                Ver Detalhes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Questions List */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Questões Disponíveis</CardTitle>
          <CardDescription>
            {topic.questionCount} questões neste tópico
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topic.questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma questão disponível ainda.</p>
              <p className="text-sm mt-2">
                Questões serão adicionadas conforme você estuda.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {topic.questions.map((question, index) => (
                <div
                  key={question.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium line-clamp-1">
                        {question.content}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge
                          variant={
                            question.difficulty === "easy"
                              ? "secondary"
                              : question.difficulty === "hard"
                                ? "destructive"
                                : "default"
                          }
                          className="text-xs"
                        >
                          {question.difficulty === "easy"
                            ? "Fácil"
                            : question.difficulty === "hard"
                              ? "Difícil"
                              : "Médio"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {question.questionType === "multiple_choice"
                            ? "Múltipla escolha"
                            : question.questionType === "true_false"
                              ? "Verdadeiro/Falso"
                              : "Discursiva"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Praticar →
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Study Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Dicas de Estudo</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5" />
              <span>
                Estude em sessões de 25-30 minutos com pausas regulares.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 mt-0.5" />
              <span>
                Revise este tópico regularmente para melhorar a retenção.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Brain className="h-4 w-4 mt-0.5" />
              <span>
                Combine diferentes tipos de atividades para melhor aprendizado.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
