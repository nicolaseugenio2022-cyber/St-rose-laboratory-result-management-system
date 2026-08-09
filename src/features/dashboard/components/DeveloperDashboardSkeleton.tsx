import React from "react";
import { ArrowRight, Database, Hash, ShieldCheck, ServerCog, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";

export function DeveloperDashboardSkeleton() {
  return (
    <section className="space-y-6 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="h-8 w-64 bg-slate-200 rounded-md mb-2"></div>
          <div className="h-4 w-96 bg-slate-100 rounded-md"></div>
        </div>
        <div className="h-4 w-32 bg-slate-200 rounded-md"></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-300" />
                <CardTitle className="h-5 w-40 bg-slate-200 rounded-md"></CardTitle>
              </div>
              <CardDescription className="h-4 w-56 bg-slate-100 rounded-md mt-2"></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-6 w-full bg-slate-100 rounded-md"></div>
              <div className="h-6 w-full bg-slate-100 rounded-md"></div>
              <div className="h-6 w-full bg-slate-100 rounded-md"></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-300" />
                <CardTitle className="h-5 w-32 bg-slate-200 rounded-md"></CardTitle>
              </div>
              <CardDescription className="h-4 w-56 bg-slate-100 rounded-md mt-2"></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-2xl bg-slate-100 p-3 h-16"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ServerCog className="h-4 w-4 text-slate-300" />
              <CardTitle className="h-5 w-40 bg-slate-200 rounded-md"></CardTitle>
            </div>
            <CardDescription className="h-4 w-56 bg-slate-100 rounded-md mt-2"></CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-slate-100 p-4 grid gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-5 w-full bg-slate-200 rounded-md"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-slate-300" />
              <CardTitle className="h-5 w-40 bg-slate-200 rounded-md"></CardTitle>
            </div>
            <CardDescription className="h-4 w-56 bg-slate-100 rounded-md mt-2"></CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-slate-100 p-4 h-24"></div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-300" />
              <CardTitle className="h-5 w-40 bg-slate-200 rounded-md"></CardTitle>
            </div>
            <CardDescription className="h-4 w-56 bg-slate-100 rounded-md mt-2"></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-slate-100 p-4 h-20 border border-slate-200"></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
