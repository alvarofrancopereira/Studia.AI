"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/subjects/" + id);
      return;
    }

    // Simular carregamento de detalhes da matéria
    const fetchSubject = async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Dados mockados para demonstração
      setSubject(null);
      setIsLoading(false);
    };

    fetchSubject();
  }, [status, router, id]);

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
              <p className="text-sm text-muted-foreground">Tópicos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">0</div>
              <p className="text-sm text-muted-foreground">Questões</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">0%</div>
              <p className="text-sm text-muted-foreground">Domínio</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">0</div>
              <p className="text-sm text-muted-foreground">Estudos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topics List */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Tópicos</h2>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" /> Novo Tópico
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
                Comece adicionando tópicos para organizar seus estudos nesta
                matéria.
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Adicionar Tópico
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {subject.topics.map((topic, index) => (
              <Card
                key={topic.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-medium">{topic.name}</h3>
                        {topic.description && (
                          <p className="text-sm text-muted-foreground">
                            {topic.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                        {topic.questionCount > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            {topic.questionCount}
                          </span>
                        )}
                        {topic.quizCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Brain className="h-4 w-4" />
                            {topic.quizCount}
                          </span>
                        )}
                        {topic.flashcardCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Puzzle className="h-4 w-4" />
                            {topic.flashcardCount}
                          </span>
                        )}
                        {topic.puzzleCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Puzzle className="h-4 w-4" />
                            {topic.puzzleCount}
                          </span>
                        )}
                      </div>

                      {topic.masteryLevel !== null &&
                        topic.masteryLevel !== undefined && (
                          <Badge
                            variant={
                              topic.masteryLevel >= 70 ? "default" : "secondary"
                            }
                          >
                            {Math.round(topic.masteryLevel)}% domínio
                          </Badge>
                        )}

                      <Link href={`/subjects/${id}/topics/${topic.id}`}>
                        <Button variant="ghost" size="sm">
                          Ver →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>Comece a estudar esta matéria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" /> Praticar Questões
            </Button>
            <Button variant="outline">
              <Brain className="h-4 w-4 mr-2" /> Fazer Quiz
            </Button>
            <Button variant="outline">
              <Puzzle className="h-4 w-4 mr-2" /> Revisar Flashcards
            </Button>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" /> Adicionar Tópico
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
