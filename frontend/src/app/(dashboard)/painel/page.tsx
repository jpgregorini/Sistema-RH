"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, Users, Map, HandCoins, Plus } from "lucide-react";
import Link from "next/link";
import type { Driver, Employee, Trip, SalaryAdvance } from "@/types";

export default function DashboardPage() {
  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => api.get("/api/drivers"),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/employees"),
  });

  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ["trips", currentMonth],
    queryFn: () => api.get(`/api/trips?month=${currentMonth}`),
  });

  const { data: advances = [] } = useQuery<SalaryAdvance[]>({
    queryKey: ["advances", currentMonth],
    queryFn: () => api.get(`/api/advances?month=${currentMonth}`),
  });

  const cards = [
    {
      title: "Motoristas Ativos",
      value: drivers.length,
      icon: Truck,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Funcionários Ativos",
      value: employees.length,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Viagens do Mês",
      value: trips.length,
      icon: Map,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Adiantamentos do Mês",
      value: advances.length,
      icon: HandCoins,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Painel</h1>
        <p className="text-sm text-slate-500">
          Visão geral do sistema de RH - Novalog
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-lg p-3 ${card.bg}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-slate-500">{card.title}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {card.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Ações Rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/motoristas/novo">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Motorista
            </Button>
          </Link>
          <Link href="/funcionarios/novo">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Funcionário
            </Button>
          </Link>
          <Link href="/viagens/nova">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Viagem
            </Button>
          </Link>
          <Link href="/adiantamentos">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Adiantamento
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
