"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase-browser";
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
import { Download, Upload, Trash2 } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import type {
  Driver,
  Employee,
  SalaryAdvance,
  PersonType,
  AdvanceType,
  BeneficioCategory,
} from "@/types";

const ADVANCE_TYPE_LABELS: Record<AdvanceType, string> = {
  beneficio: "Benefício",
  salario: "Salário",
  produtos: "Produtos",
};

const BENEFICIO_LABELS: Record<BeneficioCategory, string> = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  refeicao: "Refeição",
};

export default function AdiantamentosPage() {
  const queryClient = useQueryClient();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const [personType, setPersonType] = useState<PersonType>("driver");
  const [personId, setPersonId] = useState("");
  const [advanceType, setAdvanceType] = useState<AdvanceType>("salario");
  const [beneficioCategory, setBeneficioCategory] = useState<BeneficioCategory>("alimentacao");
  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => api.get("/api/drivers"),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/employees"),
  });

  const { data: advances = [], isLoading } = useQuery<SalaryAdvance[]>({
    queryKey: ["advances", month],
    queryFn: () => api.get(`/api/advances?month=${month}`),
  });

  const people = personType === "driver" ? drivers : employees;

  const selectedPerson = people.find((p) => p.id === personId);

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        person_type: personType,
        person_id: personId,
        advance_type: advanceType,
        amount: Number(amount),
        advance_date: advanceDate,
        payroll_month: month,
        notes: notes || null,
      };
      if (advanceType === "beneficio") {
        body.beneficio_category = beneficioCategory;
      }
      if (advanceType === "produtos") {
        body.product_name = productName;
      }
      return api.post("/api/advances", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      toast.success("Adiantamento registrado.");
      setPersonId("");
      setAmount("");
      setNotes("");
      setProductName("");
    },
    onError: (err: Error) => {
      try {
        const parsed = JSON.parse(err.message);
        toast.error(parsed.detail || "Erro ao registrar adiantamento.");
      } catch {
        toast.error("Erro ao registrar adiantamento.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/advances/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      toast.success("Adiantamento removido.");
    },
    onError: () => toast.error("Erro ao remover adiantamento."),
  });

  const getPersonName = (a: SalaryAdvance) => {
    if (a.person_type === "driver") {
      return drivers.find((x) => x.id === a.person_id)?.name || "—";
    }
    return employees.find((x) => x.id === a.person_id)?.name || "—";
  };

  const getAdvanceTypeLabel = (adv: SalaryAdvance) => {
    const label = ADVANCE_TYPE_LABELS[adv.advance_type] || adv.advance_type;
    if (adv.advance_type === "beneficio" && adv.beneficio_category) {
      return `${label} (${BENEFICIO_LABELS[adv.beneficio_category]})`;
    }
    if (adv.advance_type === "produtos" && adv.product_name) {
      return `${label}: ${adv.product_name}`;
    }
    return label;
  };

  const getAdvanceTypeBadgeColor = (type: AdvanceType) => {
    switch (type) {
      case "beneficio":
        return "bg-purple-100 text-purple-700";
      case "salario":
        return "bg-blue-100 text-blue-700";
      case "produtos":
        return "bg-amber-100 text-amber-700";
    }
  };

  const handleUploadSigned = async (advanceId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `signed_${advanceId}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("contracts")
      .upload(path, file);
    if (error) {
      toast.error("Erro ao enviar contrato assinado.");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("contracts").getPublicUrl(path);

    await api.put(
      `/api/advances/${advanceId}/upload-signed?signed_contract_url=${encodeURIComponent(publicUrl)}`
    );
    queryClient.invalidateQueries({ queryKey: ["advances"] });
    toast.success("Contrato assinado enviado.");
  };

  const downloadPdf = (advanceId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    window.open(`${apiUrl}/api/advances/${advanceId}/pdf`, "_blank");
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Adiantamentos</h1>
        <p className="text-sm text-slate-500">
          Registre adiantamentos de benefício, salário ou produtos
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Novo Adiantamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!personId || !amount || Number(amount) <= 0) {
                toast.error("Preencha todos os campos obrigatórios.");
                return;
              }
              if (advanceType === "produtos" && !productName.trim()) {
                toast.error("Informe o nome do produto.");
                return;
              }
              createMutation.mutate();
            }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="space-y-2">
              <Label>Tipo de Pessoa</Label>
              <Select
                value={personType}
                onValueChange={(v) => {
                  if (v) setPersonType(v as PersonType);
                  setPersonId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string | null) =>
                      v === "driver" ? "Motorista" : v === "employee" ? "Funcionário" : "Selecione"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="driver">Motorista</SelectItem>
                  <SelectItem value="employee">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pessoa</Label>
              <Select
                value={personId}
                onValueChange={(v) => setPersonId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string | null) =>
                      people.find((p) => p.id === v)?.name || "Selecione"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Adiantamento</Label>
              <Select
                value={advanceType}
                onValueChange={(v) => {
                  if (v) setAdvanceType(v as AdvanceType);
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string | null) =>
                      v ? ADVANCE_TYPE_LABELS[v as AdvanceType] : "Selecione"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beneficio">Benefício</SelectItem>
                  <SelectItem value="salario">Salário</SelectItem>
                  <SelectItem value="produtos">Produtos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {advanceType === "beneficio" && (
              <div className="space-y-2">
                <Label>Categoria do Benefício</Label>
                <Select
                  value={beneficioCategory}
                  onValueChange={(v) => {
                    if (v) setBeneficioCategory(v as BeneficioCategory);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(v: string | null) =>
                        v ? BENEFICIO_LABELS[v as BeneficioCategory] : "Selecione"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alimentacao">Alimentação</SelectItem>
                    <SelectItem value="transporte">Transporte</SelectItem>
                    <SelectItem value="refeicao">Refeição</SelectItem>
                  </SelectContent>
                </Select>
                {selectedPerson && (
                  <p className="text-xs text-slate-500">
                    Limite:{" "}
                    {formatBRL(
                      beneficioCategory === "alimentacao"
                        ? selectedPerson.beneficio_alimentacao
                        : beneficioCategory === "transporte"
                        ? selectedPerson.beneficio_transporte
                        : selectedPerson.beneficio_refeicao
                    )}
                  </p>
                )}
              </div>
            )}

            {advanceType === "produtos" && (
              <div className="space-y-2">
                <Label>Nome do Produto *</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Cesta básica"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={advanceDate}
                onChange={(e) => setAdvanceDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? "Registrando..."
                  : "Registrar Adiantamento"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center gap-3">
        <Label>Mês:</Label>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Adiantamento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Assinado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-slate-400"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : advances.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-slate-400"
                >
                  Nenhum adiantamento neste mês.
                </TableCell>
              </TableRow>
            ) : (
              advances.map((adv) => (
                <TableRow key={adv.id}>
                  <TableCell className="font-medium">
                    {getPersonName(adv)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {adv.person_type === "driver"
                        ? "Motorista"
                        : "Funcionário"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-xs ${getAdvanceTypeBadgeColor(adv.advance_type)}`}
                    >
                      {getAdvanceTypeLabel(adv)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatBRL(adv.amount)}
                  </TableCell>
                  <TableCell>{formatDate(adv.advance_date)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-blue-600"
                      onClick={() => downloadPdf(adv.id)}
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </Button>
                  </TableCell>
                  <TableCell>
                    {adv.signed_contract_url ? (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        Assinado
                      </Badge>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-1 text-sm text-amber-600 hover:text-amber-700">
                        <Upload className="h-3 w-3" />
                        Enviar
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadSigned(adv.id, file);
                          }}
                        />
                      </label>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => deleteMutation.mutate(adv.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
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
