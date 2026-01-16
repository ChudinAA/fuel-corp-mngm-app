import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function InDevelopmentPage() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center pt-6 gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground animate-pulse" />
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">В разработке</h1>
            <p className="text-muted-foreground">
              Эта страница находится на стадии разработки и скоро будет доступна.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
