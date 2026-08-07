import React from "react";
import Link from "next/link";
import { Users, UserPlus, ArrowRight, Shield } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function QuickActions() {
  return (
    <Card variant="default">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-brand-primary" />
          <CardTitle>Administrative Operations</CardTitle>
        </div>
        <CardDescription>
          Direct shortcuts to manage staff system access and user accounts.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Action Card 1: User Management Overview */}
          <div className="p-4 rounded-xl border border-brand-border bg-brand-surface hover:border-slate-300 transition-colors duration-150 flex flex-col justify-between space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-brand-info-bg text-brand-info border border-brand-info-border shrink-0">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-brand-text">Manage User Accounts</h4>
                <p className="text-xs text-brand-text-muted mt-0.5 leading-relaxed">
                  View staff directory, assign administrative roles, or activate and deactivate user access.
                </p>
              </div>
            </div>
            <div>
              <Link href="/users" className="block">
                <Button variant="outline" size="sm" className="w-full justify-between group text-xs">
                  <span>Go to User Directory</span>
                  <ArrowRight className="h-3.5 w-3.5 text-brand-text-subtle group-hover:translate-x-0.5 transition-transform duration-150" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Action Card 2: Create User Shortcut */}
          <div className="p-4 rounded-xl border border-brand-border bg-brand-surface hover:border-slate-300 transition-colors duration-150 flex flex-col justify-between space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-brand-info-bg text-brand-info border border-brand-info-border shrink-0">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-brand-text">Register New User</h4>
                <p className="text-xs text-brand-text-muted mt-0.5 leading-relaxed">
                  Register a new staff login account with initial username, password, and system role.
                </p>
              </div>
            </div>
            <div>
              <Link href="/users" className="block">
                <Button variant="primary" size="sm" className="w-full justify-between group text-xs">
                  <span>Add New Account</span>
                  <ArrowRight className="h-3.5 w-3.5 text-white group-hover:translate-x-0.5 transition-transform duration-150" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
