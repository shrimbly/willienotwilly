import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center py-32">
      <div className="container mx-auto flex flex-col items-center gap-8 px-4 text-center">
        <p className="text-8xl font-bold tracking-tighter text-foreground/10 md:text-9xl">
          404
        </p>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold md:text-3xl">Page not found</h1>
          <p className="text-muted-foreground max-w-md">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </section>
  );
}







