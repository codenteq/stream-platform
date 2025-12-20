'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-4">Kişisel Canlı Yayın Stüdyosuna Hoş Geldiniz</h1>
      <p className="text-lg text-muted-foreground mb-8">Yayına başlamak için giriş yapın veya yeni hesap oluşturun.</p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/login">Giriş Yap</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/register">Kayıt Ol</Link>
        </Button>
      </div>
    </div>
  );
}
