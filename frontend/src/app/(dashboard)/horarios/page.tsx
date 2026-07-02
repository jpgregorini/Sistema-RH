"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import type {
  Driver,
  Employee,
  PersonType,
  TimeRecordBatch,
} from "@/types";

type Target = "all_drivers" | "all_employees" | "all" | "custom";

const TARGET_LABELS: Record<Target, string> = {
  all_drivers: "Todos motoristas",
  all_employees: "Todos funcionários",
  all: "Todos (motoristas + funcionários)",
  custom: "Selecionar manualmente",
};

function formatMonth(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function HorariosPage() {
  const queryClient = useQueryClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [month, setMonth] = useState(currentMonth);
  const [target, setTarget] = useState<Target>("all_drivers");
  const [customType, setCustomType] = useState<PersonType>("driver");
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [notes, setNotes] = useState("");
  const [historyMonth, setHistoryMonth] = useState(currentMonth);

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => api.get("/api/drivers"),
  });
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/employees"),
  });

  const { data: batches = [], isLoading: loadingHistory } = useQuery<
    TimeRecordBatch[]
  >({
    queryKey: ["time-records-batches", historyMonth],
    queryFn: () =>
      api.get(`/api/time-records/batches?month=${historyMonth}`),
  });

  const customPool = customType === "driver" ? drivers : employees;

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });

  const selectedKeys = useMemo(() => Object.keys(selected), [selected]);

  const previewCount = useMemo(() => {
    if (target === "all_drivers") return drivers.filter((d) => d.active).length;
    if (target === "all_employees") return employees.filter((e) => e.active).length;
    if (target === "all")
      return (
        drivers.filter((d) => d.active).length +
        employees.filter((e) => e.active).length
      );
    return selectedKeys.length;
  }, [target, drivers, employees, selectedKeys]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const people =
        target === "custom"
          ? selectedKeys.map((k) => {
              const [pt, id] = k.split(":");
              return { person_type: pt, person_id: id };
            })
          : [];
      return api.post<{ batch_id: string; count: number }>(
        "/api/time-records",
        {
          punch_at: `${month}-01T08:00:00`,
          target,
          people,
          notes: notes || null,
        }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["time-records-batches"] });
      toast.success(`${result.count} folha(s) de ponto gerada(s).`);
      setNotes("");
      setSelected({});
      window.open(
        `${apiUrl}/api/time-records/batch/${result.batch_id}/pdf`,
        "_blank"
      );
    },
    onError: (err: Error) => {
      try {
        const parsed = JSON.parse(err.message);
        toast.error(parsed.detail || "Erro ao gerar comprovantes.");
      } catch {
        toast.error("Erro ao gerar comprovantes.");
      }
    },
  });

  const deleteBatch = useMutation({
    mutationFn: (batchId: string) =>
      api.delete(`/api/time-records/batch/${batchId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-records-batches"] });
      toast.success("Lote removido.");
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Horários</h1>
        <p className="text-sm text-slate-500">
          Gere folhas de ponto (mensais, em branco) para os colaboradores
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Nova Folha de Ponto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (target === "custom" && selectedKeys.length === 0) {
                toast.error("Selecione pelo menos um colaborador.");
                return;
              }
              if (!month) {
                toast.error("Informe o mês.");
                return;
              }
              createMutation.mutate();
            }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="space-y-2">
              <Label>Mês/Ano</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Destinatários</Label>
              <Select
                value={target}
                onValueChange={(v) => {
                  if (v) setTarget(v as Target);
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string | null) =>
                      v ? TARGET_LABELS[v as Target] : "Selecione"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_drivers">Todos motoristas</SelectItem>
                  <SelectItem value="all_employees">Todos funcionários</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="custom">Selecionar manualmente</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Vai gerar <span className="font-semibold">{previewCount}</span>{" "}
                folha(s) de ponto.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Opcional"
              />
            </div>

            {target === "custom" && (
              <div className="sm:col-span-2 lg:col-span-3 space-y-3 rounded-lg border bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <Label>Tipo:</Label>
                  <Select
                    value={customType}
                    onValueChange={(v) => {
                      if (v) setCustomType(v as PersonType);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) =>
                          v === "driver"
                            ? "Motoristas"
                            : v === "employee"
                            ? "Funcionários"
                            : "Selecione"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="driver">Motoristas</SelectItem>
                      <SelectItem value="employee">Funcionários</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-slate-500">
                    {selectedKeys.length} selecionado(s)
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto">
                  {customPool.map((p) => {
                    const key = `${customType}:${p.id}`;
                    const checked = !!selected[key];
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded border bg-white px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-600"
                          checked={checked}
                          onChange={() => toggle(key)}
                        />
                        <span className={checked ? "font-medium" : ""}>
                          {p.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? "Gerando..."
                  : "Gerar Folhas de Ponto"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Histórico</h2>
        <div className="flex items-center gap-3">
          <Label>Mês:</Label>
          <Input
            type="month"
            value={historyMonth}
            onChange={(e) => setHistoryMonth(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês/Ano</TableHead>
              <TableHead>Colaboradores</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="w-40">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingHistory ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  Nenhum lote neste mês.
                </TableCell>
              </TableRow>
            ) : (
              batches.map((b) => (
                <TableRow key={b.batch_id}>
                  <TableCell className="font-medium">
                    {formatMonth(b.punch_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xl">
                      {b.people.slice(0, 5).map((p) => (
                        <Badge
                          key={p.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {p.name}
                        </Badge>
                      ))}
                      {b.people.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{b.people.length - 5}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{b.count}</TableCell>
                  <TableCell className="text-sm text-slate-500 max-w-[200px] truncate">
                    {b.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-blue-600"
                        onClick={() =>
                          window.open(
                            `${apiUrl}/api/time-records/batch/${b.batch_id}/pdf`,
                            "_blank"
                          )
                        }
                      >
                        <Download className="h-3 w-3" />
                        PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (confirm("Remover este lote?"))
                            deleteBatch.mutate(b.batch_id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
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
