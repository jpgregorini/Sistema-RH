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
import { Plus, Search, Pencil, Trash2, FileText, Copy, Archive } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatCPF, formatBRL } from "@/lib/format";
import { toast } from "sonner";
import type { Employee, RegistroStatus } from "@/types";

export default function FuncionariosPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/employees"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Funcionário desativado com sucesso.");
    },
  });

  const filtered = employees.filter(
    (e) =>
      (e.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.cpf || "").includes(search)
  );

  const copyLink = (emp: Employee) => {
    if (!emp.registration_token) {
      toast.error("Sem link gerado. Edite o funcionário para gerar.");
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${origin}/registro/${emp.registration_token}`);
    toast.success("Link copiado.");
  };

  const generateRegistro = async (emp: Employee) => {
    try {
      const status = await api.get<RegistroStatus>(
        `/api/employees/${emp.id}/registro-status`
      );
      if (!status.can_generate) {
        toast.error("Faltam campos: " + status.missing.join(", "));
        return;
      }
      window.open(`${apiUrl}/api/employees/${emp.id}/registro-pdf`, "_blank");
    } catch {
      toast.error("Erro ao verificar o registro.");
    }
  };

  const downloadZip = async (emp: Employee) => {
    try {
      const status = await api.get<RegistroStatus>(
        `/api/employees/${emp.id}/registro-status`
      );
      if (!status.can_generate) {
        toast.error("Faltam campos: " + status.missing.join(", "));
        return;
      }
      window.open(`${apiUrl}/api/employees/${emp.id}/registro-zip`, "_blank");
    } catch {
      toast.error("Erro ao gerar o ZIP.");
    }
  };

  const registroBadge = (emp: Employee) => {
    if (emp.registration_mode !== "link") {
      return <span className="text-xs text-slate-400">—</span>;
    }
    if (emp.registration_submitted_at) {
      return <Badge className="bg-emerald-100 text-emerald-700">Recebido</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-700">Aguardando</Badge>;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Funcionários</h1>
          <p className="text-sm text-slate-500">
            Gerencie os funcionários cadastrados
          </p>
        </div>
        <Link href="/funcionarios/novo">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Funcionário
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
              <TableHead>Tipo</TableHead>
              <TableHead>Salário Base</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-56">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  Nenhum funcionário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">
                    {emp.name || (
                      <span className="text-slate-400 italic">aguardando</span>
                    )}
                  </TableCell>
                  <TableCell>{emp.cpf ? formatCPF(emp.cpf) : "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        emp.contract_type === "CLT"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }
                    >
                      {emp.contract_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {emp.base_salary ? formatBRL(emp.base_salary) : "—"}
                  </TableCell>
                  <TableCell>{registroBadge(emp)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={emp.active ? "default" : "secondary"}
                      className={emp.active ? "bg-emerald-100 text-emerald-700" : ""}
                    >
                      {emp.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {emp.registration_mode === "link" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600"
                          title="Copiar link do funcionário"
                          onClick={() => copyLink(emp)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600"
                        title="Gerar Registro de Empregado (PDF)"
                        onClick={() => generateRegistro(emp)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-600"
                        title="Baixar ZIP (Registro + documentos) p/ contabilidade"
                        onClick={() => downloadZip(emp)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Link href={`/funcionarios/${emp.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        title="Desativar"
                        onClick={() => {
                          if (confirm("Deseja desativar este funcionário?")) {
                            deleteMutation.mutate(emp.id);
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
