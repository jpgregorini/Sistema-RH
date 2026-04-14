"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatBRL, formatDate, formatWeight } from "@/lib/format";
import type { Trip, Driver } from "@/types";

export default function ViagensPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ["trips", month],
    queryFn: () => api.get(`/api/trips?month=${month}`),
  });

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => api.get("/api/drivers"),
  });

  const driverCommissions = new Map<string, Map<string, number>>();
  drivers.forEach((d) => {
    const comms = new Map<string, number>();
    d.driver_company_commissions?.forEach((c) => {
      comms.set(c.company, c.commission_pct);
    });
    driverCommissions.set(d.id, comms);
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Viagens</h1>
          <p className="text-sm text-slate-500">
            Dashboard de viagens e comissões dos motoristas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
          <Link href="/viagens/nova">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Viagem
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Motorista</TableHead>
              <TableHead>Empresas</TableHead>
              <TableHead className="text-right">Peso Total</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead className="text-right">Comissão Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : trips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  Nenhuma viagem encontrada neste mês.
                </TableCell>
              </TableRow>
            ) : (
              trips.map((trip) => {
                const isExpanded = expandedRows.has(trip.id);
                const comms = driverCommissions.get(trip.driver_id);
                const totalCommission = trip.trip_cargo.reduce((sum, cargo) => {
                  const pct = comms?.get(cargo.company) || 0;
                  return sum + (cargo.value_brl * pct) / 100;
                }, 0);

                return (
                  <>
                    <TableRow
                      key={trip.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => toggleRow(trip.id)}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                      </TableCell>
                      <TableCell>{formatDate(trip.trip_date)}</TableCell>
                      <TableCell className="font-medium">
                        {trip.drivers?.name || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {trip.trip_cargo.map((c) => (
                            <Badge key={c.id} variant="secondary" className="text-xs">
                              {c.company}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatWeight(trip.total_weight_kg)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBRL(trip.total_value_brl)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-700">
                        {formatBRL(totalCommission)}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${trip.id}-detail`}>
                        <TableCell colSpan={7} className="bg-slate-50 p-0">
                          <div className="px-12 py-3">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-slate-500">
                                  <th className="pb-2 text-left font-medium">Empresa</th>
                                  <th className="pb-2 text-right font-medium">Peso (kg)</th>
                                  <th className="pb-2 text-right font-medium">Valor (R$)</th>
                                  <th className="pb-2 text-right font-medium">Comissão (%)</th>
                                  <th className="pb-2 text-right font-medium">Ganho (R$)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {trip.trip_cargo.map((cargo) => {
                                  const pct = comms?.get(cargo.company) || 0;
                                  const earning = (cargo.value_brl * pct) / 100;
                                  return (
                                    <tr key={cargo.id} className="border-t border-slate-200">
                                      <td className="py-2">{cargo.company}</td>
                                      <td className="py-2 text-right">
                                        {formatWeight(cargo.weight_kg)}
                                      </td>
                                      <td className="py-2 text-right">
                                        {formatBRL(cargo.value_brl)}
                                      </td>
                                      <td className="py-2 text-right">{pct}%</td>
                                      <td className="py-2 text-right font-medium text-emerald-700">
                                        {formatBRL(earning)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
