"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase-browser";
import { cpfMask } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import type { Employee, ContractType } from "@/types";

interface EmployeeFormProps {
  employee?: Employee;
}

export function EmployeeForm({ employee }: EmployeeFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = !!employee;

  const [name, setName] = useState(employee?.name || "");
  const [cpf, setCpf] = useState(employee?.cpf || "");
  const [dateOfBirth, setDateOfBirth] = useState(employee?.date_of_birth || "");
  const [contractType, setContractType] = useState<ContractType>(
    employee?.contract_type || "CLT"
  );
  const [baseSalary, setBaseSalary] = useState(employee?.base_salary ? String(employee.base_salary) : "");
  const [phone, setPhone] = useState(employee?.phone || "");
  const [pixKey, setPixKey] = useState(employee?.pix_key || "");
  const [payday, setPayday] = useState(employee?.payday || 5);
  const [notes, setNotes] = useState(employee?.notes || "");
  const [photoUrl, setPhotoUrl] = useState(employee?.photo_url || "");
  const [contractUrl, setContractUrl] = useState(employee?.contract_file_url || "");
  const [uploading, setUploading] = useState(false);

  // Benefits
  const [benefAlimentacao, setBenefAlimentacao] = useState(employee?.beneficio_alimentacao ? String(employee.beneficio_alimentacao) : "");
  const [benefTransporte, setBenefTransporte] = useState(employee?.beneficio_transporte ? String(employee.beneficio_transporte) : "");
  const [benefRefeicao, setBenefRefeicao] = useState(employee?.beneficio_refeicao ? String(employee.beneficio_refeicao) : "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        cpf,
        date_of_birth: dateOfBirth || null,
        contract_type: contractType,
        base_salary: Number(baseSalary) || null,
        phone: phone || null,
        pix_key: pixKey || null,
        payday,
        notes: notes || null,
        photo_url: photoUrl || null,
        contract_file_url: contractUrl || null,
        beneficio_alimentacao: Number(benefAlimentacao) || 0,
        beneficio_transporte: Number(benefTransporte) || 0,
        beneficio_refeicao: Number(benefRefeicao) || 0,
      };

      if (isEditing) {
        return api.put(`/api/employees/${employee.id}`, body);
      }
      return api.post("/api/employees", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(
        isEditing
          ? "Funcionário atualizado com sucesso."
          : "Funcionário cadastrado com sucesso."
      );
      router.push("/funcionarios");
    },
    onError: () => {
      toast.error("Erro ao salvar funcionário.");
    },
  });

  const handleFileUpload = useCallback(
    async (file: File, onUrl: (url: string) => void) => {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage.from("documents").upload(path, file);
      if (error) {
        toast.error("Erro ao enviar arquivo.");
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(path);
      onUrl(publicUrl);
      setUploading(false);
      toast.success("Arquivo enviado.");
    },
    []
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEditing ? "Editar Funcionário" : "Novo Funcionário"}
        </h1>
        <p className="text-sm text-slate-500">
          {isEditing
            ? "Atualize as informações do funcionário"
            : "Cadastre um novo funcionário no sistema"}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <Card>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(cpfMask(e.target.value))}
                placeholder="000.000.000-00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Data de Nascimento</Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract_type">Tipo de Contrato *</Label>
              <Select
                value={contractType}
                onValueChange={(v) => v && setContractType(v as ContractType)}
              >
                <SelectTrigger>
                  <span className="flex flex-1 text-left">{contractType}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary">Salário Base (R$)</Label>
              <Input
                id="salary"
                type="number"
                step="0.01"
                min="0"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pix">Chave PIX</Label>
              <Input
                id="pix"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payday">Dia de Pagamento *</Label>
              <Input
                id="payday"
                type="number"
                min={1}
                max={31}
                value={payday}
                onChange={(e) => setPayday(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="sm:col-span-2">
              <div className="mb-2 mt-2 border-t pt-4">
                <p className="text-sm font-semibold text-slate-700">Benefícios (Cartão)</p>
                <p className="text-xs text-slate-500 mb-3">
                  Defina os valores do cartão de benefícios
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="benef_alim">Alimentação (R$)</Label>
                  <Input
                    id="benef_alim"
                    type="number"
                    step="0.01"
                    min="0"
                    value={benefAlimentacao}
                    onChange={(e) => setBenefAlimentacao(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="benef_trans">Transporte (R$)</Label>
                  <Input
                    id="benef_trans"
                    type="number"
                    step="0.01"
                    min="0"
                    value={benefTransporte}
                    onChange={(e) => setBenefTransporte(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="benef_ref">Refeição (R$)</Label>
                  <Input
                    id="benef_ref"
                    type="number"
                    step="0.01"
                    min="0"
                    value={benefRefeicao}
                    onChange={(e) => setBenefRefeicao(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">
                  Total do Cartão:{" "}
                  <span className="text-blue-600">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      (Number(benefAlimentacao) || 0) + (Number(benefTransporte) || 0) + (Number(benefRefeicao) || 0)
                    )}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Foto (opcional)</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:border-blue-400">
                <Upload className="h-4 w-4" />
                {photoUrl ? "Alterar foto" : "Enviar foto"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, setPhotoUrl);
                  }}
                />
              </label>
              {photoUrl && <span className="text-xs text-emerald-600">Arquivo enviado</span>}
            </div>

            <div className="space-y-2">
              <Label>Contrato (opcional)</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:border-blue-400">
                <Upload className="h-4 w-4" />
                {contractUrl ? "Alterar contrato" : "Enviar contrato"}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, setContractUrl);
                  }}
                />
              </label>
              {contractUrl && <span className="text-xs text-emerald-600">Arquivo enviado</span>}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending
              ? "Salvando..."
              : isEditing
              ? "Atualizar Funcionário"
              : "Cadastrar Funcionário"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/funcionarios")}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
