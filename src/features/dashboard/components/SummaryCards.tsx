import React from "react";
import { Users, UserCheck, UserX, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export interface SummaryCardsProps {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
}

export function SummaryCards({
  totalUsers,
  activeUsers,
  inactiveUsers,
  adminUsers,
}: SummaryCardsProps) {
  const cards = [
    {
      title: "Total Users",
      value: totalUsers,
      description: "Registered accounts in system",
      icon: Users,
      iconBg: "bg-slate-100 text-brand-text border border-brand-border",
      badgeVariant: "neutral" as const,
      badgeText: "Accounts",
    },
    {
      title: "Active Users",
      value: activeUsers,
      description: "Currently active accounts",
      icon: UserCheck,
      iconBg: "bg-brand-success-bg text-brand-success border border-brand-success-border",
      badgeVariant: "success" as const,
      badgeText: "Active",
    },
    {
      title: "Inactive Users",
      value: inactiveUsers,
      description: "Deactivated staff accounts",
      icon: UserX,
      iconBg: "bg-brand-warning-bg text-brand-warning border border-brand-warning-border",
      badgeVariant: "warning" as const,
      badgeText: "Inactive",
    },
    {
      title: "Administrators",
      value: adminUsers,
      description: "Admin privileged accounts",
      icon: ShieldCheck,
      iconBg: "bg-indigo-50 text-indigo-700 border border-indigo-200",
      badgeVariant: "indigo" as const,
      badgeText: "Admin Role",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <Card key={idx} variant="default" className="h-full flex flex-col justify-between">
            <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg shrink-0 ${card.iconBg}`}>
                  <IconComponent className="h-4 w-4" />
                </div>
              </div>

              <div className="flex items-baseline justify-between py-1">
                <span className="text-3xl font-extrabold text-brand-text tracking-tight">
                  {card.value}
                </span>
                <Badge variant={card.badgeVariant} size="sm">
                  {card.badgeText}
                </Badge>
              </div>

              <p className="text-xs text-brand-text-muted leading-normal">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
