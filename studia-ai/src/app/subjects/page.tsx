"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Plus, ArrowRight } from "lucide-react";

interface Subject {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  topicCount: number;
}

export default function SubjectsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/subjects");
      return;
    }

    // Simular carregamento de matérias
    const fetchSubjects = async () => {
      // Em produção, isso seria uma chamada à API
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Dados mockados para demonstração
      setSubjects([]);
      setIsLoading(false);
    };

    fetchSubjects();
  }, [status, router]);

  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Matérias</h1>
          <p className="text-muted-foreground">
            Gerencie suas matérias e tópicos de estudo
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nova Matéria
        </Button>
      </div>

      {subjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma matéria cadastrada</h3>
            <p className="text-muted-foreground mb-4">
              Comece adicionando sua primeira matéria para organizar seus estudos.
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Matéria
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map(subject => (
            <Card key={subject.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{subject.name}</CardTitle>
                    {subject.description && (
                      <CardDescription>{subject.description}</CardDescription>
                    )}
                  </div>
                  {subject.color && (
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: subject.color }}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {subject.topicCount} tópicos
                  </span>
                  <Link href={`/subjects/${subject.id}`}>
                    <Button variant="ghost" size="sm">
                      Ver <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
