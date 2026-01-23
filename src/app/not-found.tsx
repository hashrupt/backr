import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
          <div className="flex gap-4">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md h-10 px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Go home
            </Link>
            <Link
              href="/campaigns"
              className="inline-flex items-center justify-center rounded-md h-10 px-4 py-2 text-sm font-medium border border-gray-300 bg-transparent hover:bg-gray-100 transition-colors"
            >
              Browse campaigns
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
