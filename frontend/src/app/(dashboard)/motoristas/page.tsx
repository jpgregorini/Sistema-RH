"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatCPF } from "@/lib/format";
import { toast } from "sonner";
import type { Driver } from "@/types";

export default function MotoristasPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => api.get("/api/drivers"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/drivers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Motorista desativado com sucesso.");
    },
  });

  const filtered = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.cpf.includes(search)
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Motoristas</h1>
          <p className="text-sm text-slate-500">
            Gerencie os motoristas cadastrados
          </p>
        </div>
        <Link href="/motoristas/novo">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Motorista
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Empresas</TableHead>
              <TableHead>Dia Pgto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  Nenhum motorista encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="font-medium">{driver.name}</TableCell>
                  <TableCell>{formatCPF(driver.cpf)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {driver.driver_company_commissions?.map((c) => (
                        <Badge key={c.company} variant="secondary" className="text-xs">
                          {c.company} ({c.commission_pct}%)
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>Dia {driver.payday}</TableCell>
                  <TableCell>
                    <Badge
                      variant={driver.active ? "default" : "secondary"}
                      className={driver.active ? "bg-emerald-100 text-emerald-700" : ""}
                    >
                      {driver.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/motoristas/${driver.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (confirm("Deseja desativar este motorista?")) {
                            deleteMutation.mutate(driver.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
