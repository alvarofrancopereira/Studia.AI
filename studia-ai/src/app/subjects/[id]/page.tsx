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
  BookOpen,
  Plus,
  FileText,
  Brain,
  Puzzle,
} from "lucide-react";

interface Topic {
  id: string;
  name: string;
  description: string | null;
  order: number;
  questionCount: number;
  quizCount: number;
  flashcardCount: number;
  puzzleCount: number;
  masteryLevel: number | null;
}

interface SubjectDetail {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  topicCount: number;
  topics: Topic[];
}

export default function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { status } = useSession();
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchSubject = useCallback(async () => {
    if (!id || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/subjects/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch subject");
      }

      const data = await response.json();
      setSubject(data.subject);
    } catch (err) {
      console.error("Error fetching subject:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubject(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/subjects/" + id);
      return;
    }

    if (status === "authenticated" && !hasFetchedRef.current) {
      fetchSubject();
    }
  }, [status, router, id, fetchSubject]);

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
        <Link href="/subjects">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </Link>

        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              Erro ao carregar matéria
            </h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button
              onClick={() => {
                hasFetchedRef.current = false;
                fetchSubject();
              }}
            >
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Link href="/subjects">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </Link>

        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              Matéria não encontrada
            </h3>
            <p className="text-muted-foreground mb-4">
              A matéria que você está procurando não existe ou foi removida.
            </p>
            <Link href="/subjects">
              <Button>Ver Todas as Matérias</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <Link href="/subjects">
        <Button variant="outline" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{subject.name}</h1>
          {subject.color && (
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: subject.color }}
            />
          )}
        </div>
        {subject.description && (
          <p className="text-muted-foreground">{subject.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{subject.topicCount}</div>
              <p className="text-xs text-muted-foreground">Tópicos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {subject.topics.reduce((acc, t) => acc + t.questionCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Questões</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {subject.topics.reduce((acc, t) => acc + t.quizCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Quizzes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {subject.topics.reduce((acc, t) => acc + t.flashcardCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Flashcards</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topics List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Tópicos</h2>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Novo Tópico
          </Button>
        </div>

        {subject.topics.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum tópico cadastrado
              </h3>
              <p className="text-muted-foreground mb-4">
                Comece adicionando tópicos para organizar seu estudo nesta
                matéria.
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Criar Primeiro Tópico
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {subject.topics.map((topic) => (
              <Card
                key={topic.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{topic.name}</CardTitle>
                      <CardDescription>
                        {topic.description || "Sem descrição"}
                      </CardDescription>
                    </div>
                    {topic.masteryLevel !== null &&
                      topic.masteryLevel !== undefined && (
                        <Badge
                          variant={
                            topic.masteryLevel >= 80
                              ? "default"
                              : topic.masteryLevel >= 50
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {Math.round(topic.masteryLevel)}% domínio
                        </Badge>
                      )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <FileText className="h-4 w-4 mr-1" />
                      {topic.questionCount} questões
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Brain className="h-4 w-4 mr-1" />
                      {topic.quizCount} quizzes
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Puzzle className="h-4 w-4 mr-1" />
                      {topic.puzzleCount} puzzles
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/subjects/${id}/topics/${topic.id}`}>
                      <Button size="sm">Estudar</Button>
                    </Link>
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-1" /> Questões
                    </Button>
                    <Button variant="outline" size="sm">
                      <Brain className="h-4 w-4 mr-1" /> Quiz
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
